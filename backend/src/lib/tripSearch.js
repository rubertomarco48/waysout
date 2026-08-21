import { AIRPORTS } from "../data/airports.js";
import { countryIt, resolveAirlineName } from "./tripLogic.js";
import { buildOriginPool, buildDestinationCandidate, isoDate } from "./candidateGeneration.js";
import { passesPreliminaryBudget, computeValueScore, sortByValue } from "./ranking.js";
import { estimatedPriceInfo, offerPriceInfo, isSuspiciousPrice } from "./priceConfidence.js";
import { cacheKey, cacheGet, cacheSet } from "./cache.js";
import { getCheapestOffer } from "../providers/index.js";
import { travelpayoutsSweep } from "../providers/travelpayouts.js";
import { logSearch } from "./db.js";
import {
  MAX_CANDIDATE_DESTINATIONS,
  MAX_VERIFIED_DESTINATIONS,
  VERIFICATION_TIMEOUT_MS,
  CACHE_TTL_LIVE_MS,
  CACHE_TTL_CACHED_MS,
  MIN_DEPARTURE_DAYS_AHEAD,
  MAX_SEARCH_DAYS,
  SWEEP_MAX_ORIGINS,
  PRICE_TYPE,
} from "../config/constants.js";

function findAirport(code) {
  return AIRPORTS.find((a) => a.code === code) ?? null;
}

function addDaysUtc(d, days) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

// -----------------------------------------------------------------------
// PIPELINE
//
// USER SEARCH -> normalizzazione (validation.js, a monte) -> candidate
// destinations -> candidate dates -> preliminary ranking (con tolleranza)
// -> cache lookup -> flight providers -> normalizzazione risultati ->
// price confidence -> accommodation estimate -> total trip cost -> final
// ranking -> TOP RESULTS
//
// La fase DISCOVERY (stima) e la fase VERIFICATION (prezzo reale) sono
// deliberatamente separate: una destinazione non viene mai scartata solo
// perché la stima supera il budget entro la tolleranza configurata (vedi
// ranking.js / ESTIMATION_TOLERANCE) - viene comunque verificata, perché
// la stima può essere pessimista.
// -----------------------------------------------------------------------
export async function searchTrips(req) {
  const origin = findAirport(req.origin);
  if (!origin) {
    const err = new Error("Aeroporto di partenza non valido");
    err.status = 400;
    throw err;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const pool = buildOriginPool(origin, AIRPORTS, req.nearby_radius_km);

  // Finestra di ricerca EFFETTIVA in base alla modalità scelta dall'utente -
  // calcolata qui, PRIMA dello sweep, così sia lo sweep (Travelpayouts
  // aggregato) sia la verifica sui provider live rispettano lo stesso
  // vincolo: range esplicito se "range", finestra piena 90gg altrimenti.
  let verifyContext;
  {
    let wf;
    let wt;
    if (req.date_mode === "range" && req.date_from && req.date_to) {
      wf = req.date_from < isoDate(today) ? isoDate(addDaysUtc(today, 1)) : req.date_from;
      wt = req.date_to;
    } else {
      wf = isoDate(addDaysUtc(today, MIN_DEPARTURE_DAYS_AHEAD));
      wt = isoDate(addDaysUtc(today, MAX_SEARCH_DAYS));
    }
    verifyContext = {
      windowFrom: wf,
      windowTo: wt,
      minDuration: req.date_mode === "weekend" ? 2 : 1,
      maxDuration: req.max_days,
      // Modalita' weekend: partenza di venerdi' come promesso dal toggle
      requireDepartureWeekday: req.date_mode === "weekend" ? 5 : null,
    };
  }

  // --- SWEEP REALE (Travelpayouts aggregato) ------------------------------
  // Una chiamata per (origine, mese) restituisce TUTTE le destinazioni con
  // prezzi osservati reali: e' questa la fonte primaria dei candidati. La
  // stima chilometrica resta come rete di sicurezza per le rotte che lo
  // sweep non copre.
  //
  // BUG RISOLTO: prima i mesi da interrogare venivano calcolati SEMPRE
  // sull'intera finestra di 90 giorni, ignorando "range"/"weekend" - per
  // questo in modalità "Range di date" (es. 22-27 ago) uscivano risultati
  // con date di settembre/novembre: lo sweep li trovava in quei mesi e li
  // applicava comunque, sovrascrivendo le date corrette calcolate in
  // DISCOVERY. Ora i mesi sweepati sono derivati dalla stessa finestra
  // (verifyContext.windowFrom/windowTo) usata per la verifica sui provider,
  // e ogni offerta sweep viene scartata se cade fuori da quella finestra
  // (vedi filtro più sotto, sezione "APPLICAZIONE OFFERTE REALI").
  const monthKeys = [];
  {
    const windowFromDate = new Date(verifyContext.windowFrom + "T00:00:00Z");
    const windowToDate = new Date(verifyContext.windowTo + "T00:00:00Z");
    for (
      let d = new Date(Date.UTC(windowFromDate.getUTCFullYear(), windowFromDate.getUTCMonth(), 1));
      d <= windowToDate;
      d.setUTCMonth(d.getUTCMonth() + 1)
    ) {
      monthKeys.push(d.toISOString().slice(0, 7));
    }
  }

  const sweepGroups = await Promise.all(
    pool.slice(0, SWEEP_MAX_ORIGINS).flatMap((o) =>
      monthKeys.map(async (m) => ({ originCode: o.code, offers: await travelpayoutsSweep(o.code, m) }))
    )
  );

  // Per ogni rotta (origine:destinazione) tiene la migliore tra i mesi
  const sweepByRoute = new Map();
  for (const g of sweepGroups) {
    for (const off of g.offers) {
      if (!off?.destination || !off.departureDate || !off.returnDate) continue;
      const key = `${g.originCode}:${off.destination}`;
      const prev = sweepByRoute.get(key);
      if (!prev || off.price < prev.price) sweepByRoute.set(key, off);
    }
  }

  // --- DISCOVERY: candidate destinations + candidate dates ---------------
  let candidates = [];
  for (const d of AIRPORTS) {
    if (d.code === origin.code) continue;
    // Un aeroporto nel raggio di partenza non e' una "destinazione"
    if (pool.some((p) => p.code === d.code)) continue;
    const candidate = buildDestinationCandidate(req, d, pool, today);
    if (!candidate) continue;
    if (!passesPreliminaryBudget(candidate.total_cost, req.budget)) continue;
    candidates.push({
      ...candidate,
      country: countryIt(candidate.country),
      savings: Math.round(req.budget - candidate.total_cost),
      ...estimatedPriceInfo(),
    });
  }

  // --- APPLICAZIONE OFFERTE REALI DELLO SWEEP ----------------------------
  // Le offerte sweep hanno prezzo/data VERO: entrano nei risultati anche se
  // la stima locale le avrebbe scartate (era il buco per cui si vedevano
  // poche destinazioni). Non passano dal sanity check: arrivono
  // dall'endpoint aggregato ufficiale con currency=eur esplicito.
  const sweptDestCodes = new Set();
  for (const [key, off] of sweepByRoute) {
    const sep = key.indexOf(":");
    const originCode = key.slice(0, sep);
    const destCode = key.slice(sep + 1);

    const destAirport = AIRPORTS.find((a) => a.code === destCode);
    if (!destAirport) continue;

    const dd = new Date(off.departureDate + "T00:00:00Z");
    const rd = new Date(off.returnDate + "T00:00:00Z");
    if (Number.isNaN(dd.getTime()) || Number.isNaN(rd.getTime()) || rd <= dd) continue;
    const days = Math.round((rd - dd) / 86400000);
    // Sweep: nessuna tolleranza sulla durata - le alternative sono tante,
    // inutile proporre viaggi piu' lunghi dei giorni disponibili.
    if (days > req.max_days) continue;
    // FIX: un'offerta sweep con data fuori dalla finestra richiesta
    // dall'utente (range esplicito o vincolo weekend) va scartata - è
    // esattamente questo controllo che mancava e causava le date di
    // settembre/novembre quando l'utente aveva scelto un range di agosto.
    if (off.departureDate < verifyContext.windowFrom || off.returnDate > verifyContext.windowTo) continue;
    if (verifyContext.requireDepartureWeekday != null && dd.getUTCDay() !== verifyContext.requireDepartureWeekday) {
      continue;
    }
    // Non proporre come "destinazione" un aeroporto del proprio raggio
    // di partenza (es. Brindisi quando cerchi da Bari).
    if (pool.some((p) => p.code === destCode)) continue;

    let cand =
      candidates.find((c) => c.dest_code === destCode && c.origin_code === originCode) ??
      candidates.find((c) => c.dest_code === destCode);
    if (!cand) {
      const built = buildDestinationCandidate(req, destAirport, pool, today);
      if (!built) continue;
      cand = {
        ...built,
        country: countryIt(built.country),
        savings: Math.round(req.budget - built.total_cost),
        ...estimatedPriceInfo(),
      };
      candidates.push(cand);
    }

    // Riorienta il candidato sull'origine reale dell'offerta sweep
    if (cand.origin_code !== originCode) {
      const ap = pool.find((p) => p.code === originCode);
      if (ap) {
        cand.origin_code = ap.code;
        cand.origin_city = ap.city;
        cand.origin_distance_km = ap.origin_distance_km;
      }
    }

    applyOffer(
      cand,
      {
        price: off.price,
        departureDate: off.departureDate,
        returnDate: off.returnDate,
        details: off.details ?? null,
        ...offerPriceInfo("travelpayouts"),
      },
      req
    );
    sweptDestCodes.add(destCode);
  }

  // --- PRELIMINARY RANKING: cheapest-estimated first, cap payload --------
  candidates.sort((a, b) => a.total_cost - b.total_cost);
  candidates = candidates.slice(0, MAX_CANDIDATE_DESTINATIONS);

  // --- VERIFICATION: cache lookup, then real provider prices -------------
  // Best-effort, concurrent, across ALL configured providers - bounded by
  // MAX_VERIFIED_DESTINATIONS so a 90-day search window never multiplies
  // API calls (each destination is checked against exactly one candidate
  // date, the best one chosen during discovery). Le destinazioni gia'
  // prezzate dallo sweep reale saltano questa fase: non serve bruciare
  // chiamate per un prezzo che abbiamo gia' vero.
  const toVerify = candidates
    .filter((r) => !sweptDestCodes.has(r.dest_code))
    .slice(0, MAX_VERIFIED_DESTINATIONS);
  const providersTried = new Set();
  const providersFailed = new Set();
  let cacheHits = 0;

  // verifyContext (finestra date, durata, vincolo weekday) è già stato
  // calcolato in cima alla funzione, prima dello sweep - riusato qui tale
  // e quale per i provider live, così sweep e verifica live rispettano
  // sempre la stessa finestra richiesta dall'utente.

  await Promise.race([
    Promise.all(
      toVerify.map(async (r) => {
        const key = cacheKey({
          origin: r.origin_code,
          destination: r.dest_code,
          departureDate: r.departure_date,
          returnDate: r.return_date,
          passengers: 1,
          currency: "EUR",
        });

        const cached = cacheGet(key);
        if (cached) {
          cacheHits += 1;
          if (applyOffer(r, cached, req) === false) return;
          return;
        }

        const { offer, tried, failed } = await getCheapestOffer(r.origin_code, r.dest_code, r.departure_date, r.return_date, verifyContext);
        tried.forEach((p) => providersTried.add(p));
        failed.forEach((p) => providersFailed.add(p));
        if (!offer) return;

        const priceInfo = offerPriceInfo(offer.source);

        // Sanity check SOLO per i dati di terzi in cache (l'incidente
        // RUB/EUR era di Travelpayouts): una ricerca LIVE (SerpApi, Ryanair)
        // e' la verita' di mercato - se dice 360 EUR, sono 360 EUR, anche
        // quando la stima locale non c'entra. Scartarla significa mostrare
        // prezzi finti al posto di quelli veri.
        if (
          priceInfo.price_type === PRICE_TYPE.CACHED &&
          isSuspiciousPrice(offer.price, r.flight_price)
        ) {
          console.warn(
            `Suspicious cached price from ${offer.source} for ${r.origin_code}->${r.dest_code}: ` +
              `${offer.price} vs estimate ${r.flight_price} - discarded`
          );
          return;
        }
        const ttl = priceInfo.price_type === PRICE_TYPE.VERIFIED ? CACHE_TTL_LIVE_MS : CACHE_TTL_CACHED_MS;
        const cacheable = { ...offer, ...priceInfo };
        if (applyOffer(r, cacheable, req) === false) return;
        cacheSet(key, cacheable, ttl);
      })
    ),
    new Promise((resolve) => setTimeout(resolve, VERIFICATION_TIMEOUT_MS)),
  ]);

  // --- FINAL: hard budget cutoff + SOLO PREZZI REALI --------------------
  // Un risultato senza conferma da almeno un provider viene escluso: il
  // tabellone deve dire quanto si paga davvero, non quanto la stima
  // spera. Meglio poche destinazioni vere che tante stime inventate.
  let results = candidates.filter(
    (r) =>
      r.total_cost <= req.budget &&
      (r.price_type === PRICE_TYPE.VERIFIED || r.price_type === PRICE_TYPE.CACHED)
  );
  results = results.map((r) => ({ ...r, value_score: computeValueScore(r, req.budget) }));
  results = sortByValue(results);

  logSearch({
    budget: req.budget,
    max_days: req.max_days,
    origin: req.origin,
    results_count: results.length,
    verified_count: results.filter((r) => r.price_type === PRICE_TYPE.VERIFIED).length,
    cached_count: results.filter((r) => r.price_type === PRICE_TYPE.CACHED).length,
    estimated_count: results.filter((r) => r.price_type === PRICE_TYPE.ESTIMATED).length,
    cache_hits: cacheHits,
    providers_tried: [...providersTried],
    providers_failed: [...providersFailed],
    timestamp: new Date().toISOString(),
  });

  return results;
}

// Tolleranza sulla durata dell'offerta applicata: ZERO. L'utente ha detto
// quanti giorni ha a disposizione: un viaggio piu' lungo non e' quello che
// ha chiesto, anche se il prezzo e' buono.
const DURATION_TOLERANCE_DAYS = 0;

// Mutates a candidate result in place with a verified/cached offer: price,
// dates, trip length, recomputed lodging/total/savings, and price
// confidence fields. Shared by the cache-hit and fresh-provider-response
// paths so the two stay in sync. Returns false se l'offerta viola i vincoli
// (durata oltre tolleranza) e quindi NON va applicata.
function applyOffer(r, offer, req) {
  const dd = new Date(offer.departureDate + "T00:00:00Z");
  const rd = new Date(offer.returnDate + "T00:00:00Z");
  const days =
    !Number.isNaN(dd.getTime()) && !Number.isNaN(rd.getTime()) && rd > dd
      ? Math.round((rd - dd) / 86400000)
      : null;

  // Offerte reali ma incoerenti con la richiesta (es. min indipendenti di
  // andata/ritorno a settimane di distanza): non e' il viaggio chiesto,
  // anche se il prezzo e' buono. La destinazione resta fuori dal tabellone.
  if (days != null && days > req.max_days + DURATION_TOLERANCE_DAYS) {
    return false;
  }

  r.flight_price = Math.round(offer.price);
  r.departure_date = offer.departureDate;
  r.return_date = offer.returnDate;
  try {
    if (days != null && rd > dd) r.trip_days = days;
  } catch {
    /* keep existing trip_days on parse failure */
  }
  r.lodging_estimate = req.include_lodging ? r.daily_cost * r.trip_days : 0;
  r.total_cost = r.flight_price + r.lodging_estimate;
  r.savings = Math.round(req.budget - r.total_cost);
  r.price_type = offer.price_type;
  r.price_source = offer.price_source;
  r.price_checked_at = offer.price_checked_at;
  r.flight_details = offer.details
    ? { ...offer.details, airlineName: resolveAirlineName(offer.details.airlineCode) }
    : null;
}

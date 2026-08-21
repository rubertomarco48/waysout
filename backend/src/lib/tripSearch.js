import { AIRPORTS } from "../data/airports.js";
import { countryIt, resolveAirlineName } from "./tripLogic.js";
import { buildOriginPool, buildDestinationCandidate } from "./candidateGeneration.js";
import { passesPreliminaryBudget, computeValueScore, sortByValue } from "./ranking.js";
import { estimatedPriceInfo, offerPriceInfo, isSuspiciousPrice } from "./priceConfidence.js";
import { cacheKey, cacheGet, cacheSet } from "./cache.js";
import { getCheapestOffer } from "../providers/index.js";
import { logSearch } from "./db.js";
import {
  MAX_CANDIDATE_DESTINATIONS,
  MAX_VERIFIED_DESTINATIONS,
  VERIFICATION_TIMEOUT_MS,
  CACHE_TTL_LIVE_MS,
  CACHE_TTL_CACHED_MS,
  PRICE_TYPE,
} from "../config/constants.js";

function findAirport(code) {
  return AIRPORTS.find((a) => a.code === code) ?? null;
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

  // --- DISCOVERY: candidate destinations + candidate dates ---------------
  let candidates = [];
  for (const d of AIRPORTS) {
    if (d.code === origin.code) continue;
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

  // --- PRELIMINARY RANKING: cheapest-estimated first, cap payload --------
  candidates.sort((a, b) => a.total_cost - b.total_cost);
  candidates = candidates.slice(0, MAX_CANDIDATE_DESTINATIONS);

  // --- VERIFICATION: cache lookup, then real provider prices -------------
  // Best-effort, concurrent, across ALL configured providers - bounded by
  // MAX_VERIFIED_DESTINATIONS so a 90-day search window never multiplies
  // API calls (each destination is checked against exactly one candidate
  // date, the best one chosen during discovery).
  const toVerify = candidates.slice(0, MAX_VERIFIED_DESTINATIONS);
  const providersTried = new Set();
  const providersFailed = new Set();
  let cacheHits = 0;

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

        const { offer, tried, failed } = await getCheapestOffer(r.origin_code, r.dest_code, r.departure_date, r.return_date);
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

// Tolleranza sulla durata: un'offerta reale puo' discostarsi un po' dalla
// data candidata richiesta, ma non stravolgerla.
const DURATION_TOLERANCE_DAYS = 3;

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

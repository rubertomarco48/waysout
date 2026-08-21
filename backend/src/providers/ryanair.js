import axios from "axios";
import { cacheGet, cacheSet } from "../lib/cache.js";
import { CACHE_TTL_LIVE_MS } from "../config/constants.js";

// ---------------------------------------------------------------------------
// Ryanair "farfnd" (fare finder) provider.
//
// Non è un'API ufficiale/documentata - è l'endpoint JSON che il sito
// ryanair.com stessa chiama per popolare il suo fare finder. Nessuna API
// key richiesta, quindi `configured` è sempre true (disattivabile via env
// var RYANAIR_ENABLED=false se in futuro smettesse di funzionare o Ryanair
// la bloccasse). Restituisce prezzi reali dal loro motore, non una cache
// di terzi come Travelpayouts - per questo è taggato "verified" in
// config/constants.js, come Amadeus/Sky-scrapper/Kiwi.
//
// STRATEGIA DI RICERCA: quando tripSearch.js passa il contesto con la
// finestra UTENTE (windowFrom/windowTo), scarichiamo i prezzi giornalieri
// di TUTTI i mesi della finestra (endpoint oneWayFares/cheapestPerDay,
// uno per mese) e cerchiamo la COPPIA andata+ritorno dal totale piu'
// basso che rispetti i vincoli di durata [minDuration..maxDuration].
// Così troviamo il vero minimo della finestra ("conveniva partire il 12
// e tornare il 15"), non il minimo vicino a una data casuale.
//
// Senza contesto si usa il percorso storico: roundTripFares del mese
// candidato con finestra +/-3 giorni sull'andata.
//
// ATTENZIONE: endpoint non documentato ufficialmente, la forma cambia nel
// tempo. Verificato dal vivo il 21/08/2026 su STN->DUB (oneWay e roundTrip).
//
// NOTA VALUTA: SENZA parametro currency l'endpoint risponde con la valuta
// del geo-IP del chiamante (GBP da IP UK/USA): ~17% sottostimati trattati
// come euro. currency=EUR è SEMPRE passato.
// ---------------------------------------------------------------------------

const BASE_URL = "https://services-api.ryanair.com/farfnd/3";

const HEADERS = {
  // Alcuni endpoint "semi-pubblici" rifiutano richieste senza User-Agent da
  // browser: precauzione innocua.
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

function toMonthParam(isoDate) {
  return `${isoDate.slice(0, 7)}-01`;
}

// Somma/sottrae giorni a una data ISO yyyy-mm-dd (aritmetica UTC).
function shiftIso(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Data ISO di una tariffa: i nomi dei campi sono cambiati in passato
// (day vs arrivalDate vs departureDate), si provano piu' varianti.
function fareDate(fare, monthParam) {
  let date = fare.arrivalDate || fare.departureDate || fare.date || null;
  if (!date && fare.day) {
    const day = String(fare.day).padStart(2, "0");
    date = `${monthParam.slice(0, 7)}-${day}`;
  }
  return date ? String(date).slice(0, 10) : null;
}

// Elenco dei mesi yyyy-mm sovrapposti a [fromIso..toIso], con tetto di
// sicurezza per finestre assurde.
function monthsBetween(fromIso, toIso) {
  const out = [];
  const f = new Date(fromIso + "T00:00:00Z");
  const t = new Date(toIso + "T00:00:00Z");
  for (
    let d = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), 1);
    d <= t.getTime() && out.length < 12;
    d = Date.UTC(new Date(d).getUTCFullYear(), new Date(d).getUTCMonth() + 1, 1)
  ) {
    out.push(new Date(d).toISOString().slice(0, 7));
  }
  return out;
}

// Tariffe giornaliere usabili [{date, price}] di un mese, via oneWayFares
// (la lista giorni serve sia per l'andata sia per il ritorno). Memo per
// processo con TTL: nella stessa ricerca piu' rotte/candidati condividono
// gli stessi mesi senza rifare le chiamate.
const monthMemo = new Map();
const MONTH_MEMO_TTL_MS = 10 * 60 * 1000;

async function monthDayFares(origin, dest, month) {
  const key = `${origin}:${dest}:${month}`;
  const hit = monthMemo.get(key);
  if (hit && Date.now() - hit.ts < MONTH_MEMO_TTL_MS) return hit.fares;

  try {
    const { data, status } = await axios.get(`${BASE_URL}/oneWayFares/${origin}/${dest}/cheapestPerDay`, {
      params: { outboundMonthOfDate: toMonthParam(`${month}-01`), currency: "EUR" },
      headers: HEADERS,
      timeout: 10000,
      validateStatus: () => true,
    });

    let fares = [];
    if (status === 200 && Array.isArray(data?.outbound?.fares)) {
      fares = data.outbound.fares
        .filter((f) => f && !f.unavailable && !f.soldOut && f.price?.value != null)
        .map((f) => ({ date: fareDate(f, toMonthParam(`${month}-01`)), price: Number(f.price.value) }))
        .filter((x) => !!x.date);
    } else if (status !== 404) {
      console.warn(`Ryanair oneWay ${origin}->${dest} ${month}: HTTP ${status}`);
    }

    if (monthMemo.size > 500) monthMemo.clear();
    monthMemo.set(key, { ts: Date.now(), fares });
    return fares;
  } catch (e) {
    console.warn(`Ryanair oneWay error ${origin}->${dest} ${month}: ${e.message}`);
    return [];
  }
}

// Miglior coppia (andata, ritorno) per TOTALE minimo dentro la finestra
// utente, rispettando durata [minDur..maxDur] ed eventuali vincoli sul
// giorno di partenza (modalita' weekend = venerdi').
async function bestPairAcrossWindow(origin, dest, ctx) {
  const wf = ctx.windowFrom;
  const wt = ctx.windowTo;
  const minDur = Math.max(1, ctx.minDuration ?? 1);
  const maxDur = Math.max(minDur, ctx.maxDuration ?? minDur);

  const months = monthsBetween(wf, wt);
  if (!months.length) return null;

  const lists = await Promise.all(months.map((m) => monthDayFares(origin, dest, m)));
  const days = lists.flat();
  if (!days.length) return null;

  const weekday = ctx.requireDepartureWeekday ?? null;

  let bestPair = null;
  for (const out of days) {
    if (out.date < wf || out.date > wt) continue;
    if (weekday !== null && new Date(out.date + "T00:00:00Z").getUTCDay() !== weekday) continue;

    const retFrom = shiftIso(out.date, minDur);
    const retTo = shiftIso(out.date, maxDur);
    for (const ret of days) {
      if (ret.date < retFrom || ret.date > retTo) continue;
      const total = out.price + ret.price;
      if (!bestPair || total < bestPair.price) {
        bestPair = { price: total, out, ret };
      }
    }
  }
  return bestPair;
}

export const ryanair = {
  name: "ryanair",

  get configured() {
    return process.env.RYANAIR_ENABLED !== "false";
  },

  async cheapestOffer(origin, dest, depDate, retDate, context = {}) {
    try {
      // --- PERCORSO PREFERITO: vero minimo sulla finestra UTENTE ----------
      if (context?.windowFrom && context?.windowTo) {
        const pair = await bestPairAcrossWindow(origin, dest, context);
        if (pair) {
          return {
            price: pair.price,
            departureDate: pair.out.date,
            returnDate: pair.ret.date,
            details: {
              airlineCode: "FR",
              outbound: { departureTime: pair.out.date, arrivalTime: null, stops: 0, durationMinutes: null },
              inbound: { departureTime: pair.ret.date, arrivalTime: null, stops: 0, durationMinutes: null },
            },
          };
        }
        // Nessuna coppia nella finestra: rotta non servita da Ryanair in
        // quel periodo -> null (niente fallback stretto, sarebbe peggio).
        return null;
      }

      // --- FALLBACK STORICO: mese candidato, finestra +/-3 -----------------
      const outboundMonth = toMonthParam(depDate);
      const inboundMonth = toMonthParam(retDate);

      const { data, status } = await axios.get(`${BASE_URL}/roundTripFares/${origin}/${dest}/cheapestPerDay`, {
        params: {
          outboundMonthOfDate: outboundMonth,
          inboundMonthOfDate: inboundMonth,
          currency: "EUR",
        },
        headers: HEADERS,
        timeout: 10000,
        validateStatus: () => true,
      });

      if (status === 404) return null; // rotta non operata da Ryanair
      if (status !== 200) {
        console.warn(`Ryanair ${origin}->${dest}: HTTP ${status}`);
        return null;
      }

      const requestedDays = Math.max(
        1,
        Math.round((new Date(retDate + "T00:00:00Z") - new Date(depDate + "T00:00:00Z")) / 86400000)
      );
      const outboundFare = cheapestFareInWindow(
        data?.outbound,
        outboundMonth,
        shiftIso(depDate, -3),
        shiftIso(depDate, 3)
      );
      if (!outboundFare) return null;

      const inboundFare = cheapestFareInWindow(
        data?.inbound,
        inboundMonth,
        shiftIso(outboundFare.date, Math.max(1, requestedDays - 2)),
        shiftIso(outboundFare.date, requestedDays)
      );

      // Niente ritorno coerente -> niente offerta (niente sola-andata
      // travestita da round trip).
      if (!inboundFare) return null;

      return {
        price: outboundFare.price + inboundFare.price,
        departureDate: outboundFare.date,
        returnDate: inboundFare.date,
        details: {
          airlineCode: "FR",
          outbound: { departureTime: outboundFare.date, arrivalTime: null, stops: 0, durationMinutes: null },
          inbound: { departureTime: inboundFare.date, arrivalTime: null, stops: 0, durationMinutes: null },
        },
      };
    } catch (e) {
      console.warn(`Ryanair offer error ${origin}->${dest}: ${e.message}`);
      return null;
    }
  },
};

// Tariffa piu' economica la cui data cade nella finestra [fromIso..toIso]
// (usata solo dal fallback storico).
function cheapestFareInWindow(leg, monthParam, fromIso, toIso) {
  const fares = leg?.fares;
  if (!Array.isArray(fares)) return null;

  let best = null;
  for (const f of fares) {
    if (!f || f.unavailable || f.soldOut || f.price?.value == null) continue;
    const date = fareDate(f, monthParam);
    if (!date) continue;
    if (fromIso && date < fromIso) continue;
    if (toIso && date > toIso) continue;
    const price = Number(f.price.value);
    if (!best || price < best.price) best = { price, date };
  }
  return best;
}

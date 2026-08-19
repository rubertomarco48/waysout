import { CURATED, FALLBACK_IMAGES, COUNTRY_IT, AIRLINE_NAMES } from "../data/staticData.js";
import { deterministicOffset } from "./deterministic.js";

// Deterministic *fallback* round-trip price estimate, used when no live
// provider (Amadeus, etc.) returns a real price. Based on distance + a
// pseudo-random-but-stable noise term so the same route always estimates
// the same price.
export function fallbackFlightPrice(originCode, destCode, distanceKm) {
  const baseOneWay = 24 + distanceKm * 0.058;
  const noise = deterministicOffset(`${originCode}-${destCode}`, 55) - 15;
  const oneWay = Math.max(14, baseOneWay + noise);
  const discount = 0.86 + deterministicOffset(`${destCode}-${originCode}`, 10) / 100.0;
  return Math.round(oneWay * 2 * discount);
}

// Return { daily, days, tags, image } metadata for a destination airport.
export function destMeta(code, distanceKm) {
  if (CURATED[code]) {
    const c = CURATED[code];
    return { daily: c.daily, days: c.days, tags: c.tags, image: c.image };
  }
  let days;
  if (distanceKm < 400) days = 2;
  else if (distanceKm < 1500) days = 3;
  else if (distanceKm < 4000) days = 5;
  else days = 7;

  const daily = 45 + deterministicOffset(`daily-${code}`, 56); // 45-100 EUR/day
  const image = FALLBACK_IMAGES[deterministicOffset(`img-${code}`, FALLBACK_IMAGES.length)];
  return { daily, days, tags: [], image };
}

export function countryIt(name) {
  return COUNTRY_IT[name] ?? name;
}

// Resolves an IATA carrier code (e.g. "FR") to a friendly airline name
// ("Ryanair"), falling back to the raw code for airlines not in our map.
export function resolveAirlineName(code) {
  if (!code) return null;
  return AIRLINE_NAMES[code] ?? code;
}

// NOTE: la generazione delle date (candidate dates, finestra a 90 giorni,
// modalità weekend/range/flessibile) è stata spostata in
// candidateGeneration.js insieme alla logica di generazione delle
// destinazioni candidate, per separare chiaramente DISCOVERY da
// VERIFICATION (vedi tripSearch.js). Questo file mantiene solo le stime
// "pure" (prezzo, metadati destinazione) che non dipendono dalla pipeline.

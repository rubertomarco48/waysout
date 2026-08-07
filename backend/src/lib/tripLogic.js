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

function nextFriday(d) {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const offset = (4 - day + 7) % 7; // days until Friday (4)
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + offset);
  return out;
}

function addDays(d, days) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Returns { departureDate, returnDate, tripDays } (Date objects + number),
// mirroring compute_trip_dates() from the Python backend.
export function computeTripDates(req, destCode, baseDays, today) {
  if (req.date_mode === "weekend") {
    const wkOffset = deterministicOffset(`wk-${destCode}`, 6); // 0-5 weeks ahead
    const dep = addDays(nextFriday(addDays(today, 3)), wkOffset * 7);
    const tdays = Math.min(Math.max(baseDays, 2), 3); // 2-3 nights weekend
    return { departureDate: dep, returnDate: addDays(dep, tdays), tripDays: tdays };
  }

  if (req.date_mode === "range" && req.date_from && req.date_to) {
    try {
      let df = new Date(req.date_from + "T00:00:00Z");
      let dt = new Date(req.date_to + "T00:00:00Z");
      if (df < today) df = addDays(today, 1);
      if (dt <= df) dt = addDays(df, baseDays);
      const span = Math.round((dt - df) / 86400000);
      const tdays = span >= 1 ? Math.min(baseDays, span) : 1;
      const usable = span - tdays;
      const off = usable > 0 ? deterministicOffset(`rg-${destCode}`, usable + 1) : 0;
      const dep = addDays(df, off);
      return { departureDate: dep, returnDate: addDays(dep, tdays), tripDays: tdays };
    } catch {
      // fall through to standard mode below
    }
  }

  // standard: deterministic departure 30-75 days ahead
  const dep = addDays(today, 30 + deterministicOffset(`date-${destCode}`, 46));
  return { departureDate: dep, returnDate: addDays(dep, baseDays), tripDays: baseDays };
}

export { isoDate };

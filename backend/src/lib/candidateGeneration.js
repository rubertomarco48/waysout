import { haversine } from "./geo.js";
import { fallbackFlightPrice, destMeta } from "./tripLogic.js";
import { deterministicOffset } from "./deterministic.js";
import { MAX_SEARCH_DAYS, MAX_CANDIDATE_DATES, MIN_DEPARTURE_DAYS_AHEAD } from "../config/constants.js";

function addDays(d, days) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function nextFriday(d) {
  const day = d.getUTCDay(); // 0=Sun..6=Sat, Friday=5
  const offset = (5 - day + 7) % 7; // days until Friday
  return addDays(d, offset);
}

// Builds the pool of departure airports usable for a search: the chosen
// origin plus nearby same-country airports within nearby_radius_km.
export function buildOriginPool(origin, AIRPORTS, nearbyRadiusKm) {
  const pool = [];
  for (const a of AIRPORTS) {
    const d = haversine(origin.lat, origin.lon, a.lat, a.lon);
    const sameCountry = a.country === origin.country;
    if (a.code === origin.code || (d <= nearbyRadiusKm && sameCountry)) {
      pool.push({ ...a, origin_distance_km: Math.round(d) });
    }
  }
  pool.sort((a, b) => a.origin_distance_km - b.origin_distance_km);
  return pool;
}

// For a single destination airport, finds the cheapest-estimated departure
// airport from the pool (skipping same-metro-area "destinations" under
// 120km). Returns null if no viable departure exists in the pool.
export function bestDepartureFor(destAirport, pool) {
  let best = null;
  for (const ap of pool) {
    const dist = haversine(ap.lat, ap.lon, destAirport.lat, destAirport.lon);
    if (dist < 120) continue; // same metro area, not a real "destination"
    const price = fallbackFlightPrice(ap.code, destAirport.code, dist);
    if (best === null || price < best.price) {
      best = { ap, price, dist };
    }
  }
  return best;
}

// Generates candidate departure/return date pairs for a destination, within
// the MAX_SEARCH_DAYS window. Does NOT verify anything against providers -
// this is pure discovery. Only the first candidate is used for provider
// verification by tripSearch.js (kept flat: destinations x 1, not x N, so
// a 90-day window doesn't multiply API calls); the rest are returned too so
// a future "pick a different date" UI/feature has something to work with
// without re-deriving it.
export function generateCandidateDates(req, destCode, baseDays, today) {
  if (req.date_mode === "weekend") {
    const maxWeeksAhead = Math.max(1, Math.floor((MAX_SEARCH_DAYS - MIN_DEPARTURE_DAYS_AHEAD) / 7));
    const tdays = Math.min(Math.max(baseDays, 2), 3); // 2-3 nights weekend
    const count = Math.min(MAX_CANDIDATE_DATES, maxWeeksAhead);
    const weeks = pickDistinctOffsets(`wk-${destCode}`, maxWeeksAhead, count);
    return weeks.map((w) => {
      const dep = addDays(nextFriday(addDays(today, MIN_DEPARTURE_DAYS_AHEAD)), w * 7);
      return { departureDate: dep, returnDate: addDays(dep, tdays), tripDays: tdays };
    });
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
      return [{ departureDate: dep, returnDate: addDays(dep, tdays), tripDays: tdays }];
    } catch {
      // fall through to standard/flexible mode below
    }
  }

  // standard / flexible: sample several departure days spread across the
  // full MAX_SEARCH_DAYS window (was: a single date 30-75 days ahead).
  // Deterministic per-destination so repeated searches are stable.
  const span = MAX_SEARCH_DAYS - MIN_DEPARTURE_DAYS_AHEAD;
  const offsets = pickDistinctOffsets(`date-${destCode}`, span, MAX_CANDIDATE_DATES);
  return offsets.map((off) => {
    const dep = addDays(today, MIN_DEPARTURE_DAYS_AHEAD + off);
    return { departureDate: dep, returnDate: addDays(dep, baseDays), tripDays: baseDays };
  });
}

// Deterministically picks `count` distinct integers in [0, span) seeded by
// `seed`, sorted ascending. Falls back to fewer values if span is too small
// to yield `count` distinct offsets (e.g. very short weekend windows).
function pickDistinctOffsets(seed, span, count) {
  const safeSpan = Math.max(1, span);
  const picked = new Set();
  let i = 0;
  // Bounded loop: at most safeSpan attempts needed to fill a set of that
  // size, plus a small margin for hash collisions.
  while (picked.size < Math.min(count, safeSpan) && i < safeSpan * 3) {
    picked.add(deterministicOffset(`${seed}-${i}`, safeSpan));
    i += 1;
  }
  return [...picked].sort((a, b) => a - b);
}

// Full DISCOVERY step for one destination airport: departure airport,
// distance-based estimate, curated/derived metadata, and the primary
// candidate date. Returns null if the destination isn't reachable from the
// pool (see bestDepartureFor).
export function buildDestinationCandidate(req, destAirport, pool, today) {
  const best = bestDepartureFor(destAirport, pool);
  if (!best) return null;

  const { daily, days: suggDays, tags, image } = destMeta(destAirport.code, best.dist);
  const baseDays = Math.min(req.max_days, suggDays);
  const dateCandidates = generateCandidateDates(req, destAirport.code, baseDays, today);
  if (!dateCandidates.length) return null;

  const primary = dateCandidates[0];
  const lodging = req.include_lodging ? daily * primary.tripDays : 0;
  const total = best.price + lodging;

  return {
    dest_code: destAirport.code,
    origin_code: best.ap.code,
    origin_city: best.ap.city,
    city: destAirport.city,
    country: destAirport.country,
    image,
    tags,
    trip_days: primary.tripDays,
    flight_price: best.price,
    daily_cost: daily,
    lodging_estimate: lodging,
    total_cost: total,
    distance_km: Math.round(best.dist),
    origin_distance_km: best.ap.origin_distance_km,
    departure_date: isoDate(primary.departureDate),
    return_date: isoDate(primary.returnDate),
    date_candidates: dateCandidates.slice(1).map((c) => ({
      departure_date: isoDate(c.departureDate),
      return_date: isoDate(c.returnDate),
    })),
    flight_details: null,
  };
}

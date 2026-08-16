import { AIRPORTS } from "../data/airports.js";
import { haversine } from "./geo.js";
import { fallbackFlightPrice, destMeta, countryIt, computeTripDates, isoDate, resolveAirlineName } from "./tripLogic.js";
import { getCheapestOffer } from "../providers/index.js";
import { logSearch } from "./db.js";

function findAirport(code) {
  return AIRPORTS.find((a) => a.code === code) ?? null;
}

export async function searchTrips(req) {
  const origin = findAirport(req.origin);
  if (!origin) {
    const err = new Error("Aeroporto di partenza non valido");
    err.status = 400;
    throw err;
  }

  // Build a pool of departure airports: selected one + nearby airports in
  // the same country (within radius) to keep "nearby" options realistic.
  const pool = [];
  for (const a of AIRPORTS) {
    const d = haversine(origin.lat, origin.lon, a.lat, a.lon);
    const sameCountry = a.country === origin.country;
    if (a.code === origin.code || (d <= req.nearby_radius_km && sameCountry)) {
      pool.push({ ...a, origin_distance_km: Math.round(d) });
    }
  }
  pool.sort((a, b) => a.origin_distance_km - b.origin_distance_km);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let results = [];
  for (const d of AIRPORTS) {
    if (d.code === origin.code) continue;

    let best = null;
    for (const ap of pool) {
      const dist = haversine(ap.lat, ap.lon, d.lat, d.lon);
      if (dist < 120) continue; // same metro area, skip this departure option
      const price = fallbackFlightPrice(ap.code, d.code, dist);
      if (best === null || price < best.price) {
        best = { ap, price, dist };
      }
    }
    if (best === null) continue;

    const { daily, days: suggDays, tags, image } = destMeta(d.code, best.dist);
    const baseDays = Math.min(req.max_days, suggDays);
    const { departureDate, returnDate, tripDays } = computeTripDates(req, d.code, baseDays, today);
    const lodging = req.include_lodging ? daily * tripDays : 0;
    const total = best.price + lodging;
    if (total > req.budget) continue;

    results.push({
      dest_code: d.code,
      origin_code: best.ap.code,
      origin_city: best.ap.city,
      city: d.city,
      country: countryIt(d.country),
      image,
      tags,
      trip_days: tripDays,
      flight_price: best.price,
      daily_cost: daily,
      lodging_estimate: lodging,
      total_cost: total,
      savings: Math.round(req.budget - total),
      distance_km: Math.round(best.dist),
      origin_distance_km: best.ap.origin_distance_km,
      departure_date: isoDate(departureDate),
      return_date: isoDate(returnDate),
      price_source: "stima",
      // Real flight schedule (airline, times, stops) is only known once a
      // live provider responds - null here means "not available yet /
      // estimate only", the frontend shows a friendly fallback for that.
      flight_details: null,
    });
  }

  // Cheapest first, then cap the payload for performance & UX.
  results.sort((a, b) => a.total_cost - b.total_cost);
  results = results.slice(0, 80);

  // Enrich with real provider prices & dates (best-effort, concurrent,
  // across ALL configured providers - not just Amadeus).
  const top = results.slice(0, 24);
  await Promise.race([
    Promise.all(
      top.map(async (r) => {
        const offer = await getCheapestOffer(r.origin_code, r.dest_code, r.departure_date, r.return_date);
if (!offer) return;

// Sanity check: a real provider price that's wildly off from our
// distance-based estimate is more likely a bug (wrong currency,
// wrong unit, misparsed field) than a genuinely bizarre fare. We
// saw this happen for real (Travelpayouts returning RUB when EUR
// wasn't explicitly requested, inflating prices ~100x). Discard
// and keep the fallback estimate rather than show/propagate a
// broken number - log it so it's visible instead of silent.
const ratio = offer.price / Math.max(r.flight_price, 1);
if (ratio > 6 || ratio < 0.15) {
  console.warn(
    `Suspicious price from ${offer.source} for ${r.origin_code}->${r.dest_code}: ` +
      `${offer.price} vs estimate ${r.flight_price} (ratio ${ratio.toFixed(1)}x) - discarded`
      );
       return;
      }

        r.flight_price = Math.round(offer.price);
        r.departure_date = offer.departureDate;
        r.return_date = offer.returnDate;
        try {
          const dd = new Date(r.departure_date + "T00:00:00Z");
          const rd = new Date(r.return_date + "T00:00:00Z");
          if (rd > dd) r.trip_days = Math.round((rd - dd) / 86400000);
        } catch {
          /* keep existing trip_days on parse failure */
        }
        r.lodging_estimate = req.include_lodging ? r.daily_cost * r.trip_days : 0;
        r.total_cost = r.flight_price + r.lodging_estimate;
        r.savings = Math.round(req.budget - r.total_cost);
        r.price_source = offer.source;
        r.flight_details = offer.details
          ? { ...offer.details, airlineName: resolveAirlineName(offer.details.airlineCode) }
          : null;
      })
    ),
    new Promise((resolve) => setTimeout(resolve, 20000)), // 20s overall timeout, like asyncio.wait_for
  ]);

  // Keep only trips still within budget after real pricing.
  results = results.filter((r) => r.total_cost <= req.budget);
  results.sort((a, b) => a.total_cost - b.total_cost);

  logSearch({
    budget: req.budget,
    max_days: req.max_days,
    origin: req.origin,
    results_count: results.length,
    timestamp: new Date().toISOString(),
  });

  return results;
}

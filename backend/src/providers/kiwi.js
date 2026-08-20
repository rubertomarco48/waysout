import axios from "axios";

// ---------------------------------------------------------------------------
// Kiwi.com (Tequila API) flight-price provider.
//
// A LIVE search (not a cache, unlike Travelpayouts) - this is the provider
// most likely to fix "always shows estimated" once activated, since it
// doesn't depend on a specific date already having been searched by
// someone else. Implements the common provider interface used by
// src/providers/index.js:
//   - name: string
//   - configured: boolean
//   - cheapestOffer(origin, dest, depDate, retDate) -> { price, departureDate, returnDate, details } | null
//
// Setup once Kiwi grants API access:
//   1. Add KIWI_API_KEY=... to backend/.env (see .env.example)
//   2. Uncomment `kiwi` in src/providers/index.js's PROVIDERS array
//   3. Add "kiwi": PRICE_TYPE.VERIFIED to PROVIDER_PRICE_TYPE in
//      src/config/constants.js (it's a live search, like Amadeus/Sky-scrapper)
//
// Docs: https://tequila.kiwi.com/portal/docs/tequila_api/search_api
// NOTE: verify field names/response shape against current docs when you
// get access - Tequila's API has changed shape over the years and this
// was written from the last publicly documented version, not tested
// against a live key.
// ---------------------------------------------------------------------------

function toTequilaDate(isoDate) {
  // Tequila wants dd/mm/yyyy, we store dates as yyyy-mm-dd internally.
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function legFromRoute(routeSegments) {
  if (!routeSegments?.length) return null;
  const first = routeSegments[0];
  const last = routeSegments[routeSegments.length - 1];
  return {
    departureTime: first.local_departure ?? null,
    arrivalTime: last.local_arrival ?? null,
    stops: routeSegments.length - 1,
    durationMinutes: null, // computed below from duration.total if available
  };
}

export const kiwi = {
  name: "kiwi",

  get configured() {
    return Boolean(process.env.KIWI_API_KEY);
  },

  async cheapestOffer(origin, dest, depDate, retDate) {
    const apiKey = process.env.KIWI_API_KEY;
    if (!apiKey) return null;

    try {
      const { data, status } = await axios.get("https://api.tequila.kiwi.com/v2/search", {
        headers: { apikey: apiKey },
        params: {
          fly_from: origin,
          fly_to: dest,
          date_from: toTequilaDate(depDate),
          date_to: toTequilaDate(depDate),
          return_from: toTequilaDate(retDate),
          return_to: toTequilaDate(retDate),
          flight_type: "round",
          adults: 1,
          curr: "EUR",
          limit: 5,
          sort: "price",
        },
        timeout: 12000,
        validateStatus: () => true,
      });

      if (status !== 200) {
        console.warn(`Kiwi ${origin}->${dest}: HTTP ${status}`);
        return null;
      }

      const results = data?.data ?? [];
      if (!results.length) return null;

      const best = results.reduce((a, b) => (a.price <= b.price ? a : b));

      // `route` mixes outbound and inbound segments flagged by `return: 0|1`.
      const outboundLegs = (best.route ?? []).filter((r) => r.return === 0);
      const inboundLegs = (best.route ?? []).filter((r) => r.return === 1);

      const outbound = legFromRoute(outboundLegs);
      const inbound = inboundLegs.length ? legFromRoute(inboundLegs) : null;
      if (outbound) outbound.durationMinutes = best.duration?.departure ? Math.round(best.duration.departure / 60) : null;
      if (inbound) inbound.durationMinutes = best.duration?.return ? Math.round(best.duration.return / 60) : null;

      return {
        price: Number(best.price),
        departureDate: outbound?.departureTime?.slice(0, 10) ?? depDate,
        returnDate: inbound?.departureTime?.slice(0, 10) ?? retDate,
        details: {
          airlineCode: best.airlines?.[0] ?? null,
          outbound,
          inbound,
        },
      };
    } catch (e) {
      console.warn(`Kiwi offer error ${origin}->${dest}: ${e.message}`);
      return null;
    }
  },
};

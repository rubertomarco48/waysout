import { amadeus } from "./amadeus.js";
import { skyscrapper } from "./skyscrapper.js";
import { travelpayouts } from "./travelpayouts.js";
import { kiwi } from "./kiwi.js";
import { ryanair } from "./ryanair.js";
import { serpapiGoogleFlights } from "./serpapi_flights.js";

// ---------------------------------------------------------------------------
// PROVIDER REGISTRY
//
// To add a new flight-price source in the future (Kiwi Tequila, Skyscanner,
// Travelpayouts, etc.):
//
//   1. Create src/providers/<name>.js exporting an object with:
//        - name: string
//        - configured: boolean (true when its .env keys are set)
//        - async cheapestOffer(origin, dest, depDate, retDate)
//            -> { price, departureDate, returnDate } | null
//      (see amadeus.js for a full example)
//
//   2. Add its API key(s) to .env (see .env.example)
//
//   3. Import it here and add it to PROVIDERS below.
//
// Nothing else in the app needs to change - tripSearch.js just calls
// getCheapestOffer() and doesn't care how many providers are configured.
//
// `kiwi` is wired in but stays inert (configured === false) until
// KIWI_API_KEY is set in .env - safe to leave in the array as-is. Once you
// get a key, also tag it "verified" (live search) in config/constants.js's
// PROVIDER_PRICE_TYPE, same as amadeus/skyscrapper.
//
// `ryanair` needs no API key (semi-public fare-finder endpoint) so it's
// active by default - set RYANAIR_ENABLED=false in .env to disable it if
// it ever breaks or gets blocked. Its response parsing was written from
// third-party documentation, NOT verified against a live call (sandboxed
// network here can't reach ryanair.com) - test it for real before trusting
// it in production, see comments in ryanair.js.
//
// `serpapi-google-flights` is inert until SERPAPI_API_KEY is set - it's a
// PAID service billed per search (free tier size varies by source/plan,
// verify on your account), and a single user search can hit it up to
// MAX_VERIFIED_DESTINATIONS times. See cost warning in serpapi_flights.js
// before enabling in production.
// ---------------------------------------------------------------------------
export const PROVIDERS = [amadeus, skyscrapper, travelpayouts, kiwi, ryanair, serpapiGoogleFlights];

export function configuredProviders() {
  return PROVIDERS.filter((p) => p.configured);
}

// Queries all configured providers concurrently and returns the cheapest
// valid offer, plus telemetry about which providers were tried/failed (used
// for search analytics - see db.js logSearch). A provider "failing" means
// it returned null or threw (timeout, 401/403/429, malformed JSON, empty
// response) - none of that fails the overall search, callers just get a
// slightly smaller `valid` set to pick the cheapest from.
//
// The returned offer, when present, carries { price, departureDate,
// returnDate, source, details } - "details" (airline/times/stops) may be
// null if the provider couldn't extract it, callers must handle that.
export async function getCheapestOffer(origin, dest, depDate, retDate) {
  const active = configuredProviders();
  if (!active.length) return { offer: null, tried: [], failed: [] };

  const tried = active.map((p) => p.name);
  const failed = [];

  const offers = await Promise.all(
    active.map(async (p) => {
      try {
        const offer = await p.cheapestOffer(origin, dest, depDate, retDate);
        if (!offer) {
          failed.push(p.name);
          return null;
        }
        return { ...offer, source: p.name };
      } catch (e) {
        console.warn(`Provider ${p.name} threw: ${e.message}`);
        failed.push(p.name);
        return null;
      }
    })
  );

  const valid = offers.filter(Boolean);
  const offer = valid.length ? valid.reduce((a, b) => (a.price <= b.price ? a : b)) : null;
  return { offer, tried, failed };
}

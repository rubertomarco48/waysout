import { amadeus } from "./amadeus.js";
import { skyscrapper } from "./skyscrapper.js";

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
// ---------------------------------------------------------------------------
const PROVIDERS = [
  amadeus,
  skyscrapper,
  // kiwi,        // <- future: import { kiwi } from "./kiwi.js"
];

export function configuredProviders() {
  return PROVIDERS.filter((p) => p.configured);
}

// Queries all configured providers concurrently and returns the cheapest
// valid offer. Returns null if none are configured or none returned a price.
export async function getCheapestOffer(origin, dest, depDate, retDate) {
  const active = configuredProviders();
  if (!active.length) return null;

  const offers = await Promise.all(
    active.map(async (p) => {
      try {
        const offer = await p.cheapestOffer(origin, dest, depDate, retDate);
        return offer ? { ...offer, source: p.name } : null;
      } catch (e) {
        console.warn(`Provider ${p.name} threw: ${e.message}`);
        return null;
      }
    })
  );

  const valid = offers.filter(Boolean);
  if (!valid.length) return null;

  return valid.reduce((a, b) => (a.price <= b.price ? a : b));
}

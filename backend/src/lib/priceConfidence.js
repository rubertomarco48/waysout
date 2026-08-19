import {
  PRICE_TYPE,
  PROVIDER_PRICE_TYPE,
  PRICE_SANITY_RATIO_HIGH,
  PRICE_SANITY_RATIO_LOW,
} from "../config/constants.js";

export { PRICE_TYPE };

// Maps a provider's `source` name to the price_type the frontend should
// display. Unknown/future providers default to "cached" (conservative: we
// don't know their freshness guarantees, so we don't call them "verified").
export function priceTypeForSource(source) {
  return PROVIDER_PRICE_TYPE[source] ?? PRICE_TYPE.CACHED;
}

// Returns true if a provider price is wildly off from our distance-based
// estimate - more likely a bug (wrong currency, wrong unit, misparsed
// field) than a genuinely bizarre fare. Real incident: Travelpayouts
// returning RUB when EUR wasn't explicitly requested, inflating prices
// ~100x. Discarding these and keeping the fallback estimate is safer than
// showing/propagating a broken number.
export function isSuspiciousPrice(providerPrice, estimatePrice) {
  const ratio = providerPrice / Math.max(estimatePrice, 1);
  return ratio > PRICE_SANITY_RATIO_HIGH || ratio < PRICE_SANITY_RATIO_LOW;
}

// Builds the price-confidence fields attached to every result. Never claim
// "verified" for a value we haven't actually checked against a live source.
export function estimatedPriceInfo() {
  return {
    price_type: PRICE_TYPE.ESTIMATED,
    price_source: "distance_model",
    price_checked_at: null,
  };
}

// Called exactly once, at the moment a provider actually responds with a
// fresh offer (never when reusing a cached one - the cache already stores
// these fields from the original fetch, so re-tagging on a cache hit would
// falsely claim the price was just re-checked).
export function offerPriceInfo(source) {
  return {
    price_type: priceTypeForSource(source),
    price_source: source,
    price_checked_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Cache TTL-based per le offerte volo, per evitare di richiamare i provider
// per la stessa rotta/data/valuta più volte nella stessa finestra di
// freschezza. In-memory (Map), quindi si azzera a ogni deploy/restart -
// accettabile per un MVP; l'upgrade naturale è spostarla su una collection
// Mongo con TTL index (si veda README per la nota), riusando le stesse
// chiavi e la stessa shape del valore.
//
// Chiave: flight:{origin}:{destination}:{departureDate}:{returnDate}:
//         {passengers}:{currency}
// ---------------------------------------------------------------------------

const store = new Map();

export function cacheKey({ origin, destination, departureDate, returnDate, passengers = 1, currency = "EUR" }) {
  return `flight:${origin}:${destination}:${departureDate}:${returnDate}:${passengers}:${currency}`;
}

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function cacheStats() {
  return { size: store.size };
}

// Opportunistic cleanup so the Map doesn't grow unbounded between deploys
// on long-running processes. Not critical (Node process restarts reset it
// anyway on most deploy platforms), just tidy.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k);
  }
}, 5 * 60 * 1000);
sweeper.unref?.();

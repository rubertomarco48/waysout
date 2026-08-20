// ---------------------------------------------------------------------------
// Configurazione centralizzata del motore di ricerca.
//
// Tutti i limiti/finestre/soglie della pipeline vivono qui, invece di essere
// sparsi (e duplicati) tra tripSearch.js, tripLogic.js e i provider. Se in
// futuro serve alzare/abbassare un limite, si cambia in un solo posto.
//
// Ogni costante può essere sovrascritta via env var per tuning senza
// redeploy del codice (utile in produzione per abbassare MAX_PROVIDER
// se un provider inizia a rate-limitare).
// ---------------------------------------------------------------------------

function envInt(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function envFloat(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

// --- Finestra di ricerca -----------------------------------------------
// Massimo assoluto (in giorni da oggi) entro cui una ricerca "flessibile"
// (date_mode standard/weekend) può proporre una data di partenza.
export const MAX_SEARCH_DAYS = envInt("MAX_SEARCH_DAYS", 90);

// Non proporre mai partenze prima di questo numero di giorni (troppo
// ravvicinate per essere pianificabili/realistiche in una ricerca flessibile).
export const MIN_DEPARTURE_DAYS_AHEAD = envInt("MIN_DEPARTURE_DAYS_AHEAD", 3);

// --- Candidate generation -------------------------------------------------
// Quante date "candidate" generare per destinazione entro la finestra di
// MAX_SEARCH_DAYS. Non vengono verificate tutte: solo la migliore (indice 0)
// passa alla fase di verifica provider, le altre restano disponibili per
// eventuali espansioni future (es. selettore data nel dettaglio viaggio).
export const MAX_CANDIDATE_DATES = envInt("MAX_CANDIDATE_DATES", 5);

// Quante destinazioni candidate sopravvivono al ranking preliminare (prima
// ancora di pensare a interrogare i provider). Sostituisce il vecchio
// `results.slice(0, 80)` hardcoded.
export const MAX_CANDIDATE_DESTINATIONS = envInt("MAX_CANDIDATE_DESTINATIONS", 80);

// Quante di quelle vengono effettivamente verificate contro i provider
// esterni. Sostituisce il vecchio `results.slice(0, 24)` hardcoded. Questo
// è anche, di fatto, il numero massimo di "gruppi" di chiamate provider per
// ricerca (ogni destinazione verificata = 1 chiamata per provider attivo).
export const MAX_VERIFIED_DESTINATIONS = envInt("MAX_VERIFIED_DESTINATIONS", 24);

// Tetto assoluto di chiamate provider per singola ricerca (destinazioni
// verificate × provider attivi). Se superato, la verifica si ferma prima:
// protegge da bollette API impreviste se in futuro venissero aggiunti più
// provider o si alzasse MAX_VERIFIED_DESTINATIONS senza pensarci.
export const MAX_PROVIDER_REQUESTS = envInt("MAX_PROVIDER_REQUESTS", 96);

// --- Tolleranza sulla stima -------------------------------------------
// Una destinazione la cui stima supera il budget entro questa percentuale
// resta comunque candidata alla verifica (la stima può essere pessimista -
// vedi caso Budapest nel brief di refactoring). Oltre questa soglia, anche
// col beneficio del dubbio, non ha senso spendere una chiamata provider.
export const ESTIMATION_TOLERANCE = envFloat("ESTIMATION_TOLERANCE", 0.35);

// --- Sanity check prezzi provider ---------------------------------------
// Un prezzo reale del provider che si discosta troppo dalla stima locale è
// più probabilmente un bug (valuta sbagliata, unità sbagliata, campo
// misparsato - vedi incidente Travelpayouts RUB/EUR) che una tariffa
// genuinamente bizzarra. Viene scartato e si mantiene la stima.
export const PRICE_SANITY_RATIO_HIGH = envFloat("PRICE_SANITY_RATIO_HIGH", 6);
export const PRICE_SANITY_RATIO_LOW = envFloat("PRICE_SANITY_RATIO_LOW", 0.15);

// --- Timeout ------------------------------------------------------------
// Timeout complessivo della fase di verifica (tutti i provider, tutte le
// destinazioni in parallelo) - oltre questo tempo si restituisce quel che
// si ha, mantenendo le stime per chi non ha ancora risposto.
export const VERIFICATION_TIMEOUT_MS = envInt("VERIFICATION_TIMEOUT_MS", 20000);

// --- Cache ----------------------------------------------------------------
// TTL differenziati per tipo di dato: un prezzo "live" (Amadeus/Sky-scrapper)
// invecchia più in fretta di uno "cached" (Travelpayouts, che è già di per
// sé un dato osservato di recente e non una ricerca in tempo reale).
export const CACHE_TTL_LIVE_MS = envInt("CACHE_TTL_LIVE_MS", 15 * 60 * 1000); // 15 min
export const CACHE_TTL_CACHED_MS = envInt("CACHE_TTL_CACHED_MS", 6 * 60 * 60 * 1000); // 6h
export const CACHE_TTL_STATIC_MS = envInt("CACHE_TTL_STATIC_MS", 7 * 24 * 60 * 60 * 1000); // 7gg

// --- Price types ------------------------------------------------------
export const PRICE_TYPE = Object.freeze({
  VERIFIED: "verified",
  CACHED: "cached",
  ESTIMATED: "estimated",
  UNAVAILABLE: "unavailable",
});

// Quali provider producono dati "verified" (ricerca live) vs "cached"
// (dati osservati di recente ma non una ricerca in tempo reale per quella
// specifica data). Vedi backend/README.md per aggiungerne di nuovi.
export const PROVIDER_PRICE_TYPE = Object.freeze({
  amadeus: PRICE_TYPE.VERIFIED,
  skyscrapper: PRICE_TYPE.VERIFIED,
  travelpayouts: PRICE_TYPE.CACHED,
  kiwi: PRICE_TYPE.VERIFIED, // Tequila API = ricerca live, non cache
  ryanair: PRICE_TYPE.VERIFIED, // fare finder ufficiale ryanair.com
  "serpapi-google-flights": PRICE_TYPE.VERIFIED, // risultati Google Flights live via SerpApi
});

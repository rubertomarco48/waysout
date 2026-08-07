// Gestione del consenso cookie (GDPR/CCPA).
//
// Principio: i cookie "necessari" (indispensabili al funzionamento del
// sito, es. salvare questa stessa preferenza) sono sempre attivi e non
// richiedono consenso. Tutto il resto (analytics, marketing) è
// disattivato di default e richiede un'azione esplicita dell'utente
// (opt-in), come richiesto dal GDPR — non basta un "prosegui" implicito.
//
// waysout, allo stato attuale, non installa cookie di analytics o
// marketing: i toggle sotto servono a preparare il terreno per quando
// (se) verranno aggiunti strumenti come Google Analytics o pixel
// pubblicitari, così che restino spenti finché l'utente non acconsente.

const STORAGE_KEY = "waysout_cookie_consent";
const CONSENT_VERSION = 1;

export const DEFAULT_CONSENT = {
  version: CONSENT_VERSION,
  necessary: true, // sempre true, non disattivabile
  analytics: false,
  marketing: false,
  decidedAt: null, // null finché l'utente non ha fatto una scelta esplicita
};

export function getConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONSENT };
    const parsed = JSON.parse(raw);
    if (parsed.version !== CONSENT_VERSION) return { ...DEFAULT_CONSENT };
    return { ...DEFAULT_CONSENT, ...parsed };
  } catch {
    return { ...DEFAULT_CONSENT };
  }
}

export function hasDecided() {
  return getConsent().decidedAt !== null;
}

export function saveConsent(partial) {
  const next = {
    ...DEFAULT_CONSENT,
    ...partial,
    necessary: true,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage non disponibile (es. modalità privata): il banner
       ricomparirà alla prossima visita, comportamento accettabile */
  }
  window.dispatchEvent(new CustomEvent("waysout:consent-changed", { detail: next }));
  return next;
}

export const acceptAll = () => saveConsent({ analytics: true, marketing: true });
export const rejectNonEssential = () => saveConsent({ analytics: false, marketing: false });

export function hasAnalyticsConsent() {
  return getConsent().analytics === true;
}

export function hasMarketingConsent() {
  return getConsent().marketing === true;
}

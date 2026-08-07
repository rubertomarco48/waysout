import { useEffect, useState } from "react";
import { acceptAll, rejectNonEssential, saveConsent, getConsent, hasDecided } from "../lib/consent.js";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs] = useState(() => getConsent());

  useEffect(() => {
    setVisible(!hasDecided());
    function openPreferences() {
      setPrefs(getConsent());
      setExpanded(true);
      setVisible(true);
    }
    window.addEventListener("waysout:open-preferences", openPreferences);
    return () => window.removeEventListener("waysout:open-preferences", openPreferences);
  }, []);

  if (!visible) return null;

  function handleAcceptAll() {
    acceptAll();
    setVisible(false);
  }

  function handleRejectAll() {
    rejectNonEssential();
    setVisible(false);
  }

  function handleSavePrefs() {
    saveConsent({ analytics: prefs.analytics, marketing: prefs.marketing });
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Preferenze cookie"
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-night-600 bg-night-800 shadow-2xl shadow-black/50 p-5 sm:p-6">
        <p className="text-sm text-mist-300">
          Usiamo cookie tecnici necessari al funzionamento di waysout. Con il tuo consenso, potremmo
          usare anche cookie di analisi statistica e marketing per migliorare il servizio — ma
          restano spenti finché non li attivi tu.{" "}
          <span className="text-mist-400">
            Maggiori informazioni nella nostra Cookie Policy.
          </span>
        </p>

        {expanded && (
          <div className="mt-4 space-y-3 border-t border-night-600 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-mist-300">Necessari</p>
                <p className="text-xs text-mist-400">
                  Indispensabili per far funzionare il sito e ricordare questa scelta. Sempre attivi.
                </p>
              </div>
              <input type="checkbox" checked disabled className="mt-1 w-4 h-4 accent-night-500" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-mist-300">Analisi statistica</p>
                <p className="text-xs text-mist-400">
                  Ci aiutano a capire come viene usato il sito, in forma aggregata.
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefs.analytics}
                onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
                className="mt-1 w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-mist-300">Marketing</p>
                <p className="text-xs text-mist-400">
                  Per eventuali contenuti o offerte personalizzate. Non attivi al momento.
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefs.marketing}
                onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
                className="mt-1 w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAcceptAll}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 text-night-950 font-semibold px-5 py-2.5 text-sm transition-colors font-display"
          >
            Accetta tutti
          </button>
          <button
            type="button"
            onClick={handleRejectAll}
            className="rounded-lg border border-night-600 hover:border-amber-600/50 text-mist-300 px-5 py-2.5 text-sm transition-colors"
          >
            Rifiuta non necessari
          </button>
          {expanded ? (
            <button
              type="button"
              onClick={handleSavePrefs}
              className="rounded-lg border border-night-600 hover:border-amber-600/50 text-mist-300 px-5 py-2.5 text-sm transition-colors"
            >
              Salva preferenze
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-sm text-amber-400 hover:text-amber-300 underline decoration-dotted px-2"
            >
              Personalizza
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

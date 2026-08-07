import { useEffect } from "react";
import { COOKIE_POLICY, TERMS } from "../lib/legalContent.js";

const DOCS = {
  cookie: { title: "Cookie Policy", body: COOKIE_POLICY },
  terms: { title: "Termini & Condizioni", body: TERMS },
};

export default function LegalModal({ doc, onClose }) {
  useEffect(() => {
    if (!doc) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [doc, onClose]);

  if (!doc || !DOCS[doc]) return null;
  const { title, body } = DOCS[doc];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-night-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-night-600 bg-night-800 shadow-2xl shadow-black/50 flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-night-600">
          <h2 className="font-display text-lg font-semibold text-mist-300">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="text-mist-400 hover:text-amber-400 transition-colors p-1"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 text-sm text-mist-300 whitespace-pre-line leading-relaxed">
          {body}
        </div>
      </div>
    </div>
  );
}

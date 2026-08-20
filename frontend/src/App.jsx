import { useEffect, useState } from "react";
import NavBar from "./components/NavBar.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import ResultsBoard from "./components/ResultsBoard.jsx";
import CookieConsentBanner from "./components/CookieConsentBanner.jsx";
import LegalModal from "./components/LegalModal.jsx";
import { getAirports, searchTrips } from "./lib/api.js";

export default function App() {
  const [popularAirports, setPopularAirports] = useState([]);
  const [form, setForm] = useState({
    originAirport: null,
    budget: 300,
    maxDays: 4,
    nearbyRadiusKm: 250,
    includeLodging: true,
    dateMode: "standard", // "standard" | "weekend" | "range"
    dateFrom: null,
    dateTo: null,
  });
  const [legalOpen, setLegalOpen] = useState(null); // null | "cookie" | "terms"
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    getAirports().then(setPopularAirports).catch(() => setPopularAirports([]));
  }, []);

  async function handleSearch() {
    if (!form.originAirport) return;
    if (form.dateMode === "range" && (!form.dateFrom || !form.dateTo)) {
      setError("Seleziona una data di inizio e una di fine per il range.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await searchTrips({
        budget: form.budget,
        max_days: form.maxDays,
        origin: form.originAirport.code,
        include_lodging: form.includeLodging,
        nearby_radius_km: form.nearbyRadiusKm,
        date_mode: form.dateMode,
        date_from: form.dateMode === "range" ? form.dateFrom : null,
        date_to: form.dateMode === "range" ? form.dateTo : null,
      });
      setResults(data);
    } catch (e) {
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }

  return (
    <div className="relative min-h-screen text-mist-300">
      {/* Fixed background photo behind the entire page, with a dark scrim
          (same night palette as before) so text stays legible while
          scrolling past it. */}
      <div className="fixed inset-0 -z-10">
        <img
          src="/brand/hero-bg.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-night-900/80" />
        <div className="absolute inset-0 bg-gradient-to-b from-night-950/70 via-night-900/85 to-night-900" />
      </div>

      {/* Subtle top accent line, like a board's status strip */}
      <div className="h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />

      <NavBar />

      <header className="max-w-5xl mx-auto px-6 pt-10 pb-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-500 mb-4 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Partenze — ricerca al contrario
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-mist-300 leading-tight">
          Non dirmi dove.
          <br />
          <span className="text-amber-400">Dimmi quanto vuoi spendere.</span>
        </h1>
        <p className="mt-4 text-mist-400 max-w-xl">
          Imposta il tuo budget e i giorni a disposizione: WaysOut scandaglia le destinazioni
          raggiungibili e le ordina come un tabellone partenze — dalla più economica in su.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-24">
        <SearchPanel
          form={form}
          setForm={setForm}
          popularAirports={popularAirports}
          onSearch={handleSearch}
          loading={loading}
        />

        <div className="mt-10">
          <ResultsBoard results={results} loading={loading} error={error} hasSearched={hasSearched} />
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 pb-10 text-center text-xs text-mist-400 font-mono">
        <p>WaysOut — dati voli forniti da Amadeus, Sky-scrapper e Travelpayouts, con stime locali quando non disponibili</p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setLegalOpen("cookie")}
            className="underline decoration-dotted hover:text-amber-400 transition-colors"
          >
            Cookie Policy
          </button>
          <span className="text-night-600">·</span>
          <button
            type="button"
            onClick={() => setLegalOpen("terms")}
            className="underline decoration-dotted hover:text-amber-400 transition-colors"
          >
            Termini &amp; Condizioni
          </button>
          <span className="text-night-600">·</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("waysout:open-preferences"))}
            className="underline decoration-dotted hover:text-amber-400 transition-colors"
          >
            Preferenze cookie
          </button>
        </div>
      </footer>

      <LegalModal doc={legalOpen} onClose={() => setLegalOpen(null)} />
      <CookieConsentBanner />
    </div>
  );
}

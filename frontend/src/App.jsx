import { useEffect, useState } from "react";
import SearchPanel from "./components/SearchPanel.jsx";
import ResultsBoard from "./components/ResultsBoard.jsx";
import { getAirports, searchTrips } from "./lib/api.js";

export default function App() {
  const [popularAirports, setPopularAirports] = useState([]);
  const [form, setForm] = useState({
    originAirport: null,
    budget: 300,
    maxDays: 4,
    nearbyRadiusKm: 250,
    includeLodging: true,
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    getAirports().then(setPopularAirports).catch(() => setPopularAirports([]));
  }, []);

  async function handleSearch() {
    if (!form.originAirport) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchTrips({
        budget: form.budget,
        max_days: form.maxDays,
        origin: form.originAirport.code,
        include_lodging: form.includeLodging,
        nearby_radius_km: form.nearbyRadiusKm,
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
    <div className="min-h-screen bg-night-900 text-mist-300">
      {/* Subtle top accent line, like a board's status strip */}
      <div className="h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />

      <header className="max-w-5xl mx-auto px-6 pt-14 pb-10">
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
          Imposta il tuo budget e i giorni a disposizione: waysout scandaglia le destinazioni
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
        waysout — dati voli forniti da Amadeus e Sky-scrapper
      </footer>
    </div>
  );
}

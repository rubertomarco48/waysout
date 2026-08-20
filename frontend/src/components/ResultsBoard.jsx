import { useMemo, useState } from "react";
import ResultCard from "./ResultCard.jsx";
import TripDetailModal from "./TripDetailModal.jsx";

const SORT_OPTIONS = [
  { id: "value", label: "Miglior valore" },
  { id: "cheapest", label: "Più economico" },
  { id: "cheapest_verified", label: "Più economico verificato" },
];

function isVerifiedish(trip) {
  return trip.price_type === "verified" || trip.price_type === "cached";
}

function sortResults(results, sortMode) {
  if (sortMode === "cheapest") {
    return [...results].sort((a, b) => a.total_cost - b.total_cost);
  }
  if (sortMode === "cheapest_verified") {
    return results.filter(isVerifiedish).sort((a, b) => a.total_cost - b.total_cost);
  }
  // "value" - valueScore desc, price asc as tiebreak (mirrors backend default).
  return [...results].sort((a, b) => (b.value_score ?? 0) - (a.value_score ?? 0) || a.total_cost - b.total_cost);
}

export default function ResultsBoard({ results, loading, error, hasSearched }) {
  const [selected, setSelected] = useState(null);
  const [sortMode, setSortMode] = useState("value");

  const sorted = useMemo(() => sortResults(results, sortMode), [results, sortMode]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-6 py-5 text-red-300">
        <p className="font-semibold mb-1">La ricerca non è andata a buon fine</p>
        <p className="text-sm text-red-300/80">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl border border-night-700 bg-night-800/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (hasSearched && results.length === 0) {
    return (
      <div className="rounded-xl border border-night-600 bg-night-800/40 px-6 py-10 text-center">
        <p className="font-display text-lg text-mist-300 mb-1">Nessuna destinazione entro budget</p>
        <p className="text-sm text-mist-400">Prova ad alzare il budget o allargare il raggio di partenza.</p>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="rounded-xl border border-dashed border-night-600 px-6 py-14 text-center">
        <p className="font-display text-lg text-mist-300 mb-1">Il tabellone è ancora vuoto</p>
        <p className="text-sm text-mist-400">Imposta budget e giorni, poi cerca le destinazioni raggiungibili.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortMode(opt.id)}
              aria-pressed={sortMode === opt.id}
              className={`rounded-md px-3 py-1.5 text-xs font-mono border transition-colors ${
                sortMode === opt.id
                  ? "bg-amber-500 border-amber-500 text-night-950 font-semibold"
                  : "bg-night-700 border-night-600 text-mist-300 hover:border-amber-600/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-mist-400 font-mono">{sorted.length} destinazioni</span>
      </div>

      {sortMode === "cheapest_verified" && sorted.length === 0 ? (
        <div className="rounded-xl border border-night-600 bg-night-800/40 px-6 py-10 text-center">
          <p className="font-display text-lg text-mist-300 mb-1">Nessun prezzo verificato ancora</p>
          <p className="text-sm text-mist-400">
            Nessun fornitore ha confermato un prezzo reale per queste destinazioni — prova "Miglior valore" o "Più
            economico".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map((trip, i) => (
            <ResultCard
              key={`${trip.origin_code}-${trip.dest_code}`}
              trip={trip}
              index={i}
              onOpen={setSelected}
            />
          ))}
        </div>
      )}
      <TripDetailModal trip={selected} onClose={() => setSelected(null)} />
    </>
  );
}

import { useState } from "react";
import ResultCard from "./ResultCard.jsx";
import TripDetailModal from "./TripDetailModal.jsx";

export default function ResultsBoard({ results, loading, error, hasSearched }) {
  const [selected, setSelected] = useState(null);

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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {results.map((trip, i) => (
          <ResultCard
            key={`${trip.origin_code}-${trip.dest_code}`}
            trip={trip}
            index={i}
            onOpen={setSelected}
          />
        ))}
      </div>
      <TripDetailModal trip={selected} onClose={() => setSelected(null)} />
    </>
  );
}

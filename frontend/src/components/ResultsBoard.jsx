import ResultRow from "./ResultRow.jsx";

export default function ResultsBoard({ results, loading, error, hasSearched }) {
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
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[84px] rounded-xl border border-night-700 bg-night-800/30 animate-pulse" />
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
    <div>
      <div className="hidden lg:grid grid-cols-[100px_1fr_auto_auto_auto] gap-6 px-5 pb-2 text-[10px] uppercase tracking-widest text-mist-400">
        <div />
        <div>Destinazione</div>
        <div className="text-right">Volo</div>
        <div className="text-right">Alloggio</div>
        <div className="text-right">Totale</div>
      </div>
      <div className="space-y-3">
        {results.map((trip, i) => (
          <ResultRow key={`${trip.origin_code}-${trip.dest_code}`} trip={trip} index={i} />
        ))}
      </div>
    </div>
  );
}

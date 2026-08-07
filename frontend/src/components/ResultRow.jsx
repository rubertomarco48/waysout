function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export default function ResultRow({ trip, index }) {
  return (
    <div
      className="animate-flap group grid grid-cols-[auto_1fr_auto] lg:grid-cols-[100px_1fr_auto_auto_auto] items-center gap-4 lg:gap-6 rounded-xl border border-night-600 bg-night-800/50 hover:bg-night-800 hover:border-amber-600/40 transition-colors px-5 py-4"
      style={{ animationDelay: `${Math.min(index * 35, 400)}ms` }}
    >
      {/* Destination image */}
      <div className="hidden lg:block w-[100px] h-[68px] rounded-lg overflow-hidden bg-night-700 shrink-0">
        {trip.image && (
          <img src={trip.image} alt={trip.city} className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>

      {/* City / country / codes */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display font-semibold text-lg text-mist-300 truncate">{trip.city}</h3>
          <span className="text-mist-400 text-sm truncate">{trip.country}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 font-mono text-xs text-mist-400">
          <span className="text-amber-500">{trip.origin_code}</span>
          <span>→</span>
          <span className="text-amber-500">{trip.dest_code}</span>
          <span className="text-night-500">·</span>
          <span>{fmtDate(trip.departure_date)} – {fmtDate(trip.return_date)}</span>
          <span className="text-night-500">·</span>
          <span>{trip.trip_days}g</span>
        </div>
        {trip.tags?.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {trip.tags.map((t) => (
              <span key={t} className="text-[10px] uppercase tracking-wide text-mist-400 border border-night-600 rounded px-1.5 py-0.5">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Flight price */}
      <div className="text-right hidden lg:block">
        <div className="text-[10px] uppercase tracking-widest text-mist-400">Volo</div>
        <div className="font-mono text-mist-300">€{trip.flight_price}</div>
      </div>

      {/* Lodging */}
      <div className="text-right hidden lg:block">
        <div className="text-[10px] uppercase tracking-widest text-mist-400">Alloggio</div>
        <div className="font-mono text-mist-300">
          {trip.lodging_estimate > 0 ? `€${trip.lodging_estimate}` : "—"}
        </div>
      </div>

      {/* Total + savings */}
      <div className="text-right">
        <div className="font-mono font-semibold text-xl text-amber-400">€{trip.total_cost}</div>
        {trip.savings > 0 && (
          <div className="text-xs font-mono text-savings">risparmi €{trip.savings}</div>
        )}
        <div className="text-[9px] uppercase tracking-wide text-mist-400 mt-0.5">
          {trip.price_source === "stima" ? "prezzo stimato" : trip.price_source}
        </div>
      </div>
    </div>
  );
}

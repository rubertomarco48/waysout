function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export default function ResultCard({ trip, index, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(trip)}
      style={{ animationDelay: `${Math.min(index * 35, 400)}ms` }}
      className="animate-flap group relative flex flex-col justify-end aspect-[4/5] rounded-2xl overflow-hidden border border-night-600 bg-night-800 text-left hover:border-amber-600/50 hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      {/* Background image */}
      {trip.image && (
        <img
          src={trip.image}
          alt={trip.city}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      {/* Gradient scrim for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/45 to-night-950/5" />

      {/* Savings badge */}
      {trip.savings > 0 && (
        <span className="absolute top-3 right-3 rounded-full bg-savings/90 text-night-950 text-[10px] font-mono font-semibold px-2 py-1">
          risparmi €{trip.savings}
        </span>
      )}

      {/* Content */}
      <div className="relative p-4">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display font-semibold text-lg text-white truncate">{trip.city}</h3>
        </div>
        <p className="text-mist-300 text-xs truncate">{trip.country}</p>

        <div className="flex items-center gap-2 mt-2 font-mono text-[11px] text-mist-300">
          <span className="text-amber-400">{trip.origin_code}</span>
          <span>→</span>
          <span className="text-amber-400">{trip.dest_code}</span>
          <span className="text-night-500">·</span>
          <span>{fmtDate(trip.departure_date)} – {fmtDate(trip.return_date)}</span>
        </div>

        {trip.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {trip.tags.map((t) => (
              <span
                key={t}
                className="text-[9px] uppercase tracking-wide text-mist-300 border border-white/20 rounded px-1.5 py-0.5 backdrop-blur-sm"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end justify-between mt-3 pt-3 border-t border-white/10">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-mist-400">Totale</div>
            <div className="font-mono font-semibold text-xl text-amber-400">€{trip.total_cost}</div>
          </div>
          <div className="text-right text-[10px] text-mist-400 font-mono">
            <div>volo €{trip.flight_price}</div>
            {trip.lodging_estimate > 0 && <div>alloggio €{trip.lodging_estimate}</div>}
          </div>
        </div>
      </div>
    </button>
  );
}

import { useEffect } from "react";
import { buildAviasalesBookingLink } from "../lib/affiliate.js";

function fmtDateLong(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });
}

function fmtTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(minutes) {
  if (!minutes && minutes !== 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m ? ` ${m}m` : ""}`;
}

function stopsLabel(stops) {
  if (stops === null || stops === undefined) return null;
  if (stops === 0) return "Diretto";
  return stops === 1 ? "1 scalo" : `${stops} scali`;
}

function LegRow({ title, leg }) {
  if (!leg) return null;
  const dep = fmtTime(leg.departureTime);
  const arr = fmtTime(leg.arrivalTime);
  const duration = fmtDuration(leg.durationMinutes);
  const stops = stopsLabel(leg.stops);

  return (
    <div className="rounded-lg border border-night-600 bg-night-800/60 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-mist-400 mb-1.5">{title}</div>
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-mist-300">
          {dep ?? "—"} <span className="text-mist-400">→</span> {arr ?? "—"}
        </div>
        {duration && <div className="text-xs text-mist-400 font-mono">{duration}</div>}
      </div>
      {stops && (
        <div
          className={`mt-1.5 inline-block text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${
            leg.stops === 0 ? "text-savings border border-savings/40" : "text-amber-400 border border-amber-600/40"
          }`}
        >
          {stops}
        </div>
      )}
    </div>
  );
}

export default function TripDetailModal({ trip, onClose }) {
  useEffect(() => {
    if (!trip) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [trip, onClose]);

  if (!trip) return null;
  const fd = trip.flight_details;
  const bookingLink = buildAviasalesBookingLink(trip);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-night-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Dettagli viaggio a ${trip.city}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-night-600 bg-night-800 shadow-2xl shadow-black/50"
      >
        {/* Header image */}
        <div className="relative h-44">
          {trip.image && (
            <img src={trip.image} alt={trip.city} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-night-800 via-night-800/20 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="absolute top-3 right-3 rounded-full bg-night-950/60 hover:bg-night-950/90 text-mist-300 hover:text-amber-400 transition-colors p-1.5 backdrop-blur-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
          <div className="absolute bottom-3 left-5 right-5">
            <h2 className="font-display text-2xl font-bold text-white">{trip.city}</h2>
            <p className="text-mist-300 text-sm">{trip.country}</p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Route + dates */}
          <div className="flex items-center justify-between font-mono text-sm text-mist-300">
            <span>
              <span className="text-amber-400">{trip.origin_code}</span> ({trip.origin_city})
              <span className="mx-2 text-mist-400">→</span>
              <span className="text-amber-400">{trip.dest_code}</span>
            </span>
            <span className="text-mist-400">{trip.trip_days}g</span>
          </div>
          <div className="flex items-center justify-between text-xs text-mist-400 -mt-3">
            <span>{fmtDateLong(trip.departure_date)}</span>
            <span>{fmtDateLong(trip.return_date)}</span>
          </div>

          {/* Airline + flight legs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-widest text-mist-400">Volo</h3>
              {fd?.airlineName && (
                <span className="text-sm font-semibold text-mist-300">{fd.airlineName}</span>
              )}
            </div>

            {fd ? (
              <div className="space-y-2">
                <LegRow title="Andata" leg={fd.outbound} />
                <LegRow title="Ritorno" leg={fd.inbound} />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-night-600 px-4 py-3 text-xs text-mist-400">
                Compagnia, orari e scali non ancora disponibili per questa rotta — il prezzo mostrato
                è una stima. I dettagli reali compaiono quando un fornitore voli (Amadeus,
                Sky-scrapper) risponde per questa destinazione.
              </div>
            )}
          </div>

          {/* Price breakdown */}
          <div>
            <h3 className="text-xs uppercase tracking-widest text-mist-400 mb-2">Costo</h3>
            <div className="rounded-lg border border-night-600 divide-y divide-night-600 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-mist-400">Volo</span>
                <span className="font-mono text-mist-300">€{trip.flight_price}</span>
              </div>
              {trip.lodging_estimate > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-mist-400">Alloggio (stima)</span>
                  <span className="font-mono text-mist-300">€{trip.lodging_estimate}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-night-700/40">
                <span className="text-mist-300 font-semibold">Totale</span>
                <span className="font-mono font-semibold text-amber-400">€{trip.total_cost}</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-mist-400">
              {trip.price_source === "stima"
                ? "prezzo stimato"
                : trip.price_source === "travelpayouts"
                  ? "prezzo reale osservato di recente — confermato su Aviasales"
                  : `fonte: ${trip.price_source}`}
            </p>
          </div>

          {/* Prenotazione (link affiliato) */}
          {bookingLink && (
            <a
              href={bookingLink}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-amber-500 hover:bg-amber-400 text-night-950 font-semibold text-sm px-4 py-3 font-display transition-colors"
            >
              Cerca voli per {trip.city}
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 9H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" />
              </svg>
            </a>
          )}
          <p className="text-[10px] text-mist-400 text-center -mt-3">
            Ti porta su Aviasales per completare l'acquisto — prezzo finale e disponibilità si
            confermano lì
          </p>
        </div>
      </div>
    </div>
  );
}

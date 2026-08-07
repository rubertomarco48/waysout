import { useEffect, useRef, useState } from "react";
import { searchAirports, getNearestAirports } from "../lib/api.js";

export default function AirportAutocomplete({ value, onChange, popularAirports }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setOptions(popularAirports);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const results = await searchAirports(query);
        setOptions(results);
      } catch {
        setOptions([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, popularAirports]);

  function pick(airport) {
    onChange(airport);
    setQuery("");
    setOpen(false);
  }

  async function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const nearest = await getNearestAirports(pos.coords.latitude, pos.coords.longitude);
          if (nearest[0]) pick(nearest[0]);
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false)
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <label className="block text-xs uppercase tracking-widest text-mist-400 mb-2">Partenza</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-lg border border-night-600 bg-night-800 px-4 py-3 text-left hover:border-amber-600/50 transition-colors"
      >
        {value ? (
          <span className="font-mono">
            <span className="text-amber-500 font-semibold">{value.code}</span>
            <span className="text-mist-300 ml-2">{value.city}</span>
          </span>
        ) : (
          <span className="text-mist-400">Seleziona aeroporto</span>
        )}
        <svg className="w-4 h-4 text-mist-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.9l3.71-3.67a.75.75 0 111.06 1.06l-4.24 4.2a.75.75 0 01-1.06 0l-4.24-4.2a.75.75 0 01.02-1.06z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-night-600 bg-night-800 shadow-xl shadow-black/40 overflow-hidden">
          <div className="p-2 border-b border-night-600">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca città o codice IATA..."
              className="w-full bg-night-700 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-mist-400"
            />
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-400 hover:bg-night-700 transition-colors border-b border-night-600"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2.5a.75.75 0 01-.75-.75v-.038a5.503 5.503 0 01-4.712-4.712H4.5a.75.75 0 010-1.5h.038A5.503 5.503 0 019.25 3.788V3.75a.75.75 0 011.5 0v.038a5.503 5.503 0 014.712 4.712h.038a.75.75 0 010 1.5h-.038a5.503 5.503 0 01-4.712 4.712v.038a.75.75 0 01-.75.75zM10 6.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" clipRule="evenodd" />
            </svg>
            {locating ? "Localizzazione in corso..." : "Usa la mia posizione"}
          </button>
          <ul className="max-h-64 overflow-y-auto">
            {options.length === 0 && (
              <li className="px-4 py-3 text-sm text-mist-400">Nessun risultato</li>
            )}
            {options.map((a) => (
              <li key={a.code}>
                <button
                  type="button"
                  onClick={() => pick(a)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-night-700 transition-colors text-left"
                >
                  <span>
                    <span className="text-mist-300">{a.city}</span>
                    <span className="text-mist-400 ml-1">— {a.name}</span>
                  </span>
                  <span className="font-mono text-amber-500 text-xs">{a.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

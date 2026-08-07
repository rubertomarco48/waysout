import AirportAutocomplete from "./AirportAutocomplete.jsx";

export default function SearchPanel({ form, setForm, popularAirports, onSearch, loading }) {
  return (
    <div className="rounded-2xl border border-night-600 bg-night-800/60 backdrop-blur p-6 lg:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:items-end">
        <AirportAutocomplete
          value={form.originAirport}
          onChange={(a) => setForm((f) => ({ ...f, originAirport: a }))}
          popularAirports={popularAirports}
        />

        <div>
          <label className="flex items-baseline justify-between text-xs uppercase tracking-widest text-mist-400 mb-2">
            <span>Budget</span>
            <span className="font-mono text-amber-500 text-sm normal-case">€{form.budget}</span>
          </label>
          <input
            type="range"
            min="50"
            max="1500"
            step="10"
            value={form.budget}
            onChange={(e) => setForm((f) => ({ ...f, budget: Number(e.target.value) }))}
            className="w-full accent-amber-500"
          />
        </div>

        <div>
          <label className="flex items-baseline justify-between text-xs uppercase tracking-widest text-mist-400 mb-2">
            <span>Durata max</span>
            <span className="font-mono text-amber-500 text-sm normal-case">
              {form.maxDays} {form.maxDays === 1 ? "giorno" : "giorni"}
            </span>
          </label>
          <input
            type="range"
            min="1"
            max="21"
            step="1"
            value={form.maxDays}
            onChange={(e) => setForm((f) => ({ ...f, maxDays: Number(e.target.value) }))}
            className="w-full accent-amber-500"
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-xs uppercase tracking-widest text-mist-400 mb-2">Quando</label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "standard", label: "Flessibile" },
            { id: "weekend", label: "Solo weekend" },
            { id: "range", label: "Range di date" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, dateMode: opt.id }))}
              aria-pressed={form.dateMode === opt.id}
              className={`rounded-md px-3 py-1.5 text-sm border transition-colors ${
                form.dateMode === opt.id
                  ? "bg-amber-500 border-amber-500 text-night-950 font-semibold"
                  : "bg-night-700 border-night-600 text-mist-300 hover:border-amber-600/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {form.dateMode === "weekend" && (
          <p className="mt-3 text-xs text-mist-400">
            Cerchiamo partenze da un venerdì e ritorni entro la domenica, nelle prossime settimane.
          </p>
        )}

        {form.dateMode === "range" && (
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-mist-400 mb-1.5">Dal</label>
              <input
                type="date"
                value={form.dateFrom ?? ""}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value || null }))}
                className="bg-night-700 border border-night-600 rounded-md px-3 py-1.5 text-sm font-mono outline-none focus:ring-1 focus:ring-amber-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-mist-400 mb-1.5">Al</label>
              <input
                type="date"
                value={form.dateTo ?? ""}
                min={form.dateFrom || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value || null }))}
                className="bg-night-700 border border-night-600 rounded-md px-3 py-1.5 text-sm font-mono outline-none focus:ring-1 focus:ring-amber-500 [color-scheme:dark]"
              />
            </div>
            {form.dateFrom && !form.dateTo && (
              <span className="text-xs text-amber-400">Seleziona anche la data di fine</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-3">
          <label className="text-xs uppercase tracking-widest text-mist-400">Raggio partenza</label>
          <select
            value={form.nearbyRadiusKm}
            onChange={(e) => setForm((f) => ({ ...f, nearbyRadiusKm: Number(e.target.value) }))}
            className="bg-night-700 border border-night-600 rounded-md px-3 py-1.5 text-sm font-mono outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value={0}>Solo aeroporto scelto</option>
            <option value={100}>100 km</option>
            <option value={250}>250 km</option>
            <option value={500}>500 km</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-mist-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.includeLodging}
            onChange={(e) => setForm((f) => ({ ...f, includeLodging: e.target.checked }))}
            className="accent-amber-500 w-4 h-4"
          />
          Includi stima alloggio nel budget
        </label>

        <button
          type="button"
          onClick={onSearch}
          disabled={!form.originAirport || loading}
          className="ml-auto rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-night-600 disabled:text-mist-400 disabled:cursor-not-allowed text-night-950 font-semibold px-6 py-3 transition-colors font-display"
        >
          {loading ? "Ricerca in corso..." : "Trova destinazioni"}
        </button>
      </div>
    </div>
  );
}

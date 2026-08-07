export default function NavBar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FFF4DE] flex items-center justify-center shrink-0">
          <img src="/brand/logo.png" alt="WaysOut" className="w-7 h-7 object-contain" />
        </div>
        <span className="font-display font-bold text-lg text-mist-300 tracking-tight">WaysOut</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 text-night-950 font-semibold text-sm px-4 py-2 font-display"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-1.5 3A1 1 0 007 6.5v2.043L2.264 10.4a1 1 0 00-.264.677v1.5a1 1 0 001.2.98l3.8-.76v2.578l-1.649 1.15a1 1 0 00-.351.76V18a1 1 0 001.351.938L10 17.7l3.649 1.238A1 1 0 0015 18v-.715a1 1 0 00-.351-.76L13 15.375v-2.578l3.8.76a1 1 0 001.2-.98v-1.5a1 1 0 00-.264-.677L13 8.543V6.5a1 1 0 00-.106-.947l-1.5-3z" />
          </svg>
          Voli
        </button>

        <span
          title="In arrivo"
          className="flex items-center gap-1.5 rounded-lg border border-night-600 text-mist-400 text-sm px-4 py-2 cursor-not-allowed select-none"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 6a1 1 0 011-1h12a1 1 0 011 1v7a1 1 0 01-1 1h-1.05a2.5 2.5 0 01-4.9 0h-4.1a2.5 2.5 0 01-4.9 0H4a1 1 0 01-1-1V6z" />
            <path d="M14 8h2.5l1.5 2v3h-4V8z" />
          </svg>
          Treni
          <span className="text-[9px] uppercase tracking-wide bg-night-700 text-mist-400 rounded px-1.5 py-0.5 ml-0.5">
            presto
          </span>
        </span>
      </div>
    </nav>
  );
}

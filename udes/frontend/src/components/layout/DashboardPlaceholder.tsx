export default function DashboardPlaceholder() {
  return (
    <section className="relative flex h-full min-h-[26rem] flex-1 items-center justify-center overflow-hidden border border-white/[0.06] bg-[#090b0f] px-6 py-10 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 38%, rgba(185, 28, 28, 0.13), transparent 34%), linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "auto, 42px 42px, 42px 42px",
        }}
      />

      <div className="relative w-full max-w-xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-red-500/25 bg-red-500/[0.08] shadow-[0_0_55px_rgba(185,28,28,0.12)]">
          <svg
            viewBox="0 0 24 24"
            className="h-9 w-9 text-red-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M4 6.5h16M4 12h10M4 17.5h7" />
            <path d="m17 15 3 3-3 3" />
          </svg>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-red-300">
          Umbrella Systems workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Select a section to continue
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">
          Choose an option from the navigation pane on the left. The selected
          workspace, records, and available actions will appear here.
        </p>

        <div className="mx-auto mt-7 flex max-w-md items-center gap-3 border border-white/[0.08] bg-black/25 px-4 py-3 text-left">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]" />
          <div>
            <p className="text-xs font-semibold text-white/70">
              Dashboard ready
            </p>
            <p className="mt-0.5 text-xs text-white/35">
              No section is currently selected.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


export default function ComingSoonModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative w-[420px] border border-white/10 bg-[#0B1220] p-5 shadow-2xl">

        {/* badge */}
        <div className="mb-3">
            <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/60">
            SYSTEM NOTICE
            </span>
        </div>

        {/* CONTENT ROW */}
        <div className="flex items-center gap-4">
          
          {/* logo */}
          <img
            src="/logo_1.png"
            alt="Umbrella Systems"
            className="w-12 h-12 opacity-90"
          />

          {/* divider */}
          <div className="h-10 w-px bg-white/10" />

          {/* text */}
          <div className="text-left">
            <h2 className="text-sm font-semibold text-white">
              Coming Soon
            </h2>

            <p className="text-xs text-white/60 leading-relaxed">
              This feature is currently under active development.
            </p>
          </div>
        </div>

        {/* button */}
        <button
          onClick={onClose}
          className="mt-5 w-full bg-white/10 px-4 py-2 text-sm text-white
                     hover:bg-white/20 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import type { Violation } from "../../data/types";

function severityClass(severity?: string) {
  if (severity === "CRITICAL" || severity === "HIGH") return "border-red-500/35 bg-red-500/10 text-red-200";
  if (severity === "MEDIUM") return "border-amber-500/35 bg-amber-500/10 text-amber-200";
  return "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return <div className="border-b border-white/5 pb-3"><dt className="text-xs font-semibold uppercase tracking-wide text-white/35">{label}</dt><dd className="mt-1 break-words text-sm text-white/75">{value || "Unavailable"}</dd></div>;
}

export default function ViolationDetailModal({ violation, onClose, footer, hideResolutionDetails = false }: { violation: Violation; onClose: () => void; footer?: ReactNode; hideResolutionDetails?: boolean }) {
  const officer = violation.officer?.user;
  const session = violation.session;
  const camera = session?.camera;
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="violation-details-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/15 bg-[#111214] text-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-red-950/40 via-[#17181b] to-[#111214] p-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Compliance record</p><h2 id="violation-details-title" className="mt-1 text-xl font-semibold">Violation details</h2><p className="mt-2 font-mono text-xs text-white/35">{violation.violation_id}</p></div>
        <button type="button" onClick={onClose} className="border border-white/15 px-3 py-1.5 text-xl text-white/55 transition hover:border-red-500/50 hover:text-white" aria-label="Close violation details">×</button>
      </header>
      <div className="min-h-0 overflow-y-auto p-5">
        <div className="flex flex-wrap gap-2"><span className={`border px-2.5 py-1 text-xs font-semibold ${severityClass(violation.severity)}`}>{violation.severity}</span>{!hideResolutionDetails && <span className={`border px-2.5 py-1 text-xs font-semibold ${violation.resolved ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>{violation.resolved ? "Resolved" : "Open"}</span>}<span className="border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70">{String(violation.type).replaceAll("_", " ")}</span></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="border border-white/10 bg-white/[0.025] p-4"><h3 className="mb-4 font-semibold">Finding</h3><dl className="space-y-3"><Detail label="Description" value={violation.description}/><Detail label="Reported" value={new Date(violation.reported_at).toLocaleString()}/>{!hideResolutionDetails && violation.resolved && <><Detail label="Closure reason" value={violation.closure_reason ?? "Unavailable"}/><Detail label="Closed at" value={violation.closed_at ? new Date(violation.closed_at).toLocaleString() : "Unavailable"}/></>}</dl></article>
          <article className="border border-white/10 bg-white/[0.025] p-4"><h3 className="mb-4 font-semibold">Officer and scope</h3><dl className="space-y-3"><Detail label="Officer" value={officer ? `${officer.first_name} ${officer.last_name}` : "Unavailable"}/><Detail label="Officer ID" value={violation.officer?.officer_id}/><Detail label="Badge" value={violation.officer?.badge_number}/><Detail label="Branch" value={officer?.branch?.name}/><Detail label="Organisation" value={officer?.organization?.name}/></dl></article>
          <article className="border border-white/10 bg-white/[0.025] p-4"><h3 className="mb-4 font-semibold">Evidence context</h3><dl className="space-y-3"><Detail label="Video ID" value={violation.video_id}/><Detail label="Session ID" value={violation.session_id}/><Detail label="Camera" value={camera ? `${camera.serial_number} · ${camera.model}` : "Unavailable"}/><Detail label="Session period" value={session ? `${new Date(session.start_time).toLocaleString()} – ${new Date(session.end_time).toLocaleString()}` : "Unavailable"}/></dl></article>
        </div>
        <article className="mt-4 border border-white/10 bg-black/20 p-4"><h3 className="font-semibold">Location record</h3><div className="mt-3 grid gap-3 md:grid-cols-3"><Detail label="Location-related" value={violation.location_violation ? "Yes" : "No"}/><Detail label="Details" value={violation.location_details}/><Detail label="Coordinates" value={`${violation.start_lat}, ${violation.start_lon} → ${violation.end_lat}, ${violation.end_lon}`}/></div></article>
      </div>
      {footer && <footer className="flex justify-end gap-2 border-t border-white/10 bg-black/20 p-4">{footer}</footer>}
    </section>
  </div>;
}

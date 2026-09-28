import { useDeferredValue, useEffect, useState } from "react";
import axios from "axios";
import type { Violation } from "../../data/types";
import { ConvertTime } from "../../components/helpers/ConvertTime";
import { REDACTED_EVIDENCE_PATH, evidenceFileName, formatEvidenceDate, humanizeEvidenceValue } from "../../components/helpers/evidenceDisplay";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
function severityTone(severity?: string) {
  if (severity === "CRITICAL" || severity === "HIGH") return "border-red-500/35 bg-red-500/10 text-red-200";
  if (severity === "MEDIUM") return "border-amber-500/35 bg-amber-500/10 text-amber-100";
  return "border-sky-500/30 bg-sky-500/10 text-sky-100";
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border border-white/10 bg-white/[0.025]"><header className="border-b border-white/10 px-4 py-3"><h3 className="text-sm font-semibold">{title}</h3></header><div className="p-4">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">{label}</dt><dd className="mt-1 break-words text-sm text-white/80">{children}</dd></div>; }

export default function OfficerViolations() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try { setLoading(true); const response = await axios.get<Violation[]>(`${API_URL}/violation`, { withCredentials: true, params: { search: deferredSearch } }); setViolations(Array.isArray(response.data) ? response.data : []); }
      catch (error) { console.error("Failed to load officer violations", error); setViolations([]); }
      finally { setLoading(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [deferredSearch]);

  const openViolation = async (violation: Violation) => {
    setSelectedViolation(violation);
    try { await axios.post(`${API_URL}/violation/access/click`, { violation_id: violation.violation_id }, { withCredentials: true }); }
    catch (error) { console.error("Failed to audit violation access", error); }
  };

  const linkedSession = selectedViolation?.session;
  const linkedVideo = selectedViolation?.video;
  return <div className="flex h-full min-h-[360px] min-w-0 flex-col overflow-hidden border border-white/10 bg-body-black text-white shadow-2xl">
    <header className="shrink-0 border-b border-white/10 bg-gradient-to-r from-red-950/35 to-black/15 px-4 py-4 sm:px-5"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Compliance record</p><h2 className="mt-1 text-xl font-semibold">My Violations</h2><p className="mt-1 text-sm text-white/45">Review recorded violations and the evidence context linked to each event.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search violations..." className="mt-4 w-full min-w-0 border border-white/10 bg-black/35 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-red-500/55" /></header>
    <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(180px,38vh)_minmax(240px,1fr)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="min-h-0 min-w-0 overflow-y-scroll overscroll-contain border-b border-white/10 lg:border-b-0 lg:border-r" aria-label="Violation list">{loading ? <p className="p-6 text-sm text-white/40">Loading violation records...</p> : violations.length === 0 ? <p className="p-6 text-sm text-white/40">No violations are recorded.</p> : violations.map((violation) => <button key={violation.violation_id} type="button" onClick={() => void openViolation(violation)} className={`block w-full min-w-0 border-b border-white/5 p-4 text-left transition hover:bg-white/[0.04] ${selectedViolation?.violation_id === violation.violation_id ? "border-l-2 border-l-red-500 bg-white/[0.045]" : ""}`}><div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-words font-semibold">{humanizeEvidenceValue(violation.type)}</p><span className={`shrink-0 border px-2 py-1 text-[10px] font-semibold ${severityTone(violation.severity)}`}>{violation.severity}</span></div><p className="mt-2 break-words text-xs text-white/40">{formatEvidenceDate(violation.reported_at)}</p><p className="mt-1 text-xs text-white/55">{violation.resolved ? "Closed" : "Open"}</p></button>)}</aside>
      <main className="min-h-0 min-w-0 overflow-auto overscroll-contain p-3 sm:p-5">{!selectedViolation ? <div className="grid min-h-[240px] place-items-center border border-dashed border-white/10 text-center text-white/40"><div><p className="font-medium text-white/60">Select a violation</p><p className="mt-1 text-sm">Its assessment and linked evidence will appear here.</p></div></div> : <div className="min-w-0 space-y-4">
        <Panel title="Violation assessment"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-lg font-semibold">{humanizeEvidenceValue(selectedViolation.type)}</p><p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">{selectedViolation.description}</p></div><div className="flex gap-2"><span className={`border px-3 py-2 text-xs font-semibold ${severityTone(selectedViolation.severity)}`}>{selectedViolation.severity}</span><span className={`border px-3 py-2 text-xs font-semibold ${selectedViolation.resolved ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>{selectedViolation.resolved ? "Closed" : "Open"}</span></div></div><dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Field label="Reported">{formatEvidenceDate(selectedViolation.reported_at)}</Field><Field label="Status">{humanizeEvidenceValue(selectedViolation.status)}</Field><Field label="Location">{selectedViolation.location_details || "Not provided"}</Field><Field label="Closure reason">{selectedViolation.closure_reason ?? "Not closed"}</Field></dl></Panel>
        <div className="grid gap-4 xl:grid-cols-2"><Panel title="Session and camera"><dl className="grid gap-4 sm:grid-cols-2"><Field label="Session started">{formatEvidenceDate(linkedSession?.start_time)}</Field><Field label="Session ended">{formatEvidenceDate(linkedSession?.end_time, "In progress")}</Field><Field label="Camera model">{linkedSession?.camera?.model ?? "Not available"}</Field><Field label="Camera serial">{linkedSession?.camera?.serial_number ?? "Not available"}</Field></dl></Panel><Panel title="Linked video evidence">{linkedVideo ? <><p className="font-semibold">{evidenceFileName(linkedVideo)}</p><dl className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Storage path"><span className="font-semibold text-red-200">{REDACTED_EVIDENCE_PATH}</span></Field><Field label="Storage state">{humanizeEvidenceValue(linkedVideo.storage_state)}</Field><Field label="Duration"><ConvertTime seconds={linkedVideo.duration} /></Field><Field label="Integrity">{linkedVideo.tamper_flag ? <span className="text-red-300">Flagged</span> : <span className="text-emerald-300">No tamper flag</span>}</Field></dl></> : <p className="text-sm text-white/40">No video is linked to this violation.</p>}</Panel></div>
      </div>}</main>
    </div>
  </div>;
}

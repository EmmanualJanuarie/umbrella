import { useDeferredValue, useEffect, useState } from "react";
import axios from "axios";
import type { Violation } from "../../data/types";
import ViolationDetailModal from "../shared/ViolationDetailModal";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

function severityClass(severity: string) {
  return severity === "CRITICAL" || severity === "HIGH" ? "border-red-500/35 bg-red-500/10 text-red-200" : severity === "MEDIUM" ? "border-amber-500/35 bg-amber-500/10 text-amber-200" : "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

export default function BranchViolations() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [selected, setSelected] = useState<Violation | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await axios.get<Violation[]>(`${API_URL}/violation`, { withCredentials: true, params: { search: deferredSearch } });
        setViolations(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Failed to load branch violations", error);
        setViolations([]);
      } finally { setLoading(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [deferredSearch, refreshTick]);

  const openViolation = async (violation: Violation) => {
    setSelected(violation);
    await axios.post(`${API_URL}/violation/access/violation/click`, { violation_id: violation.violation_id }, { withCredentials: true }).catch(() => undefined);
  };

  return <div className="flex h-full min-h-0 flex-col gap-4 bg-body-black p-4 text-white">
    <header className="border border-white/10 bg-gradient-to-r from-red-950/35 to-black/20 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Branch compliance</p><h2 className="mt-1 text-xl font-semibold">Violations</h2><p className="mt-1 text-sm text-white/50">Review officer findings, linked evidence, sessions and corrective action.</p></div><button onClick={() => setRefreshTick((value) => value + 1)} disabled={loading} className="border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 disabled:opacity-40">{loading ? "Refreshing..." : "Refresh"}</button></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search officer, badge, violation type or camera..." className="mt-4 w-full border border-white/10 bg-gray-950 p-3 text-sm outline-none focus:border-red-500"/></header>
    <div className="min-h-0 flex-1 overflow-auto border border-white/10"><table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 z-10 bg-[#17181b] text-xs uppercase tracking-wide text-white/40"><tr><th className="p-3">Officer</th><th className="p-3">Badge</th><th className="p-3">Violation</th><th className="p-3">Severity</th><th className="p-3">Status</th><th className="p-3">Camera</th><th className="p-3">Reported</th></tr></thead><tbody>{violations.map((violation) => <tr key={violation.violation_id} onClick={() => void openViolation(violation)} className="cursor-pointer border-t border-white/5 transition hover:bg-white/[0.04]"><td className="p-3"><p className="font-medium">{violation.officer ? `${violation.officer.user.first_name} ${violation.officer.user.last_name}` : "Unavailable"}</p><p className="text-xs text-white/35">{violation.officer?.user.email}</p></td><td className="p-3">{violation.officer?.badge_number ?? "—"}</td><td className="p-3">{String(violation.type).replaceAll("_", " ")}</td><td className="p-3"><span className={`border px-2 py-1 text-xs font-semibold ${severityClass(violation.severity)}`}>{violation.severity}</span></td><td className="p-3"><span className={violation.resolved ? "text-emerald-300" : "text-amber-300"}>{violation.resolved ? "Resolved" : "Open"}</span></td><td className="p-3 font-mono text-xs">{violation.session?.camera?.serial_number ?? "Unavailable"}</td><td className="p-3 whitespace-nowrap text-white/60">{new Date(violation.reported_at).toLocaleString()}</td></tr>)}{!loading && violations.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-white/40">No violations match the current search.</td></tr>}</tbody></table></div>
    {selected && <ViolationDetailModal violation={selected} onClose={() => setSelected(null)}/>} 
  </div>;
}

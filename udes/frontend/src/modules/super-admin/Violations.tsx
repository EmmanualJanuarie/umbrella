import { useEffect, useState } from "react";
import axios from "axios";
import { type Violation, type ViolationType} from "../../data/types";
import ViolationDetailModal from "../shared/ViolationDetailModal";

const violationTypeLabels: Record<ViolationType, string> = {
  CAMERA_OFF: "Camera Off",
  UNAUTHORIZED_ACCESS: "Unauthorized Access",
  TAMPERING: "Tampering",
  GPS_ANOMALY: "GPS Anomaly",
  MISSED_SHIFT: "Missed Shift",
  SHIFT_MISMATCH: "Shift Mismatch",
  RECORDING_GAP: "Recording Gap",
  EVIDENCE_IRREGULARITY: "Evidence Irregularity",
};


export default function UmbrellaViolations() {
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);

  // Filter state
  const [orgFilter, setOrgFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  const [showViolationModal, setShowViolationModal] = useState(false);
  const [closureReason, setClosureReason] = useState("");
  const [updatingState, setUpdatingState] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  // Fetch violations from backend based on role
  useEffect(() => {

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const res = await axios.get(`${API_URL}/violation`, {
          withCredentials: true,
          params: {
            orgId: orgFilter,
            branchId: branchFilter,
            type: typeFilter,
            severity: severityFilter,
          },
        });

        setViolations(res.data);
      } catch (err) {
        console.error("Failed to fetch violations", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    API_URL,
    orgFilter,
    branchFilter,
    typeFilter,
    severityFilter,
    refreshTick,
  ]);

  // Apply filters
  const filteredViolations = violations;

  const updateViolationState = async (resolved: boolean) => {
    if (!selectedViolation) return;
    setUpdatingState(true);
    setStateError(null);
    try {
      const response = await axios.patch<Violation>(
        `${API_URL}/violation/${selectedViolation.violation_id}`,
        resolved ? { resolved: true, closure_reason: closureReason.trim() } : { resolved: false },
        { withCredentials: true },
      );
      setSelectedViolation(response.data);
      setViolations((current) => current.map((item) => item.violation_id === response.data.violation_id ? response.data : item));
      setClosureReason("");
    } catch (updateError) {
      setStateError(axios.isAxiosError(updateError)
        ? String(updateError.response?.data?.message ?? "The violation state could not be updated.")
        : "The violation state could not be updated.");
    } finally {
      setUpdatingState(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden border border-white/10 bg-body-black p-4 text-white">
      <header className="border border-white/10 bg-gradient-to-r from-red-950/35 to-black/20 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Platform compliance</p><h2 className="mt-1 text-xl font-semibold">Violations oversight</h2><p className="mt-1 text-sm text-white/50">Review and filter violation records across organisations.</p></header>

      {/* Filters */}
      <div className="grid gap-2 border border-white/10 bg-black/20 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <select
          className="border border-white/10 bg-gray-950 p-2.5 text-white outline-none focus:border-red-500"
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
        >
          <option value="ALL">All Organizations</option>
          {Array.from(
            new Map(
              violations
                .map(v => v.officer?.user.organization)
                .filter(Boolean)
                .map(org => [org!.org_id, org!]) // map org_id to org object
            ).values()
          ).map(org => (
            <option key={org.org_id} value={org.org_id}>
              {org.name}
            </option>
          ))}
        </select>

        <select
          className="border border-white/10 bg-gray-950 p-2.5 text-white outline-none focus:border-red-500"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="ALL">All Branches</option>
          {Array.from(
            new Map(
              violations
                .map(v => v.officer?.user.branch)
                .filter(Boolean)
                .map(branch => [branch!.branch_id, branch!]) // map branch_id to branch object
            ).values()
          ).map(branch => (
            <option key={branch.branch_id} value={branch.branch_id}>
              {branch.name}
            </option>
          ))}
        </select>

        <select
          className="border border-white/10 bg-gray-950 p-2.5 text-white outline-none focus:border-red-500"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">All Violation Types</option>
          {Array.from(new Set(violations.map(v => v.type))).map((type) => (
            <option key={type} value={type}>
              {violationTypeLabels[type as ViolationType]}
            </option>
          ))}
        </select>

        <select
          className="border border-white/10 bg-gray-950 p-2.5 text-white outline-none focus:border-red-500"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="ALL">All Severities</option>
          <option value="MINIMAL">Minimal</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>

      {/* Violations Table */}
      <div className="flex items-center justify-between border border-white/10 border-b-0 bg-black/20 px-4 py-3">
        <h3 className="text-sm font-semibold">Violations</h3>
        <button
          onClick={() => setRefreshTick((tick) => tick + 1)}
          disabled={loading}
          className="border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto border border-white/10">
        <table className="w-full min-w-[1450px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#17181b] text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="p-2">Violation ID</th>
              <th className="p-2">Type</th>
              <th className="p-2">Severity</th>
              <th className="p-2">State</th>
              <th className="p-2">Officer</th>
              <th className="p-2">Branch</th>
              <th className="p-2">Organization</th>
              <th className="p-2">Video ID</th>
              <th className="p-2">Session ID</th>
              <th className="p-2">Reported At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="p-4 text-center text-gray-400">Loading...</td>
              </tr>
            ) : filteredViolations.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-center text-gray-400">No violations found</td>
              </tr>
            ) : (
              filteredViolations.map((v) => (
                <tr
                  key={v.violation_id}
                  className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04] ${
                    selectedViolation?.violation_id === v.violation_id ? "bg-gray-900" : ""
                  }`}
                  onClick={async () => { 
                    setSelectedViolation(v)
                    setShowViolationModal(true);
                    setClosureReason("");
                    setStateError(null);

                    // Log the violation click
                      try {
                        await axios.post(
                          `${API_URL}/violation/access/violation/click`,
                          {
                            violation_id: v.violation_id, // clicked violations
                          },
                          { withCredentials: true }
                        );
                      } catch (err) {
                        console.error("Failed to log violation click", err);
                      }
                    }}
                >
                  <td className="p-2">{v.violation_id}</td>
                  <td className="p-2">{v.type}</td>
                  <td className="p-2"
                      style={{ color:
                        v.severity === 'MINIMAL' ? '#FF9800' :
                        v.severity === 'CRITICAL' ? '#ef4444' : '#4b5563'
                      }}>{v.severity ?? 'Minimal'}</td>
                  <td className="p-2"><span className={v.resolved ? "text-emerald-300" : "text-amber-300"}>{v.resolved ? "Closed" : "Open"}</span></td>
                  <td className="p-2">{v.officer ? `${v.officer.user.first_name} ${v.officer.user.last_name}` : "N/A"}</td>
                  <td className="p-2">{v.officer?.user.branch?.name ?? "N/A"}</td>
                  <td className="p-2">{v.officer?.user.organization?.name ?? "N/A"}</td>
                  <td className="p-2">{v.video?.video_id ?? "N/A"}</td>
                  <td className="p-2">{v.session?.session_id ?? "N/A"}</td>
                  <td className="p-2">{new Date(v.reported_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 text-sm text-gray-400 text-center">
        {!showViolationModal && (
          <p>Click a violation to view additional details.</p>
        )}
      </div>

      {showViolationModal && selectedViolation && <ViolationDetailModal
        violation={selectedViolation}
        onClose={() => setShowViolationModal(false)}
        footer={selectedViolation.resolved ? (
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-left text-xs text-white/45">Reopening clears the stored closure reason and is audit logged.</p>
            <button type="button" onClick={() => void updateViolationState(false)} disabled={updatingState} className="border border-amber-500/40 px-4 py-2 text-sm text-amber-100 disabled:opacity-50">{updatingState ? "Updating..." : "Reopen violation"}</button>
          </div>
        ) : (
          <div className="w-full">
            <label className="text-left text-xs font-semibold uppercase tracking-wide text-white/45">Closure reason (required)</label>
            <textarea value={closureReason} onChange={(event) => setClosureReason(event.target.value)} placeholder="Explain why this violation is being closed..." className="mt-2 min-h-20 w-full border border-white/15 bg-gray-950 p-3 text-sm outline-none focus:border-red-500" />
            {stateError && <p className="mt-2 text-left text-xs text-red-300">{stateError}</p>}
            <div className="mt-3 flex justify-end"><button type="button" onClick={() => void updateViolationState(true)} disabled={updatingState || closureReason.trim().length < 10} className="bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{updatingState ? "Closing..." : "Close violation"}</button></div>
          </div>
        )}
      />} 

    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { type AuditLog, type Branch, type Organization, type User } from "../../data/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

type AuditActor = User & { officers?: { badge_number?: string } | { badge_number?: string }[] | null };
type AuditDetails = {
  event?: string;
  activity?: string;
  org_id?: string | null;
  branch_id?: string | null;
  file_name?: string;
  camera_serial_number?: string;
  officer_name?: string;
  integrity_status?: string;
  verification_outcome?: string;
};

const actorFor = (log: AuditLog) => (log.performer ?? log.user) as AuditActor | undefined;
const detailsFor = (log: AuditLog) => (log.details ?? {}) as unknown as AuditDetails;

function branchLabel(actor?: AuditActor) {
  if (actor?.branch?.name) return actor.branch.name;
  if (actor?.role === "ORG_OWNER") return "Organization-wide (not branch-bound)";
  if (actor?.role === "SUPER_ADMIN" || actor?.role === "MAIN_SUPER_ADMIN") return "Platform-wide (not branch-bound)";
  return "Not branch-bound";
}

function organizationLabel(actor?: AuditActor) {
  return actor?.organization?.name
    ?? (actor?.role === "SUPER_ADMIN" || actor?.role === "MAIN_SUPER_ADMIN" ? "Umbrella Platform" : "Unknown organization");
}

function entityLabel(log: AuditLog) {
  const details = log.details as unknown as { path?: string; event?: string } | undefined;
  if (details?.event === "BROWSER_EVIDENCE_TRANSFER_COMPLETED") return "EVIDENCE UPLOAD";
  if (details?.event === "EVIDENCE_INTEGRITY_VERIFIED") return "EVIDENCE VERIFICATION";
  if (log.entity_type === "SECURITY" && details?.path?.includes("/notifications/")) return "NOTIFICATION";
  return log.entity_type.replaceAll("_", " ");
}

function activityLabel(log: AuditLog) {
  const details = detailsFor(log);
  if (details.activity) return details.activity;
  if (details.event === "BROWSER_EVIDENCE_INGEST_ACCEPTED") return "Evidence upload accepted";
  if (details.event === "BROWSER_EVIDENCE_INGEST_STARTED") return "Evidence upload started";
  return `${log.action} ${entityLabel(log).toLowerCase()}`;
}

function actionClass(action: string) {
  if (action === "DELETE") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (action === "CREATE") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (action === "UPDATE") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (action === "LOGIN" || action === "ACCESS") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  return "border-white/15 bg-white/5 text-white/70";
}

export default function AuditLogs() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadData = useCallback(async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError("");
    try {
      const [orgResponse, branchResponse, logResponse] = await Promise.all([
        axios.get<Organization[]>(`${API_URL}/organization`, { withCredentials: true }),
        axios.get<Branch[]>(`${API_URL}/branches`, { withCredentials: true }),
        axios.get<AuditLog[]>(`${API_URL}/audit-log`, { withCredentials: true }),
      ]);
      setOrganizations(Array.isArray(orgResponse.data) ? orgResponse.data : []);
      setBranches(Array.isArray(branchResponse.data) ? branchResponse.data : []);
      setLogs(Array.isArray(logResponse.data) ? logResponse.data : []);
      setLastUpdatedAt(new Date());
    } catch (loadError) {
      console.error("Failed to load audit logs", loadError);
      setError("Audit logs could not be loaded. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const organizationById = useMemo(
    () => new Map(organizations.map((organization) => [organization.org_id, organization.name])),
    [organizations],
  );
  const branchById = useMemo(
    () => new Map(branches.map((branch) => [branch.branch_id, branch.name])),
    [branches],
  );

  const availableBranches = useMemo(
    () => branches.filter((branch) => !selectedOrgId || branch.org_id === selectedOrgId),
    [branches, selectedOrgId],
  );

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      const actor = actorFor(log);
      const details = detailsFor(log);
      const scopedOrgId = details.org_id ?? actor?.org_id;
      const scopedBranchId = details.branch_id ?? actor?.branch_id;
      if (selectedOrgId && scopedOrgId !== selectedOrgId) return false;
      if (selectedBranchId && scopedBranchId !== selectedBranchId) return false;
      if (!term) return true;
      return [
        actor?.first_name,
        actor?.last_name,
        actor?.email,
        branchLabel(actor),
        organizationLabel(actor),
        entityLabel(log),
        activityLabel(log),
        details.file_name,
        details.camera_serial_number,
        details.officer_name,
        details.verification_outcome,
        log.action,
        log.entity_id,
        log.ip_address,
      ].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [logs, search, selectedBranchId, selectedOrgId]);

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, { organization: string; branch: string; logs: AuditLog[] }>();
    for (const log of filteredLogs) {
      const actor = actorFor(log);
      const details = detailsFor(log);
      const organization = details.org_id
        ? organizationById.get(details.org_id) ?? organizationLabel(actor)
        : organizationLabel(actor);
      const branch = details.branch_id
        ? branchById.get(details.branch_id) ?? branchLabel(actor)
        : branchLabel(actor);
      const key = `${organization}\u0000${branch}`;
      const group = groups.get(key) ?? { organization, branch, logs: [] };
      group.logs.push(log);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [branchById, filteredLogs, organizationById]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-body-black p-4 text-white">
      <header className="border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Governance</p>
            <h2 className="mt-1 text-xl font-semibold">Platform audit trail</h2>
            <p className="mt-1 text-sm text-white/50">Review activity by organization and branch. Data refreshes only when requested.</p>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={() => void loadData(false)}
              disabled={loading || refreshing}
              className="border border-red-500/50 bg-red-600/15 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <p className="mt-2 text-xs text-white/40">{lastUpdatedAt ? `Last updated ${lastUpdatedAt.toLocaleTimeString()}` : "Not loaded yet"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
          <label className="text-xs uppercase tracking-wide text-white/45">
            Organization
            <select
              value={selectedOrgId}
              onChange={(event) => { setSelectedOrgId(event.target.value); setSelectedBranchId(""); }}
              className="mt-1 w-full border border-white/10 bg-gray-950 px-3 py-2 text-sm normal-case text-white"
            >
              <option value="">All organizations</option>
              {organizations.map((organization) => <option key={organization.org_id} value={organization.org_id}>{organization.name}</option>)}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-white/45">
            Branch
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="mt-1 w-full border border-white/10 bg-gray-950 px-3 py-2 text-sm normal-case text-white"
            >
              <option value="">All branches</option>
              {availableBranches.map((branch) => (
                <option key={branch.branch_id} value={branch.branch_id}>
                  {branch.name} | {organizationById.get(branch.org_id) ?? "Unknown organization"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-white/45">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="User, action, entity, IP address..."
              className="mt-1 w-full border border-white/10 bg-gray-950 px-3 py-2 text-sm normal-case text-white placeholder:text-white/30"
            />
          </label>
        </div>
      </header>

      {error && <div className="border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">{error}</div>}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
        {loading ? (
          <div className="border border-white/10 p-8 text-center text-white/45">Loading audit logs...</div>
        ) : groupedLogs.length === 0 ? (
          <div className="border border-white/10 p-8 text-center text-white/45">No audit logs match these filters.</div>
        ) : (
          <div className="space-y-4">
            {groupedLogs.map((group) => (
              <section key={`${group.organization}-${group.branch}`} className="overflow-hidden border border-white/10 bg-black/25">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
                  <div><h3 className="font-semibold">{group.branch}</h3><p className="text-xs text-white/45">{group.organization}</p></div>
                  <span className="border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/55">{group.logs.length} entries</span>
                </div>
                <div className="max-w-full overflow-x-auto">
                  <table className="w-full min-w-[1320px] text-left text-sm">
                    <thead className="bg-gray-950 text-xs uppercase tracking-wide text-white/40">
                      <tr><th className="p-3">Timestamp</th><th className="p-3">User</th><th className="p-3">Activity</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Evidence details</th><th className="p-3">Reference</th><th className="p-3">Dashboard</th><th className="p-3">IP address</th></tr>
                    </thead>
                    <tbody>
                      {group.logs.map((log) => {
                        const actor = actorFor(log);
                        const details = detailsFor(log);
                        return (
                          <tr key={log.audit_log_id} className="border-t border-white/5 hover:bg-white/[0.035]">
                            <td className="whitespace-nowrap p-3 text-white/65">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="p-3"><p className="font-medium">{actor ? `${actor.first_name} ${actor.last_name}` : "System user"}</p><p className="text-xs text-white/40">{actor?.email ?? "No email recorded"}</p></td>
                            <td className="p-3"><p className="font-medium text-white/85">{activityLabel(log)}</p>{details.verification_outcome && <p className={`mt-1 text-xs ${details.verification_outcome === "VERIFIED" ? "text-emerald-300" : "text-red-300"}`}>{details.verification_outcome.replaceAll("_", " ")}</p>}</td>
                            <td className="p-3"><span className={`inline-flex border px-2 py-1 text-xs font-semibold ${actionClass(log.action)}`}>{log.action}</span></td>
                            <td className="p-3 text-white/75">{entityLabel(log)}</td>
                            <td className="max-w-[260px] p-3 text-xs text-white/55"><p className="truncate text-white/75" title={details.file_name}>{details.file_name ?? "No filename recorded"}</p><p>{details.officer_name ?? "Officer not recorded"}</p><p className="font-mono">{details.camera_serial_number ?? "Camera not recorded"}</p></td>
                            <td className="max-w-[220px] truncate p-3 font-mono text-xs text-white/55" title={log.entity_id}>{log.entity_id}</td>
                            <td className="p-3 text-white/65">{String(log.dashboard_type).replaceAll("_", " ")}</td>
                            <td className="p-3 font-mono text-xs text-white/55">{log.ip_address ?? "Not recorded"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

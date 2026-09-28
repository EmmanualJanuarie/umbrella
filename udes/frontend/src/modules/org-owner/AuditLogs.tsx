import { useDeferredValue, useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

interface AuditActor {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  branch?: {
    branch_id: string;
    name: string;
  };
  organization?: {
    org_id: string;
    name: string;
  };
  officers?: {
    badge_number: string;
  }[];
}

interface AuditLog {
  audit_log_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  ip_address?: string | null;
  timestamp: string;
  user?: AuditActor;
  performer?: AuditActor;
}

function getActionColor(action: string) {
  switch (action) {
    case "CREATE":
      return "text-emerald-300";
    case "LOGIN":
      return "text-teal-300";
    case "LOGOUT":
      return "text-orange-300";
    case "UPDATE":
      return "text-yellow-300";
    case "DELETE":
      return "text-red-300";
    case "ACCESS":
      return "text-sky-300";
    case "ALLOCATE":
      return "text-purple-300";
    case "EXIT":
      return "text-amber-300";
    default:
      return "text-white";
  }
}

export default function OrgOwnerAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshLogs = async (searchValue = deferredSearch) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/audit-log`, {
        withCredentials: true,
        params: { search: searchValue },
      });
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Search failed", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshLogs(deferredSearch);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [deferredSearch, refreshTick]);

  return (
    <div className="flex h-full w-full flex-col gap-4 border border-gray-700 bg-body-black p-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Audit logs</p>
          <h2 className="mt-1 text-lg font-semibold">Organization activity trail</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshTick((tick) => tick + 1)}
            className="border border-white/10 bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:border-red-500/60"
          >
            Refresh
          </button>
          <input
            type="text"
            placeholder="Search audit logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-gray-700 bg-black px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-gray-700">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 bg-gray-900 text-xs uppercase text-white/45">
            <tr>
              <th className="p-2">Timestamp</th>
              <th className="p-2">Branch</th>
              <th className="p-2">User</th>
              <th className="p-2">Action</th>
              <th className="p-2">Entity</th>
              <th className="p-2">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400">
                  Loading logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400">
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const actor = log.performer ?? log.user;
                return (
                  <tr key={log.audit_log_id} className="border-b border-gray-700 hover:bg-gray-800">
                    <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-2">
                      {actor?.branch?.name ?? (actor?.organization ? "Organization-wide (not branch-bound)" : "Not branch-bound")}
                    </td>
                    <td className="p-2">
                      <p>{actor ? `${actor.first_name} ${actor.last_name}` : "Unknown"}</p>
                      <p className="text-xs text-white/45">{actor?.email ?? "UNKNOWN"}</p>
                    </td>
                    <td className="p-2">
                      <span className={`border border-white/10 bg-white/5 px-2 py-1 text-xs ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-2">{log.entity_type}</td>
                    <td className="p-2">{log.ip_address ?? "N/A"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border border-gray-700 bg-header-black p-3 text-center text-sm text-gray-400">
        Audit records are shown inline. Row detail popups are disabled.
      </div>
    </div>
  );
}

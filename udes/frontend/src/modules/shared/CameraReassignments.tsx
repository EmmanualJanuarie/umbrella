import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { CameraReassignment } from "../../data/types";
import { useBackgroundRefresh } from "../../hooks/useBackgroundRefresh";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

type CameraReassignmentsProps = {
  scope: "branch" | "organization" | "platform";
};

function officerName(officer?: CameraReassignment["newOfficer"] | null) {
  if (!officer?.user) return "Unassigned";
  return `${officer.user.first_name} ${officer.user.last_name}`;
}

function cameraLabel(item: CameraReassignment) {
  const camera = item.camera;
  if (!camera) return item.camera_id;
  return `${camera.serial_number} / ${camera.model}`;
}

export default function CameraReassignments({ scope }: CameraReassignmentsProps) {
  const [records, setRecords] = useState<CameraReassignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get<CameraReassignment[]>(
        `${API_URL}/camera/reassignments/history`,
        { withCredentials: true },
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to load camera reassignment history"
        : "Failed to load camera reassignment history";
      setError(Array.isArray(message) ? message.join(", ") : message);
      throw err;
    }
  }, []);

  const {
    data,
    loading,
    refreshing,
    refresh: loadRecords,
  } = useBackgroundRefresh({
    fetcher: fetchRecords,
  });

  useEffect(() => {
    if (data) setRecords(data);
  }, [data]);

  const groupedRecords = useMemo(() => {
    return records.reduce<Record<string, CameraReassignment[]>>((groups, item) => {
      const key =
        scope === "platform"
          ? `${item.organization?.name ?? "Unknown organization"} / ${item.branch?.name ?? "Unknown branch"}`
          : scope === "organization"
            ? item.branch?.name ?? "Unknown branch"
            : "Branch camera reassignments";

      groups[key] ??= [];
      groups[key].push(item);
      return groups;
    }, {});
  }, [records, scope]);

  return (
    <div className="flex h-full flex-col border border-white/10 bg-body-black text-white">
      <div className="border-b border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Camera Reassignment History</h2>
            <p className="text-sm text-white/50">
              Track old officer, new officer, camera details, and reassignment reason.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRecords(true)}
            disabled={refreshing}
            className="border border-white/10 bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:border-red-500/60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="m-4 border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="p-6 text-center text-white/45">Loading camera reassignment history...</div>
        ) : records.length === 0 ? (
          <div className="border border-white/10 bg-black/25 p-6 text-center text-white/45">
            No camera reassignments have been recorded yet.
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedRecords).map(([group, items]) => (
              <section key={group} className="border border-white/10 bg-black/25">
                <div className="border-b border-white/10 px-4 py-3">
                  <h3 className="font-semibold">{group}</h3>
                  <p className="text-xs text-white/45">{items.length} reassignment record{items.length === 1 ? "" : "s"}</p>
                </div>

                <div className="overflow-auto">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="bg-gray-950 text-xs uppercase text-white/45">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Camera</th>
                        {scope === "platform" && <th className="p-3">Organization</th>}
                        {scope !== "branch" && <th className="p-3">Branch</th>}
                        <th className="p-3">Old Officer</th>
                        <th className="p-3">New Officer</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3">Reassigned By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.reassignment_id} className="border-t border-white/10 align-top">
                          <td className="p-3">{new Date(item.created_at).toLocaleString()}</td>
                          <td className="p-3">
                            <p className="font-semibold">{cameraLabel(item)}</p>
                            <p className="text-xs text-white/45">{item.camera?.manufacturer ?? "Unknown maker"}</p>
                          </td>
                          {scope === "platform" && (
                            <td className="p-3">{item.organization?.name ?? "Unknown"}</td>
                          )}
                          {scope !== "branch" && (
                            <td className="p-3">{item.branch?.name ?? "Unknown"}</td>
                          )}
                          <td className="p-3">
                            <p>{officerName(item.oldOfficer)}</p>
                            <p className="text-xs text-white/45">{item.oldOfficer?.badge_number ?? "No badge"}</p>
                          </td>
                          <td className="p-3">
                            <p>{officerName(item.newOfficer)}</p>
                            <p className="text-xs text-white/45">{item.newOfficer?.badge_number ?? "No badge"}</p>
                          </td>
                          <td className="max-w-xs p-3 text-white/75">{item.reason}</td>
                          <td className="p-3">
                            {item.reassignedBy
                              ? `${item.reassignedBy.first_name} ${item.reassignedBy.last_name}`
                              : item.reassigned_by}
                          </td>
                        </tr>
                      ))}
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

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

type UsageSnapshot = {
  usage_snapshot_id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  uploaded_video_count: number;
  streamed_seconds: number;
  review_minutes: number;
  reports_created: number;
  stored_gb_hours: string;
  active_users: number;
  active_cameras: number;
  platform_estimated_cost: string;
  currency: string;
  finalized: boolean;
  organization?: {
    name: string;
  };
};

type BranchBillingRow = {
  branch_id: string | null;
  branch_name: string;
  uploaded_video_count: number;
  uploaded_bytes: number;
};

type BillingResponse = {
  snapshots: UsageSnapshot[];
  branch_breakdown: BranchBillingRow[];
};

type BillingCentreProps = {
  scope: "platform" | "organization";
};

const formatBytes = (value: number) => {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index < 3 ? 0 : 2)} ${units[index]}`;
};

export default function BillingCentre({ scope }: BillingCentreProps) {
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
  const now = new Date();
  const defaultStart = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    []
  );
  const defaultEnd = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
    []
  );

  const [periodStart, setPeriodStart] = useState(defaultStart.slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(defaultEnd.slice(0, 10));
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([]);
  const [branchBreakdown, setBranchBreakdown] = useState<BranchBillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = useCallback(async (showInitialLoader = false) => {
    if (showInitialLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const res = await axios.get<BillingResponse>(`${API_URL}/billing/monthly`, {
        withCredentials: true,
        params: {
          period_start: new Date(periodStart).toISOString(),
          period_end: new Date(periodEnd).toISOString(),
        },
      });

      setSnapshots(res.data.snapshots);
      setBranchBreakdown(res.data.branch_breakdown);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to load billing information"
        : "Failed to load billing information";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL, periodEnd, periodStart]);

  useEffect(() => {
    void loadUsage(true);
  }, [loadUsage]);

  const totals = useMemo(
    () =>
      snapshots.reduce(
        (acc, snapshot) => {
          acc.uploads += snapshot.uploaded_video_count;
          acc.users += snapshot.active_users ?? 0;
          acc.cameras += snapshot.active_cameras ?? 0;
          acc.reports += snapshot.reports_created;
          return acc;
        },
        { uploads: 0, users: 0, cameras: 0, reports: 0 },
      ),
    [snapshots],
  );

  return (
    <section className="flex h-full flex-col gap-5 text-left">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Billing Centre</h1>
          <p className="mt-1 text-sm text-white/60">
            {scope === "platform"
              ? "Billing allocation across every customer organization."
              : "Billing allocation for your organization and its branches."}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-white/60 mb-1">Start</span>
            <input
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              className="bg-body-black border border-white/20 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-white/60 mb-1">End</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              className="bg-body-black border border-white/20 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadUsage(false)}
            className="bg-red-600 px-4 py-2 font-semibold hover:bg-red-700"
          >
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase text-white/45">Evidence files</p>
          <p className="mt-1 text-2xl font-semibold">{totals.uploads}</p>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase text-white/45">Active users</p>
          <p className="mt-1 text-2xl font-semibold">{totals.users}</p>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase text-white/45">Active cameras</p>
          <p className="mt-1 text-2xl font-semibold">{totals.cameras}</p>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase text-white/45">Reports created</p>
          <p className="mt-1 text-2xl font-semibold">{totals.reports}</p>
        </div>
      </div>

      {error && (
        <div className="border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden border border-white/10 bg-black/30">
        {refreshing && (
          <div className="absolute right-3 top-3 z-10 border border-white/10 bg-gray-950/95 px-3 py-1 text-xs text-white/65 shadow-lg">
            Updating quietly
          </div>
        )}

        <div className="h-full overflow-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-3 py-2 text-left">Organization</th>
              <th className="px-3 py-2 text-right">Evidence files</th>
              <th className="px-3 py-2 text-right">Users</th>
              <th className="px-3 py-2 text-right">Cameras</th>
              <th className="px-3 py-2 text-right">Storage allocation</th>
              <th className="px-3 py-2 text-right">Streaming</th>
              <th className="px-3 py-2 text-right">Review time</th>
              <th className="px-3 py-2 text-right">Reports</th>
              <th className="px-3 py-2 text-right">Estimated billing</th>
              <th className="px-3 py-2 text-left">Billing status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-white/50">
                  Loading billing information...
                </td>
              </tr>
            ) : snapshots.map((snapshot) => (
              <tr key={snapshot.usage_snapshot_id} className="border-t border-white/10">
                <td className="px-3 py-2">{snapshot.organization?.name ?? snapshot.org_id}</td>
                <td className="px-3 py-2 text-right">{snapshot.uploaded_video_count}</td>
                <td className="px-3 py-2 text-right">{snapshot.active_users ?? 0}</td>
                <td className="px-3 py-2 text-right">{snapshot.active_cameras ?? 0}</td>
                <td className="px-3 py-2 text-right">{snapshot.stored_gb_hours ?? "0"}</td>
                <td className="px-3 py-2 text-right">{snapshot.streamed_seconds}</td>
                <td className="px-3 py-2 text-right">{snapshot.review_minutes}</td>
                <td className="px-3 py-2 text-right">{snapshot.reports_created}</td>
                <td className="px-3 py-2 text-right">
                  {snapshot.currency} {snapshot.platform_estimated_cost}
                </td>
                <td className="px-3 py-2">
                  {snapshot.finalized ? "Finalized" : "Draft"}
                </td>
              </tr>
            ))}
            {!loading && !snapshots.length && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-white/50">
                  No billing information is available for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {scope === "organization" && (
        <div className="border border-white/10 bg-black/30">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="font-semibold">Branch billing allocation</h2>
            <p className="mt-1 text-sm text-white/55">
              Evidence finalized during the selected billing period, grouped by branch.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-4 py-2 text-left">Branch</th>
                  <th className="px-4 py-2 text-right">Evidence files</th>
                  <th className="px-4 py-2 text-right">Uploaded volume</th>
                </tr>
              </thead>
              <tbody>
                {branchBreakdown.map((branch) => (
                  <tr key={branch.branch_id ?? "unassigned"} className="border-t border-white/10">
                    <td className="px-4 py-3">{branch.branch_name}</td>
                    <td className="px-4 py-3 text-right">{branch.uploaded_video_count}</td>
                    <td className="px-4 py-3 text-right">{formatBytes(branch.uploaded_bytes)}</td>
                  </tr>
                ))}
                {!loading && !branchBreakdown.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-7 text-center text-white/50">
                      No finalized evidence was recorded for your branches in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

import { useDeferredValue, useEffect, useState } from "react";
import axios from "axios";
import { UserName } from "../../components/helpers/UserName.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

interface Shift {
  shift_id: string;
  start_time: string;
  end_time: string;
  status: string;
  shift_del_reason?: string;
  deleted_at?: string;
  deleted_by?: string;
  officer?: {
    officer_id: string;
    user?: {
      email: string;
      branch_id?: string;
      user_id?: string;
      branch?: {
        branch_id: string;
        name: string;
      };
    };
  };
  sessions?: { session_id: string }[];
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toDateString() : "N/A";
}

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString() : "N/A";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

export default function Shifts() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);

  const refreshShifts = async (searchValue = deferredSearch) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/shift`, {
        withCredentials: true,
        params: { search: searchValue },
      });
      setShifts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Search failed", err);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshShifts(deferredSearch);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [deferredSearch]);

  const openShift = async (shift: Shift) => {
    setSelectedShift(shift);

    try {
      await axios.post(
        `${API_URL}/shift/access/shift/click`,
        { shift_id: shift.shift_id },
        { withCredentials: true }
      );
    } catch (err) {
      console.error("Failed to log shift click", err);
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 border border-gray-700 bg-body-black p-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Shifts</p>
          <h2 className="mt-1 text-lg font-semibold">Officer shifts operational oversight</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshShifts(deferredSearch)}
            className="border border-white/10 bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:border-red-500/60"
          >
            Refresh
          </button>
          <input
            type="text"
            placeholder="Search shifts..."
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
              <th className="p-2">Branch</th>
              <th className="p-2">Officer Email</th>
              <th className="p-2">Start</th>
              <th className="p-2">End</th>
              <th className="p-2">Status</th>
              <th className="p-2">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400">
                  Loading shifts...
                </td>
              </tr>
            ) : shifts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400">
                  No shifts found
                </td>
              </tr>
            ) : (
              shifts.map((shift) => (
                <tr
                  key={shift.shift_id}
                  onClick={() => void openShift(shift)}
                  className={`cursor-pointer border-b border-gray-700 hover:bg-gray-800 ${
                    selectedShift?.shift_id === shift.shift_id ? "bg-gray-900" : ""
                  }`}
                >
                  <td className="p-2">{shift.officer?.user?.branch?.name ?? "N/A"}</td>
                  <td className="p-2">{shift.officer?.user?.email ?? "UNKNOWN"}</td>
                  <td className="p-2">{formatTime(shift.start_time)}</td>
                  <td className="p-2">{formatTime(shift.end_time)}</td>
                  <td className="p-2">{shift.status}</td>
                  <td className="p-2">{shift.sessions?.length ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border border-gray-700 bg-header-black p-3 text-center text-sm text-gray-400">
        Select a shift row to view the operational overview.
      </div>

      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 px-4 py-8">
          <div className="w-full max-w-4xl border border-white/10 bg-gray-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-header-black p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Shift overview</p>
                <h2 className="mt-1 text-xl font-semibold">Officer shift details</h2>
                <p className="mt-1 text-sm text-white/50">
                  Operational schedule, attendance, sessions, and exception summary.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShift(null)}
                className="border border-white/10 px-3 py-1 text-sm text-white/70 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div className="border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">Status</p>
                <p className="mt-1 text-lg font-bold text-red-200">{selectedShift.status}</p>
              </div>
              <div className="border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">Sessions</p>
                <p className="mt-1 text-lg font-bold">{selectedShift.sessions?.length ?? 0}</p>
              </div>
            </div>

            <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
              <section className="border border-white/10 bg-body-black/70 p-4">
                <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Officer</h3>
                <div className="mt-3 grid gap-2 text-sm">
                  {[
                    ["Branch", selectedShift.officer?.user?.branch?.name ?? "N/A"],
                    ["Officer ID", selectedShift.officer?.officer_id ?? "N/A"],
                    ["Officer email", selectedShift.officer?.user?.email ?? "UNKNOWN"],
                    ["Officer name", <UserName userId={selectedShift.officer?.user?.user_id} />],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex items-center justify-between gap-4 border border-white/10 bg-black/25 px-3 py-2">
                      <span className="text-white/45">{label}</span>
                      <span className="text-right font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-white/10 bg-body-black/70 p-4">
                <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Schedule</h3>
                <div className="mt-3 grid gap-2 text-sm">
                  {[
                    ["Schedule", `${formatDate(selectedShift.start_time)} to ${formatDate(selectedShift.end_time)}`],
                    ["Scheduled start", formatTime(selectedShift.start_time)],
                    ["Scheduled end", formatTime(selectedShift.end_time)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 border border-white/10 bg-black/25 px-3 py-2">
                      <span className="text-white/45">{label}</span>
                      <span className="text-right font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {(selectedShift.deleted_at || selectedShift.shift_del_reason) && (
              <div className="mx-5 mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm">
                <h3 className="font-semibold text-red-200">Deleted shift record</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <p><span className="text-white/45">Reason:</span> {selectedShift.shift_del_reason ?? "N/A"}</p>
                  <p><span className="text-white/45">Deleted at:</span> {formatDateTime(selectedShift.deleted_at)}</p>
                  <p><span className="text-white/45">Deleted by:</span> <UserName userId={selectedShift.deleted_by} /></p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

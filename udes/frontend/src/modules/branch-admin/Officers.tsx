import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { Camera, Officer, Session, Shift, UserStatusHistory } from "../../data/types";
import { ConvertTime } from "../../components/helpers/ConvertTime";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export default function BranchOfficers() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [showOfficersModal, setShowOfficersModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<UserStatusHistory[]>([]);

  const refreshOfficers = useCallback(async (searchValue = deferredSearch, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await axios.get(`${API_URL}/officer`, {
        withCredentials: true,
        params: { search: searchValue },
      });

      const branchOfficers = Array.isArray(res.data)
        ? res.data.filter((officer: Officer) => officer.user?.role === "OFFICER")
        : [];
      setOfficers(branchOfficers);
      return branchOfficers;
    } catch (err) {
      console.error("Failed to load branch officers", err);
      setOfficers([]);
      return [];
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [deferredSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshOfficers(deferredSearch);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [deferredSearch, refreshOfficers]);

  const filteredOfficers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return officers;

    return officers.filter((officer) => {
      const first = officer.user?.first_name?.toLowerCase() ?? "";
      const last = officer.user?.last_name?.toLowerCase() ?? "";
      const email = officer.user?.email?.toLowerCase() ?? "";
      const badge = officer.badge_number?.toLowerCase() ?? "";
      return first.includes(term) || last.includes(term) || email.includes(term) || badge.includes(term);
    });
  }, [officers, searchTerm]);

  const handleSelectOfficer = async (officer: Officer) => {
    setSelectedOfficer(officer);
    setShowOfficersModal(true);
    setSessions([]);
    setShifts([]);
    setCameras([]);

    try {
      await axios.post(
        `${API_URL}/officer/access/officer/click`,
        { officer_id: officer.officer_id },
        { withCredentials: true },
      );
    } catch (err) {
      console.error("Failed to log officer click", err);
    }

    try {
      const [sessionRes, shiftRes, cameraRes] = await Promise.all([
        axios.get(`${API_URL}/officer/${officer.officer_id}/sessions`, { withCredentials: true }),
        axios.get(`${API_URL}/officer/${officer.officer_id}/shifts`, { withCredentials: true }),
        axios.get(`${API_URL}/camera`, { withCredentials: true }),
      ]);

      setSessions(Array.isArray(sessionRes.data) ? sessionRes.data : []);
      setShifts(Array.isArray(shiftRes.data) ? shiftRes.data : []);
      setCameras(
        Array.isArray(cameraRes.data)
          ? cameraRes.data.filter((camera: Camera) => camera.assigned_to === officer.officer_id)
          : [],
      );
    } catch (err) {
      console.error("Failed to load officer details", err);
    }
  };

  const officerVideos = sessions.flatMap((session) => session.videos ?? []);

  return (
    <div className="flex h-full flex-col border border-white/10 bg-body-black text-white">
      <div className="border-b border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Branch Officers</h2>
            <p className="text-sm text-white/50">Officers assigned to this branch only.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshOfficers(deferredSearch)}
              className="border border-white/10 bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:border-red-500/60"
            >
              Refresh
            </button>
            <input
              type="text"
              placeholder="Search name, email, or badge..."
              className="w-72 border border-white/10 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-red-600"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-950 text-xs uppercase text-white/45">
            <tr>
              <th className="p-3">Officer</th>
              <th className="p-3">Email</th>
              <th className="p-3">Badge</th>
              <th className="p-3">Department</th>
              <th className="p-3">Status</th>
              <th className="p-3">Active Cameras</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-white/45">
                  Loading officers...
                </td>
              </tr>
            ) : filteredOfficers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-white/45">
                  No officers found for this branch.
                </td>
              </tr>
            ) : (
              filteredOfficers.map((officer) => (
                <tr
                  key={officer.officer_id}
                  onClick={() => void handleSelectOfficer(officer)}
                  className={`cursor-pointer border-t border-white/10 hover:bg-white/[0.04] ${
                    selectedOfficer?.officer_id === officer.officer_id ? "bg-red-950/20" : ""
                  }`}
                >
                  <td className="p-3 font-semibold">
                    {officer.user?.first_name} {officer.user?.last_name}
                  </td>
                  <td className="p-3">{officer.user?.email ?? "Unknown"}</td>
                  <td className="p-3">{officer.badge_number ?? "N/A"}</td>
                  <td className="p-3">{officer.department ?? "N/A"}</td>
                  <td className="p-3">
                    <span className="border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs text-green-300">
                      {officer.status ?? "N/A"}
                    </span>
                  </td>
                  <td className="p-3">{officer.cameras?.length ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!showOfficersModal && (
        <div className="border-t border-white/10 p-3 text-center text-sm text-white/45">
          Select an officer row to view operational details.
        </div>
      )}

      {showOfficersModal && selectedOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/30 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-red-300">Officer Record</p>
                <h2 className="mt-1 text-xl font-semibold">
                  {selectedOfficer.user?.first_name} {selectedOfficer.user?.last_name}
                </h2>
                <p className="text-sm text-white/50">{selectedOfficer.user?.email}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowOfficersModal(false);
                  setSelectedOfficer(null);
                }}
                className="border border-white/10 px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  ["Officer ID", selectedOfficer.officer_id],
                  ["Badge", selectedOfficer.badge_number ?? "N/A"],
                  ["Department", selectedOfficer.department ?? "N/A"],
                  ["Status", selectedOfficer.status ?? "N/A"],
                  ["Assigned Cameras", String(cameras.length)],
                ].map(([label, value]) => (
                  <section key={label} className="border border-white/10 bg-black/25 p-4">
                    <p className="text-xs uppercase text-white/40">{label}</p>
                    <p className="mt-2 text-sm">{value}</p>
                  </section>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setShowHistoryModal(true);
                    const res = await axios.get(
                      `${API_URL}/user/${selectedOfficer.user.user_id}/status-history`,
                      { withCredentials: true },
                    );
                    setHistory(res.data);
                  }}
                  className="border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/10"
                >
                  View Account History
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <section className="border border-white/10 bg-black/25 p-4">
                  <h3 className="font-semibold">Recent Sessions</h3>
                  <div className="mt-3 max-h-64 overflow-y-auto text-sm text-white/70">
                    {sessions.length === 0 ? (
                      <p className="text-white/45">No sessions recorded</p>
                    ) : (
                      sessions.map((session) => (
                        <div key={session.session_id} className="mb-3 border-b border-white/10 pb-2">
                          <p>{session.status}</p>
                          <p className="text-xs text-white/45">
                            {session.start_time ? new Date(session.start_time).toLocaleString() : "No start"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="border border-white/10 bg-black/25 p-4">
                  <h3 className="font-semibold">Shifts</h3>
                  <div className="mt-3 max-h-64 overflow-y-auto text-sm text-white/70">
                    {shifts.length === 0 ? (
                      <p className="text-white/45">No shifts recorded</p>
                    ) : (
                      shifts.map((shift) => (
                        <div key={shift.shift_id} className="mb-3 border-b border-white/10 pb-2">
                          <p>{shift.status}</p>
                          <p className="text-xs text-white/45">
                            {shift.start_time ? new Date(shift.start_time).toLocaleString() : "No start"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="border border-white/10 bg-black/25 p-4">
                  <h3 className="font-semibold">Videos</h3>
                  <div className="mt-3 max-h-64 overflow-y-auto text-sm text-white/70">
                    {officerVideos.length === 0 ? (
                      <p className="text-white/45">No videos recorded</p>
                    ) : (
                      officerVideos.map((video) => (
                        <div key={video.video_id} className="mb-3 border-b border-white/10 pb-2">
                          <p className="font-mono text-xs">{video.video_id}</p>
                          <p><ConvertTime seconds={video.duration} /></p>
                          <p className="text-xs text-white/45">{video.tamper_flag ? "Tampered" : "Clean"}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[82vh] w-full max-w-xl overflow-y-auto border border-white/10 bg-gray-950 p-5">
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-semibold">Account History</h2>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="border border-white/10 px-3 py-1 text-sm text-white/60 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {history.length === 0 ? (
              <p className="text-white/45">No history found</p>
            ) : (
              history.map((item) => (
                <div key={item.history_id} className="border-b border-white/10 py-3 text-sm">
                  <p><strong>Action:</strong> {item.action === "DISABLED" ? "Disabled" : "Enabled"}</p>
                  <p><strong>Reason:</strong> {item.reason || "N/A"}</p>
                  <p><strong>Date:</strong> {new Date(item.created_at).toLocaleString()}</p>
                  <p>
                    <strong>By:</strong>{" "}
                    {item.performer?.first_name
                      ? `${item.performer.first_name} ${item.performer.last_name}`
                      : item.performed_by}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

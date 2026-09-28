import { useState, useMemo, useEffect, useCallback } from "react";
import axios from "axios";
import { type Session, type Video } from "../../data/types";
import { ConvertTime } from "../../components/helpers/ConvertTime";
import { useActionDialog } from "../../components/modals/ActionDialog";
import {
  evidenceFileName,
  formatEvidenceDate,
  humanizeEvidenceValue,
} from "../../components/helpers/evidenceDisplay";
import { useReportDownload } from "../shared/useReportDownload";

type EnrichedSession = Session & {
  officerName: string;
  cameraSerial: string;
  branchName: string;
  orgName: string;
};

type SessionWithRelations = Session & {
  branch?: { name?: string | null };
  organization?: { name?: string | null };
};

export default function Sessions() {
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);


  const [sessions, setSessions] = useState<SessionWithRelations[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const [showSessionModal, setShowSessionModal] = useState(false);
  const { dialogElement } = useActionDialog();
  const {
    requestDownload,
    dialogElement: reportDownloadDialog,
  } = useReportDownload();

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setError(null);
        setLoading(sessions.length === 0);
        setIsSearching(sessions.length > 0);

        const [sessionRes, videoRes] = await Promise.all([
          axios.get(`${API_URL}/session`, {
            withCredentials: true,
            params: { search },
          }),
          axios.get(`${API_URL}/video`, {
            withCredentials: true,
            params: { search },
          }),
        ]);

        setSessions(Array.isArray(sessionRes.data) ? sessionRes.data : []);
        setVideos(Array.isArray(videoRes.data) ? videoRes.data : []);
      } catch (err) {
        console.error("Failed to load sessions", err);
        setError("Sessions could not be loaded.");
      } finally {
        setLoading(false);
        setIsSearching(false);
      }
    };

    const timer = window.setTimeout(() => {
      void loadSessions();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [API_URL, refreshTick, search]);

  // ======================== DOWNLOAD PDF =========================================
  const downloadPdf = (sessionId: string) => {
    requestDownload({
      url: `/session/pdf/${sessionId}`,
      fileName: `session-${sessionId}.pdf`,
      title: "Download Session Report",
    });
  };

  // --------------------- ENRICH SESSIONS ---------------------
  const enrichedSessions = useMemo<EnrichedSession[]>(() => {
    return sessions.map((s) => ({
      ...s,
      officerName: s.officer?.user
        ? `${s.officer.user.first_name} ${s.officer.user.last_name}`
        : "Unknown",
      cameraSerial: s.camera?.serial_number ?? "—",
      branchName: s.branch?.name ?? "—",
      orgName: s.organization?.name ?? "—",
    }));
  }, [sessions]);
  // --------------------- FILTER SESSIONS ---------------------
  const filteredSessions = enrichedSessions;

  // --------------------- SESSION VIDEOS ---------------------
  const sessionsVideos = useMemo(() => {
    if (!selectedSession) return [];
    return videos.filter((v) => v.session_id === selectedSession.session_id);
  }, [selectedSession, videos]);

  const getStatusClass = useCallback((status: Session["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "text-green-600";
      case "IN_PROGRESS":
        return "text-yellow-500";
      case "INTERRUPTED":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  }, []);

  // --------------------- RENDER ---------------------
  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="flex h-full min-h-[360px] min-w-0 w-full flex-col gap-4 overflow-hidden border border-white/10 bg-body-black p-3 text-white shadow-2xl sm:p-4">

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Sessions</h2>
        <button
          onClick={() => setRefreshTick((tick) => tick + 1)}
          disabled={loading || isSearching}
          className="border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search Serial Number, branch or organization..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 bg-gray-900 border border-gray-700 focus:ring-2 focus:ring-red-600"
      />

      {loading && sessions.length === 0 ? (
        <p className="text-gray-400">Loading sessions...</p>
      ): (
        <>
          {/* Sessions Table */}
          <div className="relative min-h-80 min-w-0 max-h-80 overflow-auto overscroll-contain border border-white/10">
            {isSearching && (
              <div className="absolute inset-x-0 top-0 z-20 bg-gray-900/80 px-3 py-1 text-xs text-gray-400">
                Updating results...
              </div>
            )}
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="sticky top-0 bg-[#17181b] text-[11px] uppercase tracking-[0.1em] text-white/45">
                <tr>
                  <th className="p-2">Officer</th>
                  <th className="p-2">Camera S/N</th>
                  <th className="p-2">Branch</th>
                  <th className="p-2">Organization</th>
                  <th className="p-2">Start</th>
                  <th className="p-2">End</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-400">
                      No sessions found
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr
                      key={s.session_id}
                      onClick={ async () => {
                        setSelectedSession(s);
                        setShowSessionModal(true);

                        // Log the click
                        try {
                          await axios.post(
                            `${API_URL}/session/access/session/click`,
                            { session_id: s.session_id },
                            { withCredentials: true }
                          );
                        } catch (err) {
                          console.error("Failed to log user click", err);
                        }

                      }}
                      className={`border-b border-gray-700 cursor-pointer hover:bg-gray-800 ${
                        selectedSession?.session_id === s.session_id
                          ? "bg-gray-900"
                          : ""
                      }`}
                    >
                      <td className="p-2">{s.officerName}</td>
                      <td className="p-2">{s.cameraSerial}</td>
                      <td className="p-2">{s.branchName}</td>
                      <td className="p-2">{s.orgName}</td>
                      <td className="p-2">{`${new Date(s.start_time).toLocaleDateString()}, ${new Date(s.start_time).toLocaleTimeString()}`}</td>
                      <td className="p-2">{formatEvidenceDate(s.end_time, "In progress")}</td>
                      <td className={`p-2 ${getStatusClass(s.status)}`}>
                        {s.status.replace("_", " ")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Message under table */}
      {!selectedSession && (
        <p className="text-gray-400 text-center mt-2">
          Click a session in the table above to review its operational and evidence details.
        </p>
      )}



      {showSessionModal && selectedSession && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Session evidence record">
          <div className="flex max-h-[94vh] min-w-0 w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#111214] text-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-red-950/40 via-black/25 to-black/10 px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Protected session evidence</p>
                <h2 className="mt-1 text-xl font-semibold">{selectedSession.officerName}</h2>
                <p className="mt-1 text-sm text-white/55">{selectedSession.branchName} / {selectedSession.orgName}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-white/35">{selectedSession.session_id}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                <span className={`border px-3 py-1 text-xs ${selectedSession.status === "COMPLETED" ? "border-green-500/40 bg-green-500/10 text-green-200" : selectedSession.status === "IN_PROGRESS" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-200" : "border-red-500/40 bg-red-500/10 text-red-200"}`}>
                  {humanizeEvidenceValue(selectedSession.status)}
                </span>
                <button
                  onClick={() => {
                    setShowSessionModal(false);
                    setSelectedSession(null);
                  }}
                  className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain p-3 sm:p-5">
              <div className="grid min-w-0 gap-4 xl:grid-cols-3">
                <section className="min-w-0 border border-white/10 bg-white/[0.025] p-4">
                  <h3 className="border-b border-white/10 pb-3 text-sm font-semibold text-white">Session timeline</h3>
                  <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                    <div><dt className="text-xs uppercase text-white/40">Start</dt><dd className="mt-1 text-white/85">{formatEvidenceDate(selectedSession.start_time)}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">End</dt><dd className="mt-1 text-white/85">{formatEvidenceDate(selectedSession.end_time, "In progress")}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">Camera</dt><dd className="mt-1 text-white/85">{selectedSession.camera?.serial_number ?? selectedSession.cameraSerial}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">Session ID</dt><dd className="mt-1 break-all text-xs text-white/70">{selectedSession.session_id}</dd></div>
                  </dl>
                  <p className="mt-4 border-t border-white/10 pt-3 text-sm text-white/60">{selectedSession.notes ?? "No notes available."}</p>
                </section>

                <section className="min-w-0 border border-white/10 bg-white/[0.025] p-4">
                  <h3 className="border-b border-white/10 pb-3 text-sm font-semibold text-white">Officer assignment</h3>
                  <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                    <div><dt className="text-xs uppercase text-white/40">Officer</dt><dd className="mt-1 text-white/85">{selectedSession.officerName}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">Officer ID</dt><dd className="mt-1 break-all font-mono text-xs text-white/70">{selectedSession.officer_id ?? "N/A"}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">Branch</dt><dd className="mt-1 text-white/85">{selectedSession.branchName}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">Organization</dt><dd className="mt-1 text-white/85">{selectedSession.orgName}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">Badge</dt><dd className="mt-1 text-white/85">{selectedSession.officer?.badge_number ?? "Not provided"}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">Department</dt><dd className="mt-1 text-white/85">{selectedSession.officer?.department ?? "Not provided"}</dd></div>
                  </dl>
                </section>

                <section className="min-w-0 border border-white/10 bg-white/[0.025] p-4">
                  <h3 className="border-b border-white/10 pb-3 text-sm font-semibold text-white">Evidence summary</h3>
                  <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-1">
                    <div><dt className="text-xs uppercase text-white/40">Videos</dt><dd className="mt-1 text-white/85">{sessionsVideos.length}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">Camera model</dt><dd className="mt-1 text-white/85">{selectedSession.camera?.model ?? "Not available"}</dd></div>
                    <div><dt className="text-xs uppercase text-white/40">Camera status</dt><dd className="mt-1 text-white/85">{humanizeEvidenceValue(selectedSession.camera?.status)}</dd></div>
                  </dl>
                </section>
              </div>

              <section className="mt-4 min-w-0 border border-white/10 bg-white/[0.025]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="px-4 pt-3"><h3 className="text-sm font-semibold text-white">Evidence recordings</h3><p className="mt-1 text-xs text-white/40">Recordings linked to this session are listed below.</p></div>
                  <button onClick={() => downloadPdf(selectedSession.session_id)} className="mr-4 mt-3 border border-white/10 bg-black/25 px-3 py-2 text-xs font-semibold text-white/70 hover:border-red-500/45 hover:bg-red-500/10">
                    Export session report
                  </button>
                </div>
                {sessionsVideos.length > 0 ? (
                  <div className="max-h-72 min-w-0 overflow-auto overscroll-contain">
                    <table className="w-full min-w-[820px] text-left text-xs">
                      <thead className="sticky top-0 bg-[#17181b] text-[10px] uppercase tracking-[0.12em] text-white/45">
                        <tr>
                          <th className="p-3">Evidence file</th>
                          <th className="p-3">Storage path</th>
                          <th className="p-2">Start</th>
                          <th className="p-2">End</th>
                          <th className="p-2">Duration</th>
                          <th className="p-2">Integrity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsVideos.map((video) => (
                          <tr key={video.video_id} className="border-b border-white/5 hover:bg-white/[0.025]">
                            <td className="max-w-[260px] p-3"><p className="truncate font-semibold text-white/85">{evidenceFileName(video)}</p><p className="mt-1 break-all font-mono text-[10px] text-white/30">{video.video_id}</p></td>
                            <td className="max-w-[340px] break-all p-3 font-mono text-[11px] text-white/55">{video.file_path || "Not available"}</td>
                            <td className="p-2">{formatEvidenceDate(video.start_timestamp)}</td>
                            <td className="p-2">{formatEvidenceDate(video.end_timestamp, "Not available")}</td>
                            <td className="p-2"><ConvertTime seconds={video.duration} /></td>
                            <td className="p-2"><span className={`border px-2 py-1 text-[10px] font-semibold ${video.tamper_flag ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>{video.tamper_flag ? "FLAGGED" : "CLEAR"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-4 text-sm text-white/45">No videos are linked to this session.</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {dialogElement}
      {reportDownloadDialog}
    </div>
  );
}

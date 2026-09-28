import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { Session, Video } from "../../data/types";
import { ConvertTime } from "../helpers/ConvertTime";
import {
  REDACTED_EVIDENCE_PATH,
  evidenceFileName,
  formatEvidenceDate,
  humanizeEvidenceValue,
} from "../helpers/evidenceDisplay";
import { UserName } from "../helpers/UserName";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

type SessionWorkspaceProps = {
  title: string;
  subtitle: string;
  showTenantContext?: boolean;
};

function statusTone(status?: string) {
  if (status === "COMPLETED") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
  if (status === "INTERRUPTED") return "border-red-500/35 bg-red-500/10 text-red-200";
  return "border-amber-500/35 bg-amber-500/10 text-amber-100";
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-b border-white/8 pb-3 last:border-0 last:pb-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</dt>
      <dd className="mt-1 break-words text-sm text-white/85">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-white/10 bg-white/[0.025]">
      <header className="border-b border-white/10 bg-white/[0.025] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function SessionWorkspace({ title, subtitle, showTenantContext = false }: SessionWorkspaceProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (term = deferredSearch) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<Session[]>(`${API_URL}/session`, {
        withCredentials: true,
        params: { search: term },
      });
      setSessions(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      console.error("Failed to load sessions", requestError);
      setSessions([]);
      setError("Sessions could not be loaded. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [deferredSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(deferredSearch), 250);
    return () => window.clearTimeout(timer);
  }, [deferredSearch, refresh]);

  const openSession = async (sessionId: string) => {
    try {
      setDetailsLoading(true);
      const response = await axios.get<Session>(`${API_URL}/session/${sessionId}`, { withCredentials: true });
      setSelectedSession(response.data);
      void axios.post(
        `${API_URL}/session/access/session/click`,
        { session_id: sessionId },
        { withCredentials: true },
      ).catch((auditError) => console.error("Failed to log session click", auditError));
    } catch (requestError) {
      console.error("Failed to load session details", requestError);
      setError("This session's details could not be loaded.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const counts = useMemo(() => ({
    total: sessions.length,
    active: sessions.filter((session) => session.status === "IN_PROGRESS").length,
    completed: sessions.filter((session) => session.status === "COMPLETED").length,
  }), [sessions]);

  const videos = selectedSession?.videos ?? [];
  const officer = selectedSession?.officer?.user;

  return (
    <div className="flex h-full min-h-[360px] min-w-0 flex-col overflow-hidden border border-white/10 bg-body-black text-white shadow-2xl">
      <header className="shrink-0 border-b border-white/10 bg-gradient-to-r from-red-950/35 via-black/20 to-black/5 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Operational records</p>
            <h2 className="mt-1 text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-white/45">{subtitle}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="border border-white/10 bg-black/30 px-3 py-2">{counts.total} total</span>
            <span className="border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100">{counts.active} active</span>
            <span className="border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-100">{counts.completed} completed</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search officer, camera, branch, or organization..."
            className="min-w-[260px] flex-1 border border-white/10 bg-black/35 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-red-500/55"
          />
          <button type="button" onClick={() => void refresh(search)} className="border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold hover:border-red-500/55 hover:bg-red-500/10">
            Refresh
          </button>
        </div>
      </header>

      {error && <div className="border-b border-red-500/25 bg-red-500/10 px-5 py-3 text-sm text-red-100">{error}</div>}

      <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#17181b] text-[11px] uppercase tracking-[0.12em] text-white/45">
            <tr>
              <th className="px-4 py-3">Officer</th>
              <th className="px-4 py-3">Badge</th>
              {showTenantContext && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Camera</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Ended</th>
              <th className="px-4 py-3">Evidence</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-white/40">Loading verified session records...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-white/40">No sessions matched the current search.</td></tr>
            ) : sessions.map((session) => (
              <tr key={session.session_id} className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.035]" onClick={() => void openSession(session.session_id)}>
                <td className="px-4 py-3 font-medium">{session.officer?.user ? `${session.officer.user.first_name} ${session.officer.user.last_name}` : "Unknown officer"}</td>
                <td className="px-4 py-3 text-white/60">{session.officer?.badge_number ?? "Not provided"}</td>
                {showTenantContext && <td className="px-4 py-3 text-white/60">{session.branch?.name ?? session.officer?.user?.branch?.name ?? "Not available"}</td>}
                <td className="px-4 py-3 text-white/60">{session.camera?.serial_number ?? "Not assigned"}</td>
                <td className="px-4 py-3 text-white/60">{formatEvidenceDate(session.start_time)}</td>
                <td className="px-4 py-3 text-white/60">{formatEvidenceDate(session.end_time, "In progress")}</td>
                <td className="px-4 py-3 text-white/60">{session.videos?.length ?? 0} video{session.videos?.length === 1 ? "" : "s"}</td>
                <td className="px-4 py-3"><span className={`inline-flex border px-2 py-1 text-[11px] font-semibold ${statusTone(session.status)}`}>{humanizeEvidenceValue(session.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailsLoading && <div className="absolute inset-0 z-40 grid place-items-center bg-black/55 text-sm text-white/60">Loading session record...</div>}

      {selectedSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Session details">
          <div className="flex max-h-[92vh] min-w-0 w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#111214] shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-red-950/35 to-black/20 px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-300">Verified session record</p>
                <h2 className="mt-1 text-xl font-semibold">{officer ? `${officer.first_name} ${officer.last_name}` : "Session details"}</h2>
                <p className="mt-1 break-all font-mono text-xs text-white/40">{selectedSession.session_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`border px-3 py-2 text-xs font-semibold ${statusTone(selectedSession.status)}`}>{humanizeEvidenceValue(selectedSession.status)}</span>
                <button type="button" onClick={() => setSelectedSession(null)} className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10">Close</button>
              </div>
            </header>

            <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain p-3 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <Section title="Session timeline">
                  <dl className="space-y-3">
                    <Detail label="Started">{formatEvidenceDate(selectedSession.start_time)}</Detail>
                    <Detail label="Ended">{formatEvidenceDate(selectedSession.end_time, "In progress")}</Detail>
                    <Detail label="Shift reference"><span className="font-mono text-xs">{selectedSession.shift_id ?? "Not linked"}</span></Detail>
                    <Detail label="Notes">{selectedSession.notes ?? "No operational notes recorded"}</Detail>
                  </dl>
                </Section>
                <Section title="Officer context">
                  <dl className="space-y-3">
                    <Detail label="Officer">{officer ? `${officer.first_name} ${officer.last_name}` : "Not available"}</Detail>
                    <Detail label="Officer ID"><span className="font-mono text-xs">{selectedSession.officer_id ?? "Not available"}</span></Detail>
                    <Detail label="Badge / Department">{selectedSession.officer?.badge_number ?? "No badge"} · {selectedSession.officer?.department ?? "No department"}</Detail>
                    <Detail label="Role">{humanizeEvidenceValue(officer?.role)}</Detail>
                  </dl>
                </Section>
                <Section title="Camera and tenancy">
                  <dl className="space-y-3">
                    <Detail label="Camera">{selectedSession.camera?.model ?? "Not available"} · {selectedSession.camera?.serial_number ?? "No serial"}</Detail>
                    <Detail label="Assigned by"><UserName userId={selectedSession.camera?.assigned_to_officer_by} showRole /></Detail>
                    <Detail label="Organization">{selectedSession.organization?.name ?? officer?.organization?.name ?? "Not available"}</Detail>
                    <Detail label="Branch">{selectedSession.branch?.name ?? officer?.branch?.name ?? "Not available"}</Detail>
                  </dl>
                </Section>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
                <Section title={`Evidence recordings (${videos.length})`}>
                  {videos.length === 0 ? <p className="text-sm text-white/45">No videos are linked to this session.</p> : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {videos.map((video: Video) => (
                        <article key={video.video_id} className="border border-white/10 bg-black/25 p-4">
                          <p className="break-all text-sm font-semibold text-white">{evidenceFileName(video)}</p>
                          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/55">
                            <div><dt className="uppercase text-white/30">Storage path</dt><dd className="mt-1 font-semibold text-red-200">{REDACTED_EVIDENCE_PATH}</dd></div>
                            <div><dt className="uppercase text-white/30">Storage state</dt><dd className="mt-1">{humanizeEvidenceValue(video.storage_state)}</dd></div>
                            <div><dt className="uppercase text-white/30">Duration</dt><dd className="mt-1"><ConvertTime seconds={video.duration} /></dd></div>
                            <div><dt className="uppercase text-white/30">Integrity</dt><dd className={`mt-1 ${video.tamper_flag ? "text-red-300" : "text-emerald-300"}`}>{video.tamper_flag ? "Flagged" : "No tamper flag"}</dd></div>
                            <div><dt className="uppercase text-white/30">Recorded</dt><dd className="mt-1">{formatEvidenceDate(video.start_timestamp ?? video.created_at)}</dd></div>
                            <div><dt className="uppercase text-white/30">Format</dt><dd className="mt-1">{video.format ?? "Not available"} {video.resolution ? `· ${video.resolution}` : ""}</dd></div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

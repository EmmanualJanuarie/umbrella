import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { type VideoRequest } from "../../data/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

function name(first?: string, last?: string) {
  return `${first ?? ""} ${last ?? ""}`.trim() || "Unavailable";
}

function statusClass(status: string) {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "REJECTED") return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

export default function VideoRequests() {
  const [tab, setTab] = useState<"REQUESTED" | "COMPLETED">("COMPLETED");
  const [requests, setRequests] = useState<VideoRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<VideoRequest[]>(`${API_URL}/video-requests/all`, {
        withCredentials: true,
        params: { search, tab },
      });
      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (loadError) {
      setError(
        axios.isAxiosError(loadError)
          ? loadError.response?.data?.message ?? "Video requests could not be loaded."
          : "Video requests could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRequests(), 250);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  return (
    <div className="h-full overflow-y-auto bg-body-black p-4 pb-10 text-white">
      <header className="border border-white/10 bg-gradient-to-r from-red-950/40 via-[#151619] to-[#111214] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Umbrella platform controls</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-2xl font-semibold">Video Download Activity</h1><p className="mt-2 max-w-3xl text-sm text-white/55">Eligible branch video requests are approved automatically by the backend after ownership and verification checks. The branded export and every download remain fully audited.</p></div>
          <button type="button" onClick={() => void loadRequests()} disabled={loading} className="border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/5 disabled:opacity-45">{loading ? "Refreshing..." : "Refresh"}</button>
        </div>
      </header>

      {error && <div className="mt-4 border border-red-500/35 bg-red-950/30 p-4 text-sm text-red-100">{error}</div>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border border-white/10 bg-black/20 p-3">
        <button type="button" onClick={() => setTab("REQUESTED")} className={`px-4 py-2 text-sm font-semibold ${tab === "REQUESTED" ? "bg-red-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>Processing</button>
        <button type="button" onClick={() => setTab("COMPLETED")} className={`px-4 py-2 text-sm font-semibold ${tab === "COMPLETED" ? "bg-red-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>Approved history</button>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ticket, requester, branch, officer, camera..." className="min-w-[280px] flex-1 border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-red-500/60" />
      </div>

      <section className="mt-3 overflow-hidden border border-white/10 bg-white/[0.02]">
        <div className="overflow-auto">
          <table className="w-full min-w-[1380px] text-left text-sm">
            <thead className="sticky top-0 bg-[#17181b] text-xs uppercase tracking-wide text-white/40">
              <tr><th className="p-3">Request</th><th className="p-3">Requesting user</th><th className="p-3">Organization / branch</th><th className="p-3">Officer / camera</th><th className="p-3">Evidence</th><th className="p-3">Purpose and note</th><th className="p-3">Status</th><th className="p-3">Decision</th></tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const session = request.video?.session;
                return (
                  <tr key={request.request_id} className="border-t border-white/5 align-top hover:bg-white/[0.02]">
                    <td className="p-3"><p>{new Date(request.created_at).toLocaleString()}</p><p className="mt-1 max-w-[180px] break-all font-mono text-xs text-white/35">{request.request_id}</p></td>
                    <td className="p-3"><p className="font-medium">{name(request.requester?.first_name, request.requester?.last_name)}</p><p className="mt-1 text-xs text-white/45">{request.requester?.email ?? "No email"}</p><p className="mt-1 font-mono text-[11px] text-white/30">{request.requested_by}</p></td>
                    <td className="p-3"><p>{request.requester?.organization?.name ?? "Unavailable"}</p><p className="mt-1 text-xs text-white/45">{request.requester?.branch?.name ?? "Unavailable"}</p></td>
                    <td className="p-3"><p>{name(session?.officer?.user?.first_name, session?.officer?.user?.last_name)}</p><p className="mt-1 text-xs text-white/45">Badge {session?.officer?.badge_number ?? "N/A"} · Camera {session?.camera?.serial_number ?? "N/A"}</p></td>
                    <td className="p-3"><p className="max-w-[220px] break-all font-mono text-xs">{request.video_id}</p><p className="mt-1 max-w-[220px] truncate text-xs text-white/35">{request.video?.file_path ?? "No evidence path"}</p></td>
                    <td className="max-w-xs p-3"><p className="font-medium">{request.request_type.replaceAll("_", " ")}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-white/50">{request.requester_note || "No requester note"}</p></td>
                    <td className="p-3"><span className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusClass(request.status)}`}>{request.status}</span>{request.status === "APPROVED" && <p className="mt-2 text-xs text-white/55">Export: {(request.export_status ?? "NOT_REQUESTED").replaceAll("_", " ")}</p>}{request.export_status === "FAILED" && request.export_last_error && <p className="mt-1 max-w-[220px] break-words text-xs text-red-300">{request.export_last_error}</p>}{request.download_expires_at && <p className="mt-2 text-xs text-white/40">Window ends {new Date(request.download_expires_at).toLocaleString()}</p>}</td>
                    <td className="w-[280px] p-3">
                      <div><p className="text-xs leading-5 text-white/60">{request.handler_note ?? "Awaiting automated eligibility checks"}</p><p className="mt-2 text-xs text-white/35">{request.handled_at ? `Automated ${new Date(request.handled_at).toLocaleString()}` : "Awaiting secure processing"}</p></div>
                    </td>
                  </tr>
                );
              })}
              {!loading && requests.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-white/40">No video requests match this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

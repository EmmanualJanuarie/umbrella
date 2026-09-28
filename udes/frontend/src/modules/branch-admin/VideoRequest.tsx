import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { RequestType, Video, VideoRequest } from "../../data/types";
import RequestVideoModal, { type RequestableVideo } from "./modals/RequestVideoModal";
import { REDACTED_EVIDENCE_PATH, evidenceFileName } from "../../components/helpers/evidenceDisplay";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

type CatalogueVideo = Video & {
  session?: (NonNullable<Video["session"]> & {
    branch?: { name?: string } | null;
    organization?: { name?: string } | null;
  }) | null;
};

function personName(firstName?: string, lastName?: string) {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Unavailable";
}

function statusClass(status: string) {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "REJECTED") return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

export default function BranchRequests() {
  const [videos, setVideos] = useState<CatalogueVideo[]>([]);
  const [requests, setRequests] = useState<VideoRequest[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<RequestableVideo | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [videoResponse, requestResponse] = await Promise.all([
        axios.get<CatalogueVideo[]>(`${API_URL}/video`, {
          withCredentials: true,
          params: { search },
        }),
        axios.get<VideoRequest[]>(`${API_URL}/video-requests/mine`, {
          withCredentials: true,
          params: { search },
        }),
      ]);
      setVideos(Array.isArray(videoResponse.data) ? videoResponse.data : []);
      setRequests(Array.isArray(requestResponse.data) ? requestResponse.data : []);
    } catch (loadError) {
      setError(
        axios.isAxiosError(loadError)
          ? loadError.response?.data?.message ?? "Video requests could not be loaded."
          : "Video requests could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRequests(), 250);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  useEffect(() => {
    const hasActiveExport = requests.some(
      (request) =>
        request.status === "APPROVED" &&
        (request.export_status === "QUEUED" || request.export_status === "PROCESSING"),
    );
    const interval = window.setInterval(
      () => void loadRequests(true),
      hasActiveExport ? 10_000 : 30_000,
    );
    return () => window.clearInterval(interval);
  }, [loadRequests, requests]);

  const groupedVideos = useMemo(() => {
    const pendingVideoIds = new Set(
      requests
        .filter((request) => request.status === "PENDING")
        .map((request) => request.video_id),
    );
    const groups = new Map<string, Map<string, CatalogueVideo[]>>();
    for (const video of videos) {
      if (pendingVideoIds.has(video.video_id) || video.deleted_at) continue;
      const branchName = video.session?.branch?.name ?? "Branch unavailable";
      const officer = video.session?.officer;
      const officerLabel = `${personName(officer?.user?.first_name, officer?.user?.last_name)}|${officer?.officer_id ?? video.session?.officer_id ?? "unknown"}`;
      const branch = groups.get(branchName) ?? new Map<string, Video[]>();
      const officerVideos = branch.get(officerLabel) ?? [];
      officerVideos.push(video);
      branch.set(officerLabel, officerVideos);
      groups.set(branchName, branch);
    }
    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([branchName, officers]) => ({
        branchName,
        officers: [...officers.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([officerKey, officerVideos]) => ({
            officerKey,
            officerName: officerKey.split("|")[0],
            officerId: officerKey.split("|")[1],
            videos: officerVideos.sort(
              (left, right) =>
                new Date(right.start_timestamp).getTime() -
                new Date(left.start_timestamp).getTime(),
            ),
          })),
      }));
  }, [requests, videos]);

  const availableDownloads = useMemo(
    () => requests.filter((request) => request.download_available),
    [requests],
  );

  const submitRequest = async (
    reason: RequestType,
    note?: string,
  ) => {
    if (!selectedVideo) return;
    try {
      await axios.post(
        `${API_URL}/video-requests`,
        {
          video_id: selectedVideo.video_id,
          request_type: reason,
          requester_note: note ?? "",
        },
        { withCredentials: true },
      );
      setSelectedVideo(null);
      await loadRequests();
    } catch (submitError) {
      setError(
        axios.isAxiosError(submitError)
          ? submitError.response?.data?.message ?? "The video request could not be submitted."
          : "The video request could not be submitted.",
      );
    }
  };

  const downloadApprovedVideo = async (request: VideoRequest) => {
    setDownloadingId(request.request_id);
    setError(null);
    const link = document.createElement("a");
    link.href = `${API_URL}/video-requests/${request.request_id}/download`;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 5000));
    await loadRequests(true);
    setDownloadingId(null);
  };

  return (
    <div className="h-full overflow-y-auto bg-body-black p-4 pb-10 text-white">
      <header className="border border-white/10 bg-gradient-to-r from-red-950/40 via-[#151619] to-[#111214] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Branch operations workspace</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Video Download Requests</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/55">
              Submit an evidence-video request, track Umbrella’s decision, and download an approved branded export during its server-controlled one-hour window.
            </p>
          </div>
          <button type="button" onClick={() => void loadRequests()} disabled={loading} className="border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/5 disabled:opacity-45">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && <div className="mt-4 border border-red-500/35 bg-red-950/30 p-4 text-sm text-red-100">{error}</div>}

      <section className="mt-4 border border-white/10 bg-white/[0.025]">
        <div className="border-b border-white/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Branch Video Catalogue</h2>
              <p className="mt-1 text-sm text-white/45">Request any available officer video in your branch.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/45">
              <span className="border border-white/10 bg-white/[0.03] px-2 py-1">{videos.length} videos loaded</span>
            </div>
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search officer, officer ID, branch, camera, video, format..." className="mt-3 w-full border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-red-500/60" />
        </div>
        <div className="max-h-[560px] space-y-4 overflow-auto p-3">
          {groupedVideos.map((branch) => (
            <section key={branch.branchName} className="border border-white/10 bg-black/20">
              <div className="border-b border-white/10 bg-[#17181b] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Branch</p>
                <h3 className="mt-1 font-semibold">{branch.branchName}</h3>
              </div>
              <div className="space-y-3 p-3">
                {branch.officers.map((officer) => (
                  <article key={officer.officerKey} className="overflow-hidden border border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white/[0.035] px-3 py-2">
                      <div>
                        <p className="font-medium">{officer.officerName}</p>
                        <p className="font-mono text-[11px] text-white/40">Officer ID: {officer.officerId}</p>
                      </div>
                      <span className="text-xs text-white/40">{officer.videos.length} available video{officer.videos.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="bg-black/35 text-xs uppercase tracking-wide text-white/35">
                          <tr><th className="p-3">Recording</th><th className="p-3">Camera</th><th className="p-3">Video</th><th className="p-3">Evidence classification</th><th className="p-3">Storage</th><th className="p-3 text-right">Action</th></tr>
                        </thead>
                        <tbody>
                          {officer.videos.map((video) => {
                            return (
                              <tr key={video.video_id} className="border-t border-white/5 hover:bg-white/[0.025]">
                                <td className="p-3"><p>{new Date(video.start_timestamp).toLocaleString()}</p><p className="mt-1 text-xs text-white/35">{Math.max(1, Math.round(video.duration / 60))} min</p></td>
                                <td className="p-3 font-mono text-xs text-white/60">{video.session?.camera?.serial_number ?? "Unavailable"}</td>
                                <td className="max-w-[240px] p-3"><p className="truncate text-sm font-medium">{evidenceFileName(video)}</p><p className="mt-1 break-all font-mono text-[11px] text-white/35">{video.video_id}</p><p className="mt-1 text-xs text-red-200/55">Path: {REDACTED_EVIDENCE_PATH}</p></td>
                                <td className="p-3">
                                  <span className="inline-flex border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-xs text-sky-200">EVIDENCE RECORD</span>
                                </td>
                                <td className="p-3 text-xs text-white/55">{video.storage_state.replaceAll("_", " ")}</td>
                                <td className="p-3 text-right"><button type="button" onClick={() => setSelectedVideo(video as RequestableVideo)} className="bg-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-500">Request download</button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {!loading && groupedVideos.length === 0 && <div className="p-10 text-center text-white/40">No videos are currently available for a new request.</div>}
        </div>
      </section>

      <section className="mt-4 border border-white/10 bg-white/[0.025]">
        <div className="border-b border-white/10 p-4"><h2 className="font-semibold">Submitted Requests</h2><p className="mt-1 text-sm text-white/45">The complete request and decision history for your Branch Admin account.</p></div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="sticky top-0 bg-[#17181b] text-xs uppercase tracking-wide text-white/40">
              <tr><th className="p-3">Requested</th><th className="p-3">Officer</th><th className="p-3">Reason</th><th className="p-3">Status</th><th className="p-3">Requester</th><th className="p-3">Decision note</th><th className="p-3">Handled</th></tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.request_id} className="border-t border-white/5 align-top hover:bg-white/[0.02]">
                  <td className="p-3"><p>{new Date(request.created_at).toLocaleString()}</p><p className="mt-1 font-mono text-xs text-white/35">{request.request_id}</p></td>
                  <td className="p-3">{personName(request.video?.session?.officer?.user?.first_name, request.video?.session?.officer?.user?.last_name)}</td>
                  <td className="p-3">{request.request_type.replaceAll("_", " ")}</td>
                  <td className="p-3">
                    <span className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusClass(request.status)}`}>{request.status}</span>
                    {request.status === "APPROVED" && request.export_status === "READY" && <p className="mt-2 text-xs text-emerald-300">Finalized MP4 ready</p>}
                    {request.status === "APPROVED" && request.export_status !== "READY" && (
                      <div className={`mt-2 text-xs ${request.export_status === "FAILED" ? "text-red-300" : "text-amber-300"}`}>
                        <p>{request.export_status === "FAILED" ? "Finalized export failed" : request.export_status === "QUEUED" ? "Waiting for export worker" : "Preparing finalized MP4"}</p>
                        {(request.export_status === "QUEUED" || request.export_status === "PROCESSING") && (
                          <p className="mt-1 text-white/45">
                            {request.export_estimate_delayed
                              ? "Taking longer than estimated; processing continues securely."
                              : request.export_estimated_remaining_min != null && request.export_estimated_remaining_max != null
                                ? `Estimated time remaining: ${request.export_estimated_remaining_min}-${request.export_estimated_remaining_max} minutes`
                                : "Calculating estimated completion time..."}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3">{personName(request.requester?.first_name, request.requester?.last_name)}</td>
                  <td className="max-w-xs p-3 text-white/60">{request.handler_note ?? "Awaiting Umbrella decision"}</td>
                  <td className="p-3 text-white/60">{request.handled_at ? new Date(request.handled_at).toLocaleString() : "Not handled"}</td>
                </tr>
              ))}
              {!loading && requests.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-white/40">No video requests have been submitted.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {availableDownloads.length > 0 && (
        <section className="mt-4 border border-emerald-500/25 bg-emerald-950/10">
          <div className="border-b border-emerald-500/20 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Server-authorized exports</p><h2 className="mt-1 text-lg font-semibold">Approved Videos Available for Download</h2><p className="mt-1 text-sm text-white/50">This section disappears when the backend’s one-hour availability window expires.</p></div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {availableDownloads.map((request) => (
              <article key={request.request_id} className="border border-white/10 bg-black/25 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{personName(request.video?.session?.officer?.user?.first_name, request.video?.session?.officer?.user?.last_name)}</p><p className="mt-1 text-xs text-white/45">Badge {request.video?.session?.officer?.badge_number ?? "N/A"} · Video {request.video_id}</p></div><span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">APPROVED</span></div>
                <p className="mt-3 text-sm text-white/55">Available until <strong className="text-white/80">{request.download_expires_at ? new Date(request.download_expires_at).toLocaleString() : "Unavailable"}</strong></p>
                <p className="mt-2 text-xs leading-5 text-white/40">The downloaded MP4 is permanently branded with Umbrella and officer-identification information.</p>
                <button type="button" onClick={() => void downloadApprovedVideo(request)} disabled={downloadingId === request.request_id} className="mt-4 w-full bg-red-600 px-4 py-2.5 text-sm font-semibold hover:bg-red-500 disabled:opacity-45">{downloadingId === request.request_id ? "Preparing branded export..." : "Download branded video"}</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedVideo && (
        <RequestVideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onSubmit={submitRequest}
        />
      )}
    </div>
  );
}

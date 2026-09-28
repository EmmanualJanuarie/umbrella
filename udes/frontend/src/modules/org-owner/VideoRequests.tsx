import { useEffect, useState } from "react";
import axios from "axios";
import { ROLE, type VideoRequest } from "../../data/types";
import { useUser } from "../../context/UserContext";
import { UserName } from "../../components/helpers/UserName";
import {
  REDACTED_EVIDENCE_PATH,
  evidenceFileName,
  formatEvidenceDate,
  humanizeEvidenceValue,
} from "../../components/helpers/evidenceDisplay";

type RequestRecord = VideoRequest;
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

function requestTone(status: string) {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "REJECTED") return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

function RequestField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="border-b border-white/8 pb-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">{label}</dt><dd className="mt-1 break-words text-sm text-white/80">{children}</dd></div>;
}

export default function VideoRequests() {
  const [selectedTab, setSelectedTab] = useState<"REQUESTED" | "COMPLETED">("REQUESTED");
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useUser();

  const refreshRequests = async () => {
    if (!user || user.role !== ROLE.ORG_OWNER) return;
    try {
      setLoading(true);
      const response = await axios.get<RequestRecord[]>(`${API_URL}/video-requests/org/${user.org_id}`, {
        withCredentials: true,
        params: { search: searchTerm, tab: selectedTab },
      });
      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch organization video requests", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshRequests(), 250);
    return () => window.clearTimeout(timer);
  }, [user, searchTerm, selectedTab]);

  const openRequest = async (request: RequestRecord) => {
    setSelectedRequest(request);
    try {
      await axios.post(`${API_URL}/video-requests/access/video-request/request/click`, { request_id: request.request_id }, { withCredentials: true });
    } catch (error) {
      console.error("Failed to audit request access", error);
    }
  };

  return (
    <div className="flex h-full min-h-[360px] min-w-0 flex-col overflow-hidden border border-white/10 bg-body-black text-white shadow-2xl">
      <header className="shrink-0 border-b border-white/10 bg-gradient-to-r from-red-950/35 to-black/15 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Controlled evidence access</p><h2 className="mt-1 text-xl font-semibold">Video Export Requests</h2><p className="mt-1 text-sm text-white/45">Monitor branch requests and finalized evidence exports across your organization.</p></div>
          <button type="button" onClick={() => void refreshRequests()} className="border border-white/10 bg-black/30 px-4 py-2 text-sm font-semibold hover:border-red-500/55">Refresh</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["REQUESTED", "COMPLETED"] as const).map((tab) => <button key={tab} type="button" onClick={() => setSelectedTab(tab)} className={`border px-4 py-2 text-sm font-semibold ${selectedTab === tab ? "border-red-500/55 bg-red-500/15 text-red-100" : "border-white/10 bg-black/25 text-white/55 hover:text-white"}`}>{tab === "REQUESTED" ? "Requested / In progress" : "Completed"}</button>)}
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search requester, officer, branch, video..." className="ml-auto min-w-[280px] flex-1 border border-white/10 bg-black/35 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-red-500/55" />
        </div>
      </header>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#17181b] text-[11px] uppercase tracking-[0.12em] text-white/40"><tr><th className="px-4 py-3">Requester</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Evidence file</th><th className="px-4 py-3">Officer</th><th className="px-4 py-3">Camera</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="p-12 text-center text-white/40">Loading request records...</td></tr> : requests.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-white/40">No requests matched this view.</td></tr> : requests.map((request) => {
              const officer = request.video?.session?.officer?.user;
              return <tr key={request.request_id} onClick={() => void openRequest(request)} className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.035]">
                <td className="px-4 py-3"><p className="font-medium">{request.requester ? `${request.requester.first_name} ${request.requester.last_name}` : "Unknown requester"}</p><p className="text-xs text-white/35">{request.requester?.email ?? "No email"}</p></td>
                <td className="px-4 py-3 text-white/60">{request.requester?.branch?.name ?? request.video?.session?.branch?.name ?? "Not available"}</td>
                <td className="px-4 py-3"><p className="max-w-[260px] truncate font-medium">{evidenceFileName(request.video)}</p><p className="text-xs text-red-200/60">Path: {REDACTED_EVIDENCE_PATH}</p></td>
                <td className="px-4 py-3 text-white/60">{officer ? `${officer.first_name} ${officer.last_name}` : "Not available"}</td>
                <td className="px-4 py-3 text-white/60">{request.video?.session?.camera?.serial_number ?? "Not available"}</td>
                <td className="px-4 py-3 text-white/60">{formatEvidenceDate(request.created_at)}</td>
                <td className="px-4 py-3"><span className={`border px-2 py-1 text-[11px] font-semibold ${requestTone(request.status)}`}>{humanizeEvidenceValue(request.status)}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      {selectedRequest && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Video request details">
        <div className="flex max-h-[90vh] min-w-0 w-full max-w-4xl flex-col overflow-hidden border border-white/10 bg-[#111214] shadow-2xl">
          <header className="flex items-start justify-between border-b border-white/10 bg-gradient-to-r from-red-950/35 to-black/20 p-5"><div><p className="text-[11px] uppercase tracking-[0.18em] text-red-300">Export authorization record</p><h2 className="mt-1 text-xl font-semibold">Video Request Details</h2><p className="mt-1 break-all font-mono text-xs text-white/35">{selectedRequest.request_id}</p></div><button type="button" onClick={() => setSelectedRequest(null)} className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10">Close</button></header>
          <div className="grid min-h-0 min-w-0 gap-4 overflow-auto overscroll-contain p-3 sm:p-5 md:grid-cols-2">
            <section className="border border-white/10 bg-white/[0.025] p-4"><h3 className="mb-4 border-b border-white/10 pb-3 text-sm font-semibold">Request and requester</h3><dl className="space-y-3"><RequestField label="Type">{humanizeEvidenceValue(selectedRequest.request_type)}</RequestField><RequestField label="Status"><span className={`inline-flex border px-2 py-1 text-xs ${requestTone(selectedRequest.status)}`}>{humanizeEvidenceValue(selectedRequest.status)}</span></RequestField><RequestField label="Requester"><UserName userId={selectedRequest.requested_by} showRole /></RequestField><RequestField label="Requested at">{formatEvidenceDate(selectedRequest.created_at)}</RequestField><RequestField label="Requester note">{selectedRequest.requester_note ?? "No note provided"}</RequestField></dl></section>
            <section className="border border-white/10 bg-white/[0.025] p-4"><h3 className="mb-4 border-b border-white/10 pb-3 text-sm font-semibold">Evidence identification</h3><dl className="space-y-3"><RequestField label="Video name">{evidenceFileName(selectedRequest.video)}</RequestField><RequestField label="Storage path"><span className="font-semibold text-red-200">{REDACTED_EVIDENCE_PATH}</span></RequestField><RequestField label="Video ID"><span className="break-all font-mono text-xs">{selectedRequest.video_id}</span></RequestField><RequestField label="Officer">{selectedRequest.video?.session?.officer?.user ? `${selectedRequest.video.session.officer.user.first_name} ${selectedRequest.video.session.officer.user.last_name}` : "Not available"}</RequestField><RequestField label="Camera">{selectedRequest.video?.session?.camera?.serial_number ?? "Not available"}</RequestField></dl></section>
            <section className="border border-white/10 bg-white/[0.025] p-4 md:col-span-2"><h3 className="mb-4 border-b border-white/10 pb-3 text-sm font-semibold">Authorization outcome</h3><dl className="grid gap-3 md:grid-cols-3"><RequestField label="Handled by">{selectedRequest.handler ? <UserName userId={selectedRequest.handled_by} showRole /> : "Awaiting review"}</RequestField><RequestField label="Handled at">{formatEvidenceDate(selectedRequest.handled_at, "Awaiting review")}</RequestField><RequestField label="Handler note">{selectedRequest.handler_note ?? "No decision note recorded"}</RequestField></dl></section>
          </div>
        </div>
      </div>}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CAMERA_STATUS, type Camera, type Session, type Video } from "../../data/types";
import { ConvertTime } from "../../components/helpers/ConvertTime";
import { REDACTED_EVIDENCE_PATH, evidenceFileName, formatEvidenceDate, humanizeEvidenceValue } from "../../components/helpers/evidenceDisplay";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
type CameraDetails = Camera & { sessions?: Session[] };

function statusTone(status?: string) {
  return status === CAMERA_STATUS.ACTIVE ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">{label}</dt><dd className="mt-1 break-words text-sm text-white/80">{value}</dd></div>;
}

export default function OfficerCameras() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get<Camera[]>(`${API_URL}/camera`, { withCredentials: true });
      setCameras(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch assigned cameras", error);
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const openCamera = async (cameraId: string) => {
    try {
      setDetailsLoading(true);
      const response = await axios.get<CameraDetails>(`${API_URL}/camera/${cameraId}/details`, { withCredentials: true });
      setSelectedCamera(response.data);
      void axios.post(`${API_URL}/camera/access/camera/click`, { camera_id: cameraId }, { withCredentials: true }).catch((error) => console.error("Failed to audit camera click", error));
    } catch (error) {
      console.error("Failed to fetch camera details", error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const latestSession = useMemo(() => {
    return [...(selectedCamera?.sessions ?? [])].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0];
  }, [selectedCamera]);
  const latestVideo: Video | undefined = useMemo(() => {
    return [...(latestSession?.videos ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  }, [latestSession]);

  return (
    <div className="flex h-full min-h-[360px] min-w-0 flex-col overflow-hidden border border-white/10 bg-body-black text-white shadow-2xl">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-red-950/35 to-black/15 px-4 py-4 sm:px-5">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Assigned equipment</p><h2 className="mt-1 text-xl font-semibold">My Cameras</h2><p className="mt-1 text-sm text-white/45">Review your current camera assignment and its latest operational record.</p></div>
        <div className="flex items-center gap-2"><span className="border border-white/10 bg-black/30 px-3 py-2 text-xs">{cameras.length} assigned</span><button type="button" onClick={() => void refresh()} className="border border-white/10 bg-black/30 px-4 py-2 text-sm font-semibold hover:border-red-500/55">Refresh</button></div>
      </header>

      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(160px,34vh)_minmax(240px,1fr)] lg:grid-cols-[330px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="min-h-0 min-w-0 overflow-y-scroll overscroll-contain border-b border-white/10 bg-black/15 lg:border-b-0 lg:border-r">
          {loading ? <p className="p-6 text-sm text-white/40">Loading assigned cameras...</p> : cameras.length === 0 ? <p className="p-6 text-sm text-white/40">No cameras are currently assigned to you.</p> : cameras.map((camera) => <button key={camera.camera_id} type="button" onClick={() => void openCamera(camera.camera_id)} className={`block w-full border-b border-white/5 p-4 text-left transition hover:bg-white/[0.04] ${selectedCamera?.camera_id === camera.camera_id ? "border-l-2 border-l-red-500 bg-white/[0.045]" : ""}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{camera.model}</p><p className="mt-1 font-mono text-xs text-white/40">{camera.serial_number}</p></div><span className={`border px-2 py-1 text-[10px] font-semibold ${statusTone(camera.status)}`}>{humanizeEvidenceValue(camera.status)}</span></div></button>)}
        </aside>

        <main className="min-h-0 min-w-0 overflow-auto overscroll-contain p-3 sm:p-5">
          {detailsLoading ? <div className="grid min-h-[320px] place-items-center text-sm text-white/40">Loading camera record...</div> : !selectedCamera ? <div className="grid min-h-[320px] place-items-center border border-dashed border-white/10 bg-white/[0.015] text-center text-white/40"><div><p className="font-medium text-white/60">Select an assigned camera</p><p className="mt-1 text-sm">Camera, session, and evidence details will appear here.</p></div></div> : <div className="space-y-4">
            <section className="border border-white/10 bg-white/[0.025]"><header className="border-b border-white/10 px-4 py-3"><h3 className="font-semibold">Camera information</h3></header><dl className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4"><Info label="Model" value={selectedCamera.model} /><Info label="Serial number" value={<span className="font-mono text-xs">{selectedCamera.serial_number}</span>} /><Info label="Type" value={humanizeEvidenceValue(selectedCamera.type)} /><Info label="Status" value={<span className={`inline-flex border px-2 py-1 text-xs ${statusTone(selectedCamera.status)}`}>{humanizeEvidenceValue(selectedCamera.status)}</span>} /></dl></section>
            <section className="border border-white/10 bg-white/[0.025]"><header className="border-b border-white/10 px-4 py-3"><h3 className="font-semibold">Latest linked session</h3></header>{latestSession ? <dl className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4"><Info label="Started" value={formatEvidenceDate(latestSession.start_time)} /><Info label="Ended" value={formatEvidenceDate(latestSession.end_time, "In progress")} /><Info label="Status" value={humanizeEvidenceValue(latestSession.status)} /><Info label="Session ID" value={<span className="break-all font-mono text-xs">{latestSession.session_id}</span>} /></dl> : <p className="p-4 text-sm text-white/40">No session is linked to this camera.</p>}</section>
            <section className="border border-white/10 bg-white/[0.025]"><header className="border-b border-white/10 px-4 py-3"><h3 className="font-semibold">Latest evidence recording</h3></header>{latestVideo ? <div className="p-4"><p className="font-semibold">{evidenceFileName(latestVideo)}</p><dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Info label="Storage path" value={<span className="font-semibold text-red-200">{REDACTED_EVIDENCE_PATH}</span>} /><Info label="Duration" value={<ConvertTime seconds={latestVideo.duration} />} /><Info label="Recorded" value={formatEvidenceDate(latestVideo.created_at)} /><Info label="Integrity" value={latestVideo.tamper_flag ? <span className="text-red-300">Flagged</span> : <span className="text-emerald-300">No tamper flag</span>} /></dl><p className="mt-4 border border-white/8 bg-black/20 p-3 text-xs text-white/40">Open the Videos section to securely stream this recording.</p></div> : <p className="p-4 text-sm text-white/40">No video is linked to the latest session.</p>}</section>
          </div>}
        </main>
      </div>
    </div>
  );
}

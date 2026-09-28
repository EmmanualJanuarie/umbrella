import { useState } from "react";
import { REQUEST_TYPE, type RequestType } from "../../../data/types";

export type RequestableVideo = {
  video_id: string;
  start_timestamp: string;
  duration: number;
  storage_state?: string;
  session?: {
    session_id?: string;
    officer_id?: string;
    officer?: {
      officer_id: string;
      badge_number?: string | null;
      user?: { first_name?: string; last_name?: string };
    } | null;
    camera?: { serial_number?: string } | null;
    branch?: { name?: string } | null;
    organization?: { name?: string } | null;
  } | null;
};

type Props = {
  video: RequestableVideo;
  onClose: () => void;
  onSubmit: (reason: RequestType, note?: string) => void;
};

const reasonOptions: Array<{ value: RequestType; label: string }> = [
  { value: REQUEST_TYPE.COURT_CASE, label: "Court case evidence" },
  { value: REQUEST_TYPE.INTERNAL_INVESTIGATION, label: "Internal investigation" },
  { value: REQUEST_TYPE.DISCIPLINARY_REVIEW, label: "Disciplinary review" },
  { value: REQUEST_TYPE.LEGAL_DISCLOSURE, label: "Legal or regulatory disclosure" },
  { value: REQUEST_TYPE.INSURANCE_CLAIM, label: "Insurance claim" },
  { value: REQUEST_TYPE.TRAINING_REVIEW, label: "Authorized training review" },
  { value: REQUEST_TYPE.PUBLIC_COMPLAINT, label: "Public complaint investigation" },
  { value: REQUEST_TYPE.INCIDENT_REVIEW, label: "Operational incident review" },
  { value: REQUEST_TYPE.DATA_SUBJECT_REQUEST, label: "Data-subject access request" },
  { value: REQUEST_TYPE.GOV_DELETE, label: "Government-ordered retention or deletion matter" },
  { value: REQUEST_TYPE.OTHER, label: "Other authorized purpose" },
];

function officerName(video: RequestableVideo) {
  const user = video.session?.officer?.user;
  return `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "Unavailable";
}

export default function RequestVideoModal({ video, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<RequestType>(REQUEST_TYPE.COURT_CASE);
  const [note, setNote] = useState("");
  const noteRequired = reason === REQUEST_TYPE.OTHER;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="request-video-title" className="w-full max-w-2xl border border-white/15 bg-[#111214] text-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-red-950/40 to-black/30 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Controlled evidence disclosure</p>
            <h2 id="request-video-title" className="mt-1 text-xl font-semibold">Request Video Download</h2>
          </div>
          <button type="button" onClick={onClose} className="border border-white/10 px-3 py-2 text-sm text-white/65 hover:bg-white/10">Close</button>
        </header>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Officer", officerName(video)],
              ["Officer ID", video.session?.officer?.officer_id ?? video.session?.officer_id ?? "Unavailable"],
              ["Badge number", video.session?.officer?.badge_number ?? "N/A"],
              ["Branch", video.session?.branch?.name ?? "Unavailable"],
              ["Camera", video.session?.camera?.serial_number ?? "Unavailable"],
              ["Recording started", new Date(video.start_timestamp).toLocaleString()],
              ["Video ID", video.video_id],
              ["Session ID", video.session?.session_id ?? "Unavailable"],
            ].map(([label, value]) => (
              <div key={label} className="border-b border-white/10 pb-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/35">{label}</dt>
                <dd className={`mt-1 break-all text-white/80 ${label.endsWith("ID") ? "font-mono text-xs" : ""}`}>{value}</dd>
              </div>
            ))}
          </dl>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-semibold text-white/70">Reason for request</span>
            <select value={reason} onChange={(event) => setReason(event.target.value as RequestType)} className="w-full border border-white/15 bg-black/35 p-3 text-sm outline-none focus:border-red-500/60">
              {reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold text-white/70">Purpose or supporting note {noteRequired ? "(required)" : "(optional)"}</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} placeholder="Provide the case, incident, complaint, legal, or operational context for Umbrella review." className="w-full resize-none border border-white/15 bg-black/35 p-3 text-sm outline-none focus:border-red-500/60" />
          </label>
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/10 p-4">
          <button type="button" onClick={onClose} className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10">Cancel</button>
          <button type="button" disabled={noteRequired && !note.trim()} onClick={() => onSubmit(reason, note.trim() || undefined)} className="bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:bg-gray-700">Submit request</button>
        </footer>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import DashboardShell from "../../components/layout/DashboardShell";
import { useScreenSize } from "../../hooks/useScreensSize";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import VideoWatermark from "../../components/helpers/VideoWaterMark";
import { useReportDownload } from "../../modules/shared/useReportDownload";
import DashboardPlaceholder from "../../components/layout/DashboardPlaceholder";
import { useUser } from "../../context/UserContext";
import { useRememberedDashboardPane } from "../../hooks/useRememberedDashboardPane";

type ReviewStatus =
  | "QUEUED"
  | "ASSIGNED"
  | "IN_REVIEW"
  | "NEEDS_ESCALATION"
  | "COMPLETED";
type ReviewAnswer = "" | "YES" | "NO";
type FindingDecision = "" | "IRREGULARITY" | "NO_IRREGULARITY";
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type ProtectedStreamResponse = { url: string };

type InvestigationReport = {
  investigation_report_id: string;
  review_id: string;
  video_id: string;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "LOCKED";
  created_at: string;
  video?: EvidenceReview["video"] | null;
};

type IrregularityRange = {
  id: string;
  start_seconds: number;
  end_seconds: number;
  type: string;
  severity: Severity;
  description: string;
};

type EvidenceReview = {
  review_id: string;
  video_id: string;
  status: ReviewStatus;
  priority: number;
  created_at: string;
  updated_at: string;
  reviewer?: { first_name: string; last_name: string; email: string } | null;
  assigned_to?: string | null;
  video?: {
    video_id: string;
    format: string;
    resolution: string;
    duration: number;
    start_timestamp?: string;
    end_timestamp?: string;
    created_at: string;
    session?: {
      session_id: string;
      shift?: {
        shift_id: string;
        start_time: string;
        end_time: string;
        status: string;
      } | null;
      branch?: { name: string } | null;
      organization?: { name: string } | null;
      camera?: {
        serial_number: string;
        manufacturer?: string | null;
        model: string;
      } | null;
      officer?: {
        officer_id?: string;
        badge_number?: string | null;
        user?: {
          user_id?: string;
          first_name: string;
          last_name: string;
          email?: string;
        } | null;
      } | null;
    } | null;
  } | null;
  shift_context?: {
    status: "MATCHED" | "REVIEW_REQUIRED" | "NO_SHIFT";
    has_matching_shift: boolean;
    recording_start: string;
    recording_end: string;
    shift?: {
      shift_id: string;
      start_time: string;
      end_time: string;
      status: string;
    } | null;
    warnings: string[];
  };
  duration_context?: {
    status: "MATCHED" | "REVIEW_REQUIRED";
    encoded_duration_seconds: number;
    timestamp_duration_seconds: number;
    difference_seconds: number;
    warnings: string[];
  };
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const steps = [
  { number: 1, label: "Select evidence" },
  { number: 2, label: "Automated checks" },
  { number: 3, label: "Video examination" },
  { number: 4, label: "Investigation report" },
  { number: 5, label: "Review and confirm" },
] as const;

const irregularityTypes = [
  ["CAMERA_OFF", "Camera off / recording stopped"],
  ["CAMERA_OBSTRUCTED", "Camera obstructed or covered"],
  ["AUDIO_VIDEO_GAP", "Audio/video gap or missing footage"],
  ["VIDEO_TAMPERING", "Possible video tampering"],
  ["UNAUTHORIZED_ACCESS", "Unauthorized access"],
  ["CHAIN_OF_CUSTODY_BREAK", "Chain of custody concern"],
  ["OFFICER_CONDUCT", "Officer conduct concern"],
  ["POLICY_VIOLATION", "Policy violation"],
  ["GPS_ANOMALY", "GPS/location anomaly"],
  ["TIME_ANOMALY", "Time/date anomaly"],
  ["EVIDENCE_QUALITY", "Evidence quality issue"],
  ["SAFETY_INCIDENT", "Safety incident"],
  ["OTHER", "Other irregularity"],
] as const;

const violationTypes = [
  ["SHIFT_MISMATCH", "Shift or recording-time mismatch"],
  ["RECORDING_GAP", "Recording gap or missing footage"],
  ["EVIDENCE_IRREGULARITY", "Evidence irregularity"],
  ["CAMERA_OFF", "Camera switched off"],
  ["TAMPERING", "Possible tampering"],
  ["GPS_ANOMALY", "GPS or location anomaly"],
  ["UNAUTHORIZED_ACCESS", "Unauthorized access"],
  ["MISSED_SHIFT", "Missed shift"],
] as const;

function officerName(review?: EvidenceReview | null) {
  const user = review?.video?.session?.officer?.user;
  return user ? `${user.first_name} ${user.last_name}`.trim() : "Unavailable";
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Unavailable";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function statusClass(ok: boolean) {
  return ok
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/35 bg-amber-500/10 text-amber-100";
}

export default function EvidenceReviewDashboard() {
  const {
    requestDownload,
    dialogElement: reportDownloadDialog,
  } = useReportDownload();
  const { screenState, screenMessage } = useScreenSize();
  const { user } = useUser();
  const [activeView, setActiveView] = useRememberedDashboardPane<
    "queue" | "workflow" | "reports"
  >("evidence-reviewer", user?.user_id);
  useDocumentTitle(activeView, "Evidence Review");
  const [queue, setQueue] = useState<EvidenceReview[]>([]);
  const [assigned, setAssigned] = useState<EvidenceReview[]>([]);
  const [reports, setReports] = useState<InvestigationReport[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shiftAnswer, setShiftAnswer] = useState<ReviewAnswer>("");
  const [durationAnswer, setDurationAnswer] = useState<ReviewAnswer>("");
  const [finding, setFinding] = useState<FindingDecision>("");
  const [certified, setCertified] = useState(false);
  const [violationCreated, setViolationCreated] = useState(false);
  const [violationOpen, setViolationOpen] = useState(false);
  const [violationDraft, setViolationDraft] = useState({
    type: "EVIDENCE_IRREGULARITY",
    severity: "MEDIUM",
    description: "",
    location_violation: false,
    location_details: "",
  });
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const streamRetryRef = useRef(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [reviewPlaybackTime, setReviewPlaybackTime] = useState(0);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [reviewFullscreen, setReviewFullscreen] = useState(false);
  const [watermarkTime, setWatermarkTime] = useState(() => new Date());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [irregularities, setIrregularities] = useState<IrregularityRange[]>([]);
  const [irregularityDraft, setIrregularityDraft] = useState({
    start_seconds: 0,
    end_seconds: 0,
    type: "",
    severity: "MEDIUM" as Severity,
    description: "",
  });
  const [report, setReport] = useState({
    title: "",
    incident_summary: "",
    observations: "",
    chronology: "",
    evidence_assessment: "",
    recommendation: "",
  });

  const selectedReview = useMemo(
    () =>
      assigned.find((review) => review.review_id === selectedReviewId) ?? null,
    [assigned, selectedReviewId],
  );
  const anomalyConfirmed = shiftAnswer === "YES" || durationAnswer === "YES";

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [queueResponse, assignedResponse, reportResponse] =
        await Promise.all([
          axios.get<EvidenceReview[]>(`${API_URL}/evidence-review/queue`, {
            withCredentials: true,
          }),
          axios.get<EvidenceReview[]>(`${API_URL}/evidence-review/assigned`, {
            withCredentials: true,
          }),
          axios.get<InvestigationReport[]>(
            `${API_URL}/evidence-review/reports/mine`,
            { withCredentials: true },
          ),
        ]);
      setQueue(Array.isArray(queueResponse.data) ? queueResponse.data : []);
      setAssigned(
        Array.isArray(assignedResponse.data) ? assignedResponse.data : [],
      );
      setReports(Array.isArray(reportResponse.data) ? reportResponse.data : []);
    } catch (loadError) {
      console.error("Failed to load evidence review workspace", loadError);
      setError("The evidence review workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setWatermarkTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setReviewFullscreen(document.fullscreenElement === videoContainerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleReviewFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await videoContainerRef.current?.requestFullscreen();
    }
  };

  const resetWorkflow = (reviewId: string) => {
    setSelectedReviewId(reviewId);
    setStep(reviewId ? 2 : 1);
    setShiftAnswer("");
    setDurationAnswer("");
    setFinding("");
    setCertified(false);
    setViolationCreated(false);
    setStreamUrl(null);
    setVideoDuration(0);
    setReviewPlaybackTime(0);
    setReviewPlaying(false);
    setIrregularities([]);
    setIrregularityDraft({
      start_seconds: 0,
      end_seconds: 0,
      type: "",
      severity: "MEDIUM",
      description: "",
    });
    setReport({
      title: "",
      incident_summary: "",
      observations: "",
      chronology: "",
      evidence_assessment: "",
      recommendation: "",
    });
    setError("");
    setSuccess("");
  };

  const assignToMe = async (review: EvidenceReview) => {
    setSaving(true);
    setError("");
    try {
      await axios.post(
        `${API_URL}/evidence-review/assign`,
        { video_id: review.video_id },
        { withCredentials: true },
      );
      await loadData();
      setActiveView("workflow");
      resetWorkflow(review.review_id);
    } catch (actionError) {
      setError(
        axios.isAxiosError(actionError)
          ? (actionError.response?.data?.message ?? "Assignment failed.")
          : "Assignment failed.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openQueueReview = async (review: EvidenceReview) => {
    if (review.status === "QUEUED" || !review.assigned_to) {
      await assignToMe(review);
      return;
    }
    setActiveView("workflow");
    resetWorkflow(review.review_id);
  };

  const requestProtectedStreamTicket = async () => {
    if (!selectedReview) return;
    const response = await axios.get<ProtectedStreamResponse>(
      `${API_URL}/stream-video/signed-url/${selectedReview.video_id}`,
      { withCredentials: true },
    );
    setStreamUrl(
      response.data.url.startsWith("http")
        ? response.data.url
        : `${API_URL}${response.data.url}`,
    );
  };

  const loadStream = async () => {
    if (!selectedReview) return;
    setStreamLoading(true);
    setError("");
    try {
      await axios.post(
        `${API_URL}/evidence-review/${selectedReview.review_id}/start`,
        {},
        { withCredentials: true },
      );
      await requestProtectedStreamTicket();
    } catch (streamError) {
      console.error("Failed to open reviewed video", streamError);
      setError("The reviewed video stream could not be opened.");
    } finally {
      setStreamLoading(false);
    }
  };

  const logVideoEvent = async (
    action: "VIDEO_PLAY" | "VIDEO_PAUSE" | "VIDEO_ENDED" | "VIDEO_SEEK",
    details?: Record<string, unknown>,
  ) => {
    if (!selectedReview) return;

    try {
      await axios.post(
        `${API_URL}/stream-video/player-event`,
        {
          video_id: selectedReview.video_id,
          action,
          details,
        },
        { withCredentials: true },
      );
    } catch (auditError) {
      console.error(`Failed to audit reviewer ${action}`, auditError);
    }
  };

  const addIrregularity = () => {
    if (
      !irregularityDraft.type ||
      irregularityDraft.description.trim().length < 5
    )
      return;
    const start = Math.min(
      irregularityDraft.start_seconds,
      irregularityDraft.end_seconds,
    );
    const end = Math.max(
      irregularityDraft.start_seconds,
      irregularityDraft.end_seconds,
    );
    setIrregularities((items) => [
      ...items,
      {
        ...irregularityDraft,
        id: crypto.randomUUID(),
        start_seconds: start,
        end_seconds: end,
        description: irregularityDraft.description.trim(),
      },
    ]);
    setIrregularityDraft((draft) => ({
      ...draft,
      type: "",
      description: "",
      start_seconds: end,
      end_seconds: Math.min(videoDuration, end + 5),
    }));
  };

  const createViolation = async () => {
    if (!selectedReview || violationDraft.description.trim().length < 10)
      return;
    setSaving(true);
    setError("");
    try {
      await axios.post(
        `${API_URL}/evidence-review/${selectedReview.review_id}/violations`,
        {
          ...violationDraft,
          description: violationDraft.description.trim(),
          location_details: violationDraft.location_violation
            ? violationDraft.location_details.trim() || undefined
            : undefined,
        },
        { withCredentials: true },
      );
      setViolationCreated(true);
      setViolationOpen(false);
      setSuccess(
        "The violation was created and routed to the organisation and branch workflow.",
      );
    } catch (violationError) {
      setError(
        axios.isAxiosError(violationError)
          ? (violationError.response?.data?.message ??
              "Violation creation failed.")
          : "Violation creation failed.",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmReview = async () => {
    if (!selectedReview || !finding || !certified) return;
    setSaving(true);
    setError("");
    try {
      if (finding === "IRREGULARITY") {
        const reportResponse = await axios.post<InvestigationReport>(
          `${API_URL}/evidence-review/${selectedReview.review_id}/reports`,
          {
            title: report.title.trim(),
            incident_summary: report.incident_summary.trim(),
            observations: {
              observations: report.observations.trim(),
              chronology: report.chronology.trim(),
              evidence_assessment: report.evidence_assessment.trim(),
              evidence: {
                video_id: selectedReview.video_id,
                officer_name: officerName(selectedReview),
                badge_number:
                  selectedReview.video?.session?.officer?.badge_number ?? null,
                organization:
                  selectedReview.video?.session?.organization?.name ?? null,
                branch: selectedReview.video?.session?.branch?.name ?? null,
                camera_serial:
                  selectedReview.video?.session?.camera?.serial_number ?? null,
              },
            },
            irregularities,
            recommendation: report.recommendation.trim() || undefined,
          },
          { withCredentials: true },
        );
        await axios.post(
          `${API_URL}/evidence-review/reports/${reportResponse.data.investigation_report_id}/submit`,
          {},
          { withCredentials: true },
        );
      }

      const summary =
        finding === "NO_IRREGULARITY"
          ? "The assigned evidence video was examined in full and no reportable irregularity was identified."
          : `${irregularities.length} irregularity finding(s) documented in the submitted investigation report.`;
      await axios.post(
        `${API_URL}/evidence-review/${selectedReview.review_id}/complete`,
        {
          outcome:
            finding === "NO_IRREGULARITY"
              ? "NO_IRREGULARITY"
              : "IRREGULARITY_REPORTED",
          summary,
          confirmed: true,
        },
        { withCredentials: true },
      );

      setSuccess(
        "Review completed. The video has been removed from your active queue.",
      );
      setSelectedReviewId("");
      setStep(1);
      await loadData();
    } catch (completeError) {
      const message = axios.isAxiosError(completeError)
        ? completeError.response?.data?.message
        : undefined;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : (message ?? "The review could not be completed."),
      );
    } finally {
      setSaving(false);
    }
  };

  const downloadInvestigationReport = (reportId: string) => {
    requestDownload({
      url: `/evidence-review/reports/${reportId}/pdf`,
      fileName: `evidence-investigation-${reportId}.pdf`,
      title: "Download Evidence Investigation Report",
    });
  };

  const canContinueStep2 = Boolean(
    shiftAnswer && durationAnswer && (!anomalyConfirmed || violationCreated),
  );
  const canContinueStep3 =
    finding === "NO_IRREGULARITY" ||
    (finding === "IRREGULARITY" && irregularities.length > 0);
  const reportComplete = Boolean(
    report.title.trim() &&
    report.incident_summary.trim() &&
    report.observations.trim() &&
    report.evidence_assessment.trim(),
  );

  const stepNavigation = (
    <div className="border border-white/10 bg-black/25 p-4">
      <ol className="grid gap-2 md:grid-cols-5">
        {steps.map((item) => {
          const active = step === item.number;
          const complete = step > item.number;
          return (
            <li
              key={item.number}
              className={`border px-3 py-3 ${active ? "border-red-500 bg-red-500/10" : complete ? "border-emerald-500/25 bg-emerald-500/5" : "border-white/10 bg-white/[0.02]"}`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-red-300" : complete ? "text-emerald-300" : "text-white/35"}`}
              >
                Step {item.number}
              </p>
              <p className="mt-1 text-sm font-medium">{item.label}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );

  return (
    <DashboardShell
      title="Evidence Review Dashboard"
      screenState={screenState}
      screenMessage={screenMessage}
      sidebar={
        <div className="h-full bg-body-black/80 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
            Evidence operations
          </p>
          <h2 className="mt-1 mb-5 text-sm text-white/55">Review workspace</h2>
          {[
            ["queue", "Review queue"],
            ["workflow", "Guided review"],
            ["reports", "Investigation reports"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveView(key as typeof activeView)}
              className={`mb-2 w-full border-l-2 px-3 py-2.5 text-left text-sm ${activeView === key ? "border-red-500 bg-red-600/20" : "border-transparent text-white/70 hover:bg-white/5"}`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {!activeView ? (
        <main className="h-full p-4 text-left text-white lg:p-6">
          <DashboardPlaceholder />
        </main>
      ) : (
      <main className="h-full overflow-y-auto p-4 text-left text-white lg:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              Evidence review
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              Structured investigation workspace
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Follow the review controls in order. Findings, violations,
              reports, and final disposition are preserved in the audit trail.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
              <p className="text-xs text-white/45">Assigned</p>
              <p className="text-xl font-bold">{assigned.length}</p>
            </div>
            <div className="border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
              <p className="text-xs text-white/45">Reports</p>
              <p className="text-xl font-bold">{reports.length}</p>
            </div>
          </div>
        </header>
        {error && (
          <div className="mt-4 border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 border border-emerald-500/35 bg-emerald-950/25 p-3 text-sm text-emerald-100">
            {success}
          </div>
        )}

        {activeView === "queue" && (
          <section className="mt-5 overflow-hidden border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] p-4">
              <div>
                <h2 className="font-semibold">My review queue</h2>
                <p className="text-xs text-white/45">
                  Verified evidence videos assigned to you and requiring review
                </p>
              </div>
              <button
                onClick={() => void loadData()}
                className="border border-white/15 px-3 py-2 text-xs hover:border-red-500"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-sm">
                <thead className="bg-gray-950 text-xs uppercase text-white/40">
                  <tr>
                    <th className="p-3 text-left">Video ID</th>
                    <th className="p-3 text-left">Organisation</th>
                    <th className="p-3 text-left">Branch</th>
                    <th className="p-3 text-left">Officer</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Priority</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((review) => (
                    <tr
                      key={review.review_id}
                      className="border-t border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="p-3 font-mono text-xs">
                        {review.video_id}
                      </td>
                      <td className="p-3">
                        {review.video?.session?.organization?.name ??
                          "Unavailable"}
                      </td>
                      <td className="p-3">
                        {review.video?.session?.branch?.name ?? "Unavailable"}
                      </td>
                      <td className="p-3">{officerName(review)}</td>
                      <td className="p-3">
                        <span className="border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                          {review.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="p-3">{review.priority}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => void openQueueReview(review)}
                          disabled={saving}
                          className="bg-red-600 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          {review.status === "QUEUED"
                            ? "Assign and review"
                            : "Open review"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && queue.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-white/40">
                        No evidence videos currently require your review.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeView === "workflow" && (
          <section className="mt-5 space-y-4">
            {stepNavigation}
            {step === 1 && (
              <div className="border border-white/10 bg-white/[0.025] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                  Step 1
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Select an assigned video
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  The Video ID list contains only evidence currently assigned to
                  you and still under review.
                </p>
                <label className="mt-5 block max-w-3xl">
                  <span className="text-xs uppercase tracking-wide text-white/45">
                    Video ID and officer
                  </span>
                  <select
                    value={selectedReviewId}
                    onChange={(event) => resetWorkflow(event.target.value)}
                    className="mt-2 w-full border border-white/15 bg-[#17181b] p-3"
                  >
                    <option value="">Select a video under review</option>
                    {assigned.map((review) => (
                      <option key={review.review_id} value={review.review_id}>
                        {review.video_id} | {officerName(review)} |{" "}
                        {review.video?.session?.branch?.name ??
                          "Unknown branch"}
                      </option>
                    ))}
                  </select>
                </label>
                {assigned.length === 0 && (
                  <p className="mt-4 text-sm text-amber-200">
                    There are no active videos assigned to you.
                  </p>
                )}
              </div>
            )}

            {step === 2 && selectedReview && (
              <div className="space-y-4">
                <div className="border border-white/10 bg-white/[0.025] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                    Step 2
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    Review automated compliance checks
                  </h2>
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <CheckCard
                      title="Shift alignment"
                      ok={selectedReview.shift_context?.status === "MATCHED"}
                      summary={
                        selectedReview.shift_context?.status === "MATCHED"
                          ? "Recording falls within the linked officer shift."
                          : "Manual review is required for the linked shift."
                      }
                      warnings={selectedReview.shift_context?.warnings ?? []}
                    />
                    <CheckCard
                      title="Recording duration"
                      ok={selectedReview.duration_context?.status === "MATCHED"}
                      summary={`Encoded ${formatSeconds(selectedReview.duration_context?.encoded_duration_seconds ?? selectedReview.video?.duration ?? 0)} · Timestamp span ${formatSeconds(selectedReview.duration_context?.timestamp_duration_seconds ?? 0)}`}
                      warnings={selectedReview.duration_context?.warnings ?? []}
                    />
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <YesNoQuestion
                      label="Does the shift information indicate a reportable violation?"
                      value={shiftAnswer}
                      onChange={setShiftAnswer}
                    />
                    <YesNoQuestion
                      label="Is the video duration or recording time irregular?"
                      value={durationAnswer}
                      onChange={setDurationAnswer}
                    />
                  </div>
                  {anomalyConfirmed && (
                    <div className="mt-5 border border-red-500/30 bg-red-950/20 p-4">
                      <p className="font-semibold text-red-100">
                        A reportable compliance concern was confirmed.
                      </p>
                      <p className="mt-1 text-sm text-white/55">
                        Create the violation before continuing. The officer,
                        session, camera and video are linked automatically.
                      </p>
                      <button
                        onClick={() => setViolationOpen(true)}
                        disabled={violationCreated}
                        className="mt-3 bg-red-600 px-4 py-2 text-sm font-semibold disabled:bg-emerald-800"
                      >
                        {violationCreated
                          ? "Violation created"
                          : "Create violation"}
                      </button>
                    </div>
                  )}
                  <div className="mt-5 flex justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="border border-white/15 px-4 py-2 text-sm"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!canContinueStep2}
                      className="bg-red-600 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-gray-700"
                    >
                      Continue to video examination
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && selectedReview && (
              <div className="border border-white/10 bg-white/[0.025] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                  Step 3
                </p>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="mt-1 text-xl font-semibold">
                      Stream and examine the evidence
                    </h2>
                    <p className="mt-2 text-sm text-white/55">
                      Watch the selected evidence, then record whether any
                      irregularity was observed.
                    </p>
                  </div>
                  <button
                    onClick={() => void loadStream()}
                    disabled={streamLoading}
                    className="bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {streamLoading
                      ? "Opening stream..."
                      : streamUrl
                        ? "Renew stream"
                        : "Open evidence stream"}
                  </button>
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                  <div
                    ref={videoContainerRef}
                    className={reviewFullscreen
                      ? "relative flex h-screen w-screen select-none items-center overflow-hidden bg-black p-3"
                      : "relative select-none overflow-hidden border border-white/10 bg-black p-3"}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    {streamUrl ? (
                      <>
                        <video
                          ref={videoRef}
                          src={streamUrl}
                          crossOrigin="use-credentials"
                          controls={false}
                          controlsList="nodownload noremoteplayback"
                          disablePictureInPicture
                          disableRemotePlayback
                          preload="metadata"
                          className={reviewFullscreen ? "h-full w-full object-contain" : "aspect-video w-full object-contain"}
                          onContextMenu={(event) => event.preventDefault()}
                          onDragStart={(event) => event.preventDefault()}
                          onError={() => {
                            if (streamRetryRef.current) return;
                            streamRetryRef.current = true;
                            void requestProtectedStreamTicket()
                              .catch(() => setError("The reviewed video stream could not be renewed."))
                              .finally(() => {
                                window.setTimeout(() => {
                                  streamRetryRef.current = false;
                                }, 5000);
                              });
                          }}
                          onLoadedMetadata={(event) => {
                            const duration = event.currentTarget.duration || 0;
                            setVideoDuration(duration);
                            setIrregularityDraft((draft) => ({
                              ...draft,
                              end_seconds: Math.min(
                                duration,
                                Math.max(draft.end_seconds, 5),
                              ),
                            }));
                          }}
                          onPlay={() =>
                            {
                              setReviewPlaying(true);
                              void logVideoEvent("VIDEO_PLAY", {
                                current_time: videoRef.current?.currentTime ?? 0,
                              });
                            }
                          }
                          onPause={() =>
                            {
                              setReviewPlaying(false);
                              void logVideoEvent("VIDEO_PAUSE", {
                                current_time: videoRef.current?.currentTime ?? 0,
                              });
                            }
                          }
                          onEnded={() =>
                            void logVideoEvent("VIDEO_ENDED", {
                              duration: videoRef.current?.duration ?? 0,
                            })
                          }
                          onSeeked={() =>
                            void logVideoEvent("VIDEO_SEEK", {
                              current_time: videoRef.current?.currentTime ?? 0,
                            })
                          }
                          onTimeUpdate={(event) => setReviewPlaybackTime(event.currentTarget.currentTime)}
                        />
                        <VideoWatermark
                          video={selectedReview.video}
                          time={watermarkTime}
                        />
                        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 bg-black/75 px-4 py-2 text-xs">
                          <button type="button" onClick={() => {
                            const player = videoRef.current;
                            if (!player) return;
                            if (player.paused) void player.play();
                            else player.pause();
                          }} className="border border-white/20 px-3 py-1.5">
                            {reviewPlaying ? "Pause" : "Play"}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={videoDuration || 0}
                            value={reviewPlaybackTime}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setReviewPlaybackTime(value);
                              if (videoRef.current) videoRef.current.currentTime = value;
                            }}
                            className="min-w-0 flex-1"
                            aria-label="Evidence playback position"
                          />
                          <span className="whitespace-nowrap text-white/60">{formatSeconds(reviewPlaybackTime)} / {formatSeconds(videoDuration)}</span>
                          <button type="button" onClick={() => void toggleReviewFullscreen()} className="border border-white/20 px-3 py-1.5">
                            {reviewFullscreen ? "Exit fullscreen" : "Fullscreen"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/40">
                        <p>Open the protected stream to begin examination.</p>
                      </div>
                    )}
                  </div>
                  <div className="border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      Finding decision
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setFinding("NO_IRREGULARITY")}
                        className={`border p-3 text-sm ${finding === "NO_IRREGULARITY" ? "border-emerald-500 bg-emerald-500/10 text-emerald-200" : "border-white/10"}`}
                      >
                        No irregularity
                      </button>
                      <button
                        onClick={() => setFinding("IRREGULARITY")}
                        className={`border p-3 text-sm ${finding === "IRREGULARITY" ? "border-red-500 bg-red-500/10 text-red-100" : "border-white/10"}`}
                      >
                        Irregularity observed
                      </button>
                    </div>
                    {finding === "IRREGULARITY" && (
                      <div className="mt-4 space-y-3">
                        <button
                          onClick={() => {
                            const time = videoRef.current?.currentTime ?? 0;
                            videoRef.current?.pause();
                            setIrregularityDraft((draft) => ({
                              ...draft,
                              start_seconds: time,
                              end_seconds: Math.min(videoDuration, time + 5),
                            }));
                          }}
                          disabled={!streamUrl}
                          className="w-full border border-white/15 p-2 text-sm disabled:opacity-40"
                        >
                          Use current video time
                        </button>
                        <IrregularityTimeline
                          duration={videoDuration}
                          start={irregularityDraft.start_seconds}
                          end={irregularityDraft.end_seconds}
                          disabled={!streamUrl}
                          onStart={(value) => {
                            setIrregularityDraft((draft) => ({
                              ...draft,
                              start_seconds: value,
                              end_seconds: Math.max(value, draft.end_seconds),
                            }));
                            if (videoRef.current)
                              videoRef.current.currentTime = value;
                          }}
                          onEnd={(value) => {
                            setIrregularityDraft((draft) => ({
                              ...draft,
                              end_seconds: Math.max(draft.start_seconds, value),
                            }));
                            if (videoRef.current)
                              videoRef.current.currentTime = value;
                          }}
                        />
                        <select
                          value={irregularityDraft.type}
                          onChange={(e) =>
                            setIrregularityDraft((d) => ({
                              ...d,
                              type: e.target.value,
                            }))
                          }
                          className="w-full border border-white/10 bg-gray-950 p-2"
                        >
                          <option value="">Select irregularity type</option>
                          {irregularityTypes.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={irregularityDraft.severity}
                          onChange={(e) =>
                            setIrregularityDraft((d) => ({
                              ...d,
                              severity: e.target.value as Severity,
                            }))
                          }
                          className="w-full border border-white/10 bg-gray-950 p-2"
                        >
                          <option>LOW</option>
                          <option>MEDIUM</option>
                          <option>HIGH</option>
                          <option>CRITICAL</option>
                        </select>
                        <textarea
                          value={irregularityDraft.description}
                          onChange={(e) =>
                            setIrregularityDraft((d) => ({
                              ...d,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Describe the observable facts"
                          className="min-h-24 w-full border border-white/10 bg-gray-950 p-2"
                        />
                        <button
                          onClick={addIrregularity}
                          className="w-full bg-red-600 p-2 text-sm font-semibold"
                        >
                          Add irregularity
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {irregularities.length > 0 && (
                  <div className="mt-5 overflow-x-auto border border-white/10">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-gray-950 text-xs uppercase text-white/40">
                        <tr>
                          <th className="p-3 text-left">Video range</th>
                          <th className="p-3 text-left">Type</th>
                          <th className="p-3 text-left">Severity</th>
                          <th className="p-3 text-left">Observation</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {irregularities.map((item) => (
                          <tr key={item.id} className="border-t border-white/5">
                            <td className="p-3">
                              {formatSeconds(item.start_seconds)} –{" "}
                              {formatSeconds(item.end_seconds)}
                            </td>
                            <td className="p-3">
                              {item.type.replaceAll("_", " ")}
                            </td>
                            <td className="p-3">{item.severity}</td>
                            <td className="p-3">{item.description}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() =>
                                  setIrregularities((all) =>
                                    all.filter((entry) => entry.id !== item.id),
                                  )
                                }
                                className="text-xs text-red-300"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-5 flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="border border-white/15 px-4 py-2 text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={() =>
                      setStep(finding === "NO_IRREGULARITY" ? 5 : 4)
                    }
                    disabled={!canContinueStep3}
                    className="bg-red-600 px-4 py-2 text-sm font-semibold disabled:bg-gray-700"
                  >
                    {finding === "NO_IRREGULARITY"
                      ? "Continue to confirmation"
                      : "Continue to report"}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && selectedReview && (
              <div className="border border-white/10 bg-white/[0.025] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                  Step 4
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Law-enforcement investigation report
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  Document objective observations. The report will be linked to
                  the selected evidence video and officer.
                </p>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <label className="lg:col-span-2">
                    <FieldLabel text="Video ID under review" />
                    <select
                      value={selectedReviewId}
                      onChange={(e) => resetWorkflow(e.target.value)}
                      className="field"
                    >
                      <option value="">Select assigned officer video</option>
                      {assigned.map((review) => (
                        <option key={review.review_id} value={review.review_id}>
                          {review.video_id} | {officerName(review)} |{" "}
                          {review.video?.session?.organization?.name ??
                            "Unknown organisation"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lg:col-span-2">
                    <FieldLabel text="Report title" />
                    <input
                      value={report.title}
                      onChange={(e) =>
                        setReport((r) => ({ ...r, title: e.target.value }))
                      }
                      placeholder="Evidence review investigation – incident or reference"
                      className="field"
                    />
                  </label>
                  <label className="lg:col-span-2">
                    <FieldLabel text="Incident summary" />
                    <textarea
                      value={report.incident_summary}
                      onChange={(e) =>
                        setReport((r) => ({
                          ...r,
                          incident_summary: e.target.value,
                        }))
                      }
                      placeholder="Who, what, when and where. Use factual language."
                      className="field min-h-28"
                    />
                  </label>
                  <label>
                    <FieldLabel text="Detailed observations" />
                    <textarea
                      value={report.observations}
                      onChange={(e) =>
                        setReport((r) => ({
                          ...r,
                          observations: e.target.value,
                        }))
                      }
                      placeholder="Describe visible and audible facts without speculation."
                      className="field min-h-36"
                    />
                  </label>
                  <label>
                    <FieldLabel text="Event chronology" />
                    <textarea
                      value={report.chronology}
                      onChange={(e) =>
                        setReport((r) => ({ ...r, chronology: e.target.value }))
                      }
                      placeholder="Summarise the sequence using video timestamps."
                      className="field min-h-36"
                    />
                  </label>
                  <label>
                    <FieldLabel text="Evidence assessment" />
                    <textarea
                      value={report.evidence_assessment}
                      onChange={(e) =>
                        setReport((r) => ({
                          ...r,
                          evidence_assessment: e.target.value,
                        }))
                      }
                      placeholder="Explain relevance, reliability and identified irregularities."
                      className="field min-h-32"
                    />
                  </label>
                  <label>
                    <FieldLabel text="Recommendation" />
                    <textarea
                      value={report.recommendation}
                      onChange={(e) =>
                        setReport((r) => ({
                          ...r,
                          recommendation: e.target.value,
                        }))
                      }
                      placeholder="Recommended follow-up, escalation or corrective action."
                      className="field min-h-32"
                    />
                  </label>
                </div>
                <div className="mt-5 flex justify-between">
                  <button
                    onClick={() => setStep(3)}
                    className="border border-white/15 px-4 py-2 text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(5)}
                    disabled={!reportComplete}
                    className="bg-red-600 px-4 py-2 text-sm font-semibold disabled:bg-gray-700"
                  >
                    Review report and confirm
                  </button>
                </div>
              </div>
            )}

            {step === 5 && selectedReview && (
              <div className="border border-white/10 bg-white/[0.025] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                  Step 5
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Review and confirm
                </h2>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <SummaryCard
                    label="Evidence"
                    values={[
                      selectedReview.video_id,
                      officerName(selectedReview),
                      selectedReview.video?.session?.branch?.name ??
                        "Unknown branch",
                    ]}
                  />
                  <SummaryCard
                    label="Compliance checks"
                    values={[
                      `Shift violation: ${shiftAnswer}`,
                      `Duration irregularity: ${durationAnswer}`,
                      violationCreated
                        ? "Violation created"
                        : "No compliance violation created",
                    ]}
                  />
                  <SummaryCard
                    label="Review outcome"
                    values={[
                      finding === "NO_IRREGULARITY"
                        ? "No irregularity"
                        : "Irregularity reported",
                      `${irregularities.length} marked time range(s)`,
                      finding === "IRREGULARITY"
                        ? "Investigation report will be submitted"
                        : "No report required",
                    ]}
                  />
                </div>
                {finding === "IRREGULARITY" && (
                  <div className="mt-4 border border-white/10 p-4">
                    <p className="font-semibold">{report.title}</p>
                    <p className="mt-2 text-sm text-white/60">
                      {report.incident_summary}
                    </p>
                    <p className="mt-2 text-xs text-white/40">
                      Recommendation: {report.recommendation || "None recorded"}
                    </p>
                  </div>
                )}
                <label className="mt-5 flex items-start gap-3 border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={certified}
                    onChange={(e) => setCertified(e.target.checked)}
                    className="mt-1 accent-red-600"
                  />
                  <span>
                    I confirm that I reviewed the selected evidence, recorded
                    the findings accurately, and understand that confirming will
                    complete the review and remove it from my active queue.
                  </span>
                </label>
                <div className="mt-5 flex justify-between">
                  <button
                    onClick={() => setStep(finding === "IRREGULARITY" ? 4 : 3)}
                    className="border border-white/15 px-4 py-2 text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => void confirmReview()}
                    disabled={!certified || saving}
                    className="bg-red-600 px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                  >
                    {saving
                      ? "Completing review..."
                      : "Confirm and complete review"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {activeView === "reports" && (
          <section className="mt-5 overflow-hidden border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] p-4">
              <div>
                <h2 className="font-semibold">My investigation reports</h2>
                <p className="text-xs text-white/45">
                  Reports remain available after reviews leave the active queue.
                </p>
              </div>
              <button
                onClick={() => void loadData()}
                className="border border-white/15 px-3 py-2 text-xs"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-950 text-xs uppercase text-white/40">
                  <tr>
                    <th className="p-3 text-left">Title</th>
                    <th className="p-3 text-left">Video ID</th>
                    <th className="p-3 text-left">Officer</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Created</th>
                    <th className="p-3 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((item) => (
                    <tr
                      key={item.investigation_report_id}
                      className="border-t border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="p-3 font-medium">{item.title}</td>
                      <td className="p-3 font-mono text-xs">{item.video_id}</td>
                      <td className="p-3">
                        {item.video?.session?.officer?.user
                          ? `${item.video.session.officer.user.first_name} ${item.video.session.officer.user.last_name}`
                          : "Unavailable"}
                      </td>
                      <td className="p-3">
                        <span className="border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-200">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void downloadInvestigationReport(
                              item.investigation_report_id,
                            )
                          }
                          className="border border-white/15 px-3 py-1 text-xs hover:bg-white/10"
                        >
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-white/40">
                        No investigation reports created.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {violationOpen && selectedReview && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.currentTarget === e.target && !saving)
                setViolationOpen(false);
            }}
          >
            <section className="w-full max-w-2xl overflow-hidden border border-white/15 bg-[#111214] shadow-2xl">
              <header className="border-b border-white/10 bg-gradient-to-r from-red-950/40 to-black/20 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                  Compliance finding
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Create violation from automated checks
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  Officer, video, camera, session and organisational scope are
                  locked to this review.
                </p>
              </header>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <label>
                  <FieldLabel text="Violation type" />
                  <select
                    value={violationDraft.type}
                    onChange={(e) =>
                      setViolationDraft((v) => ({ ...v, type: e.target.value }))
                    }
                    className="field"
                  >
                    {violationTypes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <FieldLabel text="Severity" />
                  <select
                    value={violationDraft.severity}
                    onChange={(e) =>
                      setViolationDraft((v) => ({
                        ...v,
                        severity: e.target.value,
                      }))
                    }
                    className="field"
                  >
                    <option>MINIMAL</option>
                    <option>LOW</option>
                    <option>MEDIUM</option>
                    <option>HIGH</option>
                    <option>CRITICAL</option>
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <FieldLabel text="Evidence-based description" />
                  <textarea
                    value={violationDraft.description}
                    onChange={(e) =>
                      setViolationDraft((v) => ({
                        ...v,
                        description: e.target.value,
                      }))
                    }
                    className="field min-h-32"
                    placeholder="State the automated warning, your assessment and the relevant evidence facts."
                  />
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={violationDraft.location_violation}
                    onChange={(e) =>
                      setViolationDraft((v) => ({
                        ...v,
                        location_violation: e.target.checked,
                      }))
                    }
                    className="accent-red-600"
                  />
                  Location-related violation
                </label>
                {violationDraft.location_violation && (
                  <label className="sm:col-span-2">
                    <FieldLabel text="Location details" />
                    <textarea
                      value={violationDraft.location_details}
                      onChange={(e) =>
                        setViolationDraft((v) => ({
                          ...v,
                          location_details: e.target.value,
                        }))
                      }
                      className="field min-h-20"
                    />
                  </label>
                )}
              </div>
              <footer className="flex justify-end gap-2 border-t border-white/10 p-5">
                <button
                  onClick={() => setViolationOpen(false)}
                  className="border border-white/15 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void createViolation()}
                  disabled={
                    saving || violationDraft.description.trim().length < 10
                  }
                  className="bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  {saving ? "Creating..." : "Create violation"}
                </button>
              </footer>
            </section>
          </div>
        )}
      </main>
      )}
      {reportDownloadDialog}
    </DashboardShell>
  );
}

function CheckCard({
  title,
  ok,
  summary,
  warnings,
}: {
  title: string;
  ok: boolean;
  summary: string;
  warnings: string[];
}) {
  return (
    <article className={`border p-4 ${statusClass(ok)}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="border border-current/30 px-2 py-1 text-[10px] font-bold uppercase">
          {ok ? "Matched" : "Review required"}
        </span>
      </div>
      <p className="mt-2 text-sm text-white/65">{summary}</p>
      {warnings.map((warning) => (
        <p key={warning} className="mt-2 text-xs">
          • {warning}
        </p>
      ))}
    </article>
  );
}

function YesNoQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ReviewAnswer;
  onChange: (value: ReviewAnswer) => void;
}) {
  return (
    <fieldset className="border border-white/10 p-4">
      <legend className="px-2 text-sm font-medium">{label}</legend>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onChange("YES")}
          className={`flex-1 border p-2 text-sm ${value === "YES" ? "border-red-500 bg-red-500/10 text-red-100" : "border-white/10"}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange("NO")}
          className={`flex-1 border p-2 text-sm ${value === "NO" ? "border-emerald-500 bg-emerald-500/10 text-emerald-100" : "border-white/10"}`}
        >
          No
        </button>
      </div>
    </fieldset>
  );
}

function FieldLabel({ text }: { text: string }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
      {text}
    </span>
  );
}
function SummaryCard({ label, values }: { label: string; values: string[] }) {
  return (
    <article className="border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
        {label}
      </p>
      {values.map((value) => (
        <p key={value} className="mt-2 break-all text-sm text-white/65">
          {value}
        </p>
      ))}
    </article>
  );
}

function IrregularityTimeline({
  duration,
  start,
  end,
  disabled,
  onStart,
  onEnd,
}: {
  duration: number;
  start: number;
  end: number;
  disabled: boolean;
  onStart: (value: number) => void;
  onEnd: (value: number) => void;
}) {
  const maximum = Math.max(1, duration);
  return (
    <div className="border border-white/10 bg-gray-950/70 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
          Irregularity video range
        </p>
        <p className="font-mono text-xs text-red-200">
          {formatSeconds(start)} – {formatSeconds(end)}
        </p>
      </div>
      <label className="mt-3 block text-xs text-white/55">
        Drag to the start of the irregularity
        <input
          type="range"
          min={0}
          max={maximum}
          step={0.25}
          value={Math.min(start, maximum)}
          disabled={disabled}
          onChange={(event) => onStart(Number(event.target.value))}
          className="mt-2 w-full accent-red-600"
        />
      </label>
      <label className="mt-3 block text-xs text-white/55">
        Drag to the end of the irregularity
        <input
          type="range"
          min={0}
          max={maximum}
          step={0.25}
          value={Math.min(Math.max(end, start), maximum)}
          disabled={disabled}
          onChange={(event) =>
            onEnd(Math.max(Number(event.target.value), start))
          }
          className="mt-2 w-full accent-red-600"
        />
      </label>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-white/30">
        <span>0:00</span>
        <span>{formatSeconds(maximum)}</span>
      </div>
    </div>
  );
}

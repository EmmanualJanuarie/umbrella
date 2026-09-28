/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, useRef, useCallback, type ChangeEvent } from "react";
import axios from "axios"; // your configured axios
import { type Video, type Organization } from "../../data/types";
import { ConvertTime } from "../../components/helpers/ConvertTime";
import VideoWatermark from "../../components/helpers/VideoWaterMark";
import VideoExpiredOverlay from "../../components/helpers/VideoExpiredOverlay";
import ComingSoonModal from "../../components/ComingSoonModal";
import { useActionDialog } from "../../components/modals/ActionDialog";

const runAction = async (action: () => Promise<unknown>, options?: unknown) => {
  void options;
  await action();
};

export default function UmbrellaVideos() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // COMING SOON MODAL SCOPE
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const [isExpired, setIsExpired] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [time, setTime] = useState(new Date());

  const lastSentRef = useRef(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [orgSearch, setOrgSearch] = useState("");
  const [videoSearch, setVideoSearch] = useState("");
  const [videoUnlocked, setVideoUnlocked] = useState(false);

  // ANALYSIS STATES
  const [analysisJobModalOpen, setAnalysisJobModalOpen] = useState(false);

  const [analysisJobStatus, setAnalysisJobStatus] = useState<{
    status: string;
    total: number;
    completed: number;
  } | null>(null);

  const [, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  const [isSearchingVideos, setIsSearchingVideos] = useState(false);



  // FOR REMAINING TIME OF VIDEO
  const remainingTime = useMemo(() => {
    if (!duration) return 0;
    return Math.max(duration - currentTime, 0);
  }, [duration, currentTime]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${m}:${String(s).padStart(2, "0")}`;
  };


  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
  const { dialogElement, showMessage, promptAction } = useActionDialog();

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const streamRetryRef = useRef(false);

  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisType, setAnalysisType] = useState<"faces" | "plates" | null>(null);
  const [selectedAnalysisVideos, setSelectedAnalysisVideos] = useState<string[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [snapshotOptions, setSnapshotOptions] = useState<
    {
      snapshot_id: string;
      video_id: string;
      officer_name: string;
      label: string;
      status: string;
    }[]
  >([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  const refreshVideos = useCallback(async (searchValue = videoSearch) => {
    try {
      setLoading(true);
      setIsSearchingVideos(true);
      setError(null);
      const res = await axios.get(`${API_URL}/video`, {
        withCredentials: true,
        params: {
          search: searchValue,
          orgId: selectedOrgId ?? undefined,
        },
      });
      setVideos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch videos", err);
      setError("Failed to load videos.");
      setVideos([]);
    } finally {
      setLoading(false);
      setIsSearchingVideos(false);
    }
  }, [API_URL, selectedOrgId, videoSearch]);

  const refreshOrganizations = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/organization`, {
        withCredentials: true,
      });
      setOrganizations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch organizations", err);
    }
  }, [API_URL]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshVideos(videoSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [refreshVideos, videoSearch]);

  useEffect(() => {
    const interval = window.setInterval(() => setTime(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const logVideoEvent = async (
    action: "VIDEO_PLAY" | "VIDEO_PAUSE" | "VIDEO_ENDED" | "VIDEO_SEEK",
    details?: Record<string, unknown>,
  ) => {
    if (!selectedVideo) return;

    try {
      await axios.post(
        `${API_URL}/stream-video/player-event`,
        {
          video_id: selectedVideo.video_id,
          action,
          details,
        },
        { withCredentials: true },
      );
    } catch (err) {
      console.error(`Failed to log ${action}`, err);
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const getStreamUrl = async () => {
    const res = await axios.get(
      `${API_URL}/stream-video/signed-url/${selectedVideo?.video_id}`,
      { withCredentials: true },
    );

    return res.data.url.startsWith("http")
      ? res.data.url
      : `${API_URL}${res.data.url}`;
  };

  const openVideo = async () => {
    if (!selectedVideo) return;

    try {
      setIsExpired(false);
      const url = await getStreamUrl();
      setStreamUrl(url);
      setVideoUnlocked(true);
    } catch (err) {
      console.error("Failed to load video stream", err);
      setIsExpired(true);
    }
  };

  const refreshStreamSession = async () => {
    if (!selectedVideo) return;

    try {
      const current = videoRef.current?.currentTime ?? 0;
      const url = await getStreamUrl();
      setStreamUrl(url);

      requestAnimationFrame(() => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = current;
        videoRef.current.play().catch((err) => {
          console.log("Playback requires user action:", err);
        });
      });
    } catch (err) {
      console.error(err);
      setIsExpired(true);
    }
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      await videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleDeleteVideo = async (video: Video) => {
    const reason = await promptAction({
      title: "Request physical evidence deletion",
      message: "The database metadata and audit history will be retained. Enter the reason for deleting the stored object.",
      placeholder: "Deletion reason",
      confirmLabel: "Continue",
      tone: "danger",
      required: true,
    });
    if (!reason) return;

    const approvalCode = await promptAction({ title: "Main Super Admin approval", message: "Enter the single-use approval code issued for this video deletion.", placeholder: "Approval code", confirmLabel: "Request deletion", required: true });
    if (!approvalCode) return;
    try {
      await axios.post(`${API_URL}/retention/videos/${video.video_id}/delete`, { reason, approval_code: approvalCode }, { withCredentials: true });
      await refreshVideos();
      await showMessage({
        title: "Deletion queued",
        message: "The retention worker will delete the physical object if policy allows. Evidence metadata remains permanent.",
        tone: "success",
      });
    } catch (err) {
      console.error("Failed to delete video", err);
      await showMessage({
        title: "Delete Failed",
        message: "The deletion request could not be queued.",
        tone: "danger",
      });
    }
  };

  // RETENTION AND LEGAL HOLD HANDLERS
  const placeLegalHold = async () => {
  if (!selectedVideo) return;

  const reason = await promptAction({
    title: "Place Legal Hold",
    message: "Enter the reason for legal hold or court hold.",
    placeholder: "Reason for legal hold",
    confirmLabel: "Place Hold",
    required: true,
  });
  if (!reason) return;

  const approvalCode = await promptAction({ title: "Main Super Admin approval", message: "Enter the single-use approval code issued for this legal hold.", placeholder: "Approval code", confirmLabel: "Apply hold", required: true });
  if (!approvalCode) return;
  try {
    const res = await axios.patch(
      `${API_URL}/retention/videos/${selectedVideo.video_id}/legal-hold`,
      { reason, approval_code: approvalCode },
      { withCredentials: true }
    );

    setSelectedVideo(res.data);
    await refreshVideos();
    await showMessage({
      title: "Legal Hold Placed",
      message: "Evidence is protected.",
      tone: "success",
    });
  } catch (err) {
    console.error(err);
    await showMessage({
      title: "Legal Hold Failed",
      message: "Failed to place legal hold.",
      tone: "danger",
    });
  }
  };

  const releaseLegalHold = async () => {
    if (!selectedVideo) return;

    const reason = await promptAction({
      title: "Release Legal Hold",
      message: "Enter the reason for releasing this legal hold.",
      placeholder: "Release reason",
      confirmLabel: "Release Hold",
      required: true,
    });
    if (!reason) return;

    const approvalCode = await promptAction({ title: "Main Super Admin approval", message: "Enter the single-use approval code issued for this legal-hold release.", placeholder: "Approval code", confirmLabel: "Release hold", required: true });
    if (!approvalCode) return;
    try {
      const res = await axios.patch(
        `${API_URL}/retention/videos/${selectedVideo.video_id}/legal-hold/release`,
        { reason, approval_code: approvalCode },
        { withCredentials: true }
      );

      setSelectedVideo(res.data);
      await refreshVideos();
      await showMessage({
        title: "Legal Hold Released",
        message: "Legal hold released.",
        tone: "success",
      });
    } catch (err) {
      console.error(err);
      await showMessage({
        title: "Release Failed",
        message: "Failed to release legal hold.",
        tone: "danger",
      });
    }
  };

  const archiveEvidence = async () => {
    if (!selectedVideo) return;
    const reason = await promptAction({ title: "Archive evidence", message: "Enter the archive reason.", placeholder: "Archive reason", confirmLabel: "Continue", required: true });
    if (!reason) return;
    const approvalCode = await promptAction({ title: "Main Super Admin approval", message: "Enter the single-use approval code issued for this archive action.", placeholder: "Approval code", confirmLabel: "Archive evidence", required: true });
    if (!approvalCode) return;
    try {
      const response = await axios.patch(`${API_URL}/retention/videos/${selectedVideo.video_id}/archive`, { reason, approval_code: approvalCode }, { withCredentials: true });
      setSelectedVideo(response.data);
      await refreshVideos();
      await showMessage({ title: "Evidence archived", message: "The evidence lifecycle is now classified as archive retention.", tone: "success" });
    } catch {
      await showMessage({ title: "Archive failed", message: "The archive action could not be completed.", tone: "danger" });
    }
  };

  const extendEvidenceRetention = async () => {
    if (!selectedVideo) return;
    const currentExpiry = selectedVideo.storage_tier === "ARCHIVE"
      ? selectedVideo.archive_until
      : selectedVideo.retention_until;
    const retentionUntil = await promptAction({
      title: "Extend evidence retention",
      message: "Enter the new temporary retention end date and time in ISO format (for example 2027-01-31T23:59:59Z).",
      placeholder: currentExpiry ?? "2027-01-31T23:59:59Z",
      confirmLabel: "Continue",
      required: true,
    });
    if (!retentionUntil) return;
    const reason = await promptAction({ title: "Retention extension reason", message: "State why retention must be extended.", placeholder: "Reason", confirmLabel: "Continue", required: true });
    if (!reason) return;
    const approvalCode = await promptAction({ title: "Main Super Admin approval", message: "Enter the single-use approval code issued for this extension.", placeholder: "Approval code", confirmLabel: "Extend retention", required: true });
    if (!approvalCode) return;
    try {
      const response = await axios.patch(`${API_URL}/retention/videos/${selectedVideo.video_id}/retention`, {
        retention_until: new Date(retentionUntil).toISOString(),
        reason,
        approval_code: approvalCode,
      }, { withCredentials: true });
      setSelectedVideo(response.data);
      await refreshVideos();
      await showMessage({ title: "Retention extended", message: "The new retention date was recorded and audited.", tone: "success" });
    } catch {
      await showMessage({ title: "Extension failed", message: "Use a valid future date and a current single-use approval code.", tone: "danger" });
    }
  };

  const [storageAction, setStorageAction] = useState<
  | "LEGAL_HOLD"
  | "RELEASE"
  | "EXTEND"
  | "ARCHIVE"
  | "DELETE"
  | ""
>("");

  //FUNCTION TO LOAD SNAPSHOT FOR SELECTED VIDEO
  const openVerifyModal = async () => {
  if (!selectedVideo) return;

  try {
    const res = await axios.get(
      `${API_URL}/video-analysis/video/${selectedVideo.video_id}/snapshots`,
      { withCredentials: true }
    );

    setSnapshotOptions(res.data);
    setSelectedSnapshotId(res.data[0]?.snapshot_id ?? "");
    setShowVerifyModal(true);
  } catch (err) {
    console.error("Failed to load snapshots", err);
    await showMessage({
      title: "Snapshots Failed",
      message: "Failed to load snapshots for this video.",
      tone: "danger",
    });
  }
};

  // HANDLERS FOR ANALYSIS MODAL
  const openAnalysisModal = (type: "faces" | "plates") => {
    setAnalysisType(type);
    setSelectedAnalysisVideos([]);
    setAnalysisModalOpen(true);
  };
  void openAnalysisModal;

const toggleAnalysisVideo = (videoId: string) => {
  setSelectedAnalysisVideos((prev) =>
    prev.includes(videoId)
      ? prev.filter((id) => id !== videoId)
      : [...prev, videoId]
  );
};

const runAnalysis = async () => {
  if (!analysisType || selectedAnalysisVideos.length === 0) return;

  try {
    setAnalysisLoading(true);

    // 1. Start job
    await axios.post(
      `${API_URL}/video-analysis/start`,
      {
        video_ids: selectedAnalysisVideos,
        type: analysisType,
      },
      { withCredentials: true }
    );

    setAnalysisJobModalOpen(true);
    setAnalysisJobStatus({
      status: "RUNNING",
      total: selectedAnalysisVideos.length,
      completed: 0,
    });

  } catch (err) {
    console.error("Failed to start analysis", err);
    await showMessage({
      title: "Analysis Failed",
      message: "Failed to start analysis.",
      tone: "danger",
    });
  } finally {
    setAnalysisLoading(false);
  }
};

  /* ================= FULLSCREEN TRACKING ================= */


  /* ---------------- FILTER ORGS ---------------- */
  const filteredOrgs = useMemo(() => {
    const term = orgSearch.toLowerCase();
    return organizations.filter((o) =>
      o.name.toLowerCase().includes(term)
    );
  }, [organizations, orgSearch]);

const handleTamperUpdate = async (videoId: string, value: boolean) => {
  runAction(async () => {
    try {
    await axios.patch(
      `${API_URL}/video/${videoId}`,
      { tamper_flag: value },
      { withCredentials: true }
    );

    // Update local state instantly (no refetch needed)
    setVideos((prev) =>
      prev.map((v) =>
        v.video_id === videoId ? { ...v, tamper_flag: value } : v
      )
    );
  } catch (err) {
    console.error("Failed to update tamper flag", err);
    await showMessage({
      title: "Update Failed",
      message: "Failed to update tamper flag.",
      tone: "danger",
    });
  }
  },
  {});
};

  /* ---------------- FILTER VIDEOS ---------------- */
  const filteredVideos = videos;

  //GROUP VIDEOS BY DATE
  const groupedVideos = useMemo(() => {
    const activeVideos = filteredVideos.filter((v) => !v.deleted_at);

    return activeVideos.reduce<Record<string, Record<string, Video[]>>>((groups, video) => {
      const dateKey = new Date(video.start_timestamp).toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const officer = video.session?.officer;
      const officerUser = officer?.user ?? video.user;
      const officerName = officerUser
        ? `${officerUser.first_name} ${officerUser.last_name}`.trim()
        : video.session?.officer_id
          ? `Officer ${video.session.officer_id.slice(0, 8)}`
          : "Officer record unavailable";

      groups[dateKey] ??= {};
      groups[dateKey][officerName] ??= [];
      groups[dateKey][officerName].push(video);

      return groups;
    }, {});
  }, [filteredVideos]);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedOfficer, setExpandedOfficer] = useState<string | null>(null);

  const [analysisExpandedDate, setAnalysisExpandedDate] = useState<string | null>(null);
  const [analysisExpandedOfficer, setAnalysisExpandedOfficer] = useState<string | null>(null);


  /* ---------------- UI ---------------- */
  return (
    <div className="flex h-full w-full bg-body-black text-white border border-gray-700">
      {/* LEFT – ORGS */}
      <div className="w-1/4 border-r border-gray-700 overflow-y-auto">
        <div className="p-3 border-b border-gray-700">
          <input
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
            placeholder="Search organizations..."
            className="w-full p-2 bg-gray-900 border border-gray-700 text-sm"
          />
        </div>

        {filteredOrgs.map((org) => (
          <div
            key={org.org_id}
            onClick={ async () => {
              setSelectedOrgId(org.org_id)
            
              // Log the click
              try {
                await axios.post(
                  `${API_URL}/organization/access/organization/click`,
                  {}, // no body needed for now
                  { withCredentials: true }
                );
              } catch (err) {
                console.error("Failed to log organization click", err);
              }
            }}
            className={`p-3 cursor-pointer hover:bg-gray-800 ${
              selectedOrgId === org.org_id ? "bg-gray-900" : ""
            }`}
          >
            <div className="font-semibold">{org.name}</div>
            <div className="text-xs text-gray-400">
              Active: {org.active ? "Yes" : "No"}
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TABLE */}
        <div className="h-full border-b border-gray-700 overflow-hidden">
          <div className="p-2 border-b border-gray-700">
            <input
              value={videoSearch}
              onChange={(e) => setVideoSearch(e.target.value)}
              placeholder="Search videos..."
              className="w-full p-2 mt-2 bg-gray-900 border border-gray-700 text-sm"
            />
          </div>

          <div className="overflow-y-auto max-h-96 min-h-96 border border-gray-700"> 
            {isSearchingVideos && (
              <p className="text-xs text-gray-500 px-2 py-1">
                Updating videos...
              </p>
            )}
            <table
                className={`w-full text-left transition-opacity duration-200 ${
                  isSearchingVideos ? "opacity-60" : "opacity-100"
                }`}
              >
              <thead className="bg-gray-900 sticky top-0">
                <tr>
                  <th className="p-2">Officer</th>
                  <th className="p-2">Org</th>
                  <th className="p-2">Branch</th>
                  <th className="p-2">Camera</th>
                  <th className="p-2">Duration</th>
                  <th className="p-2">Storage</th>
                  <th className="p-2">Tampered</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>

              {/* Active Videos */}
              <tbody>
                {Object.entries(groupedVideos).map(([date, officers]) => (
                  <>
                    <tr
                      key={date}
                      onClick={() => setExpandedDate(expandedDate === date ? null : date)}
                      className="bg-gray-900 cursor-pointer hover:bg-gray-800"
                    >
                      <td colSpan={8} className="p-3 font-semibold">
                        {expandedDate === date ? "▼" : "▶️"} {date}
                      </td>
                    </tr>

                    {expandedDate === date &&
                      Object.entries(officers).map(([officerName, officerVideos]) => {
                        const officerKey = `${date}-${officerName}`;

                        return (
                          <>
                            <tr
                              key={officerKey}
                              onClick={() =>
                                setExpandedOfficer(
                                  expandedOfficer === officerKey ? null : officerKey
                                )
                              }
                              className="bg-gray-800 cursor-pointer hover:bg-gray-700"
                            >
                              <td colSpan={8} className="p-3 pl-8 font-semibold">
                                {expandedOfficer === officerKey ? "▼" : "▶️"} {officerName} - ({officerVideos.length}) video
                                {officerVideos.length > 1 ? "s" : ""}
                              </td>
                            </tr>

                            {expandedOfficer === officerKey &&
                              officerVideos.map((v) => (
                                <tr
                                  key={v.video_id}
                                  onClick={() => {
                                    setSelectedVideo(v);
                                    setShowVideoModal(true);
                                  }}
                                  className="border-b border-gray-700 cursor-pointer hover:bg-gray-800"
                                >
                                  <td className="p-2">{officerName}</td>
                                  <td className="p-2">{v.session?.officer?.user.organization?.name}</td>
                                  <td className="p-2">{v.session?.officer?.user.branch?.name}</td>
                                  <td className="p-2">{v.session?.camera?.serial_number}</td>
                                  <td className="p-2"><ConvertTime seconds={v.duration} /></td>
                                  <td className="p-2">{v.storage_state}</td>

                                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                                    <select
                                      value={v.tamper_flag ? "YES" : "NO"}
                                      onChange={(e) =>
                                        handleTamperUpdate(v.video_id, e.target.value === "YES")
                                      }
                                      className="bg-gray-900 border border-gray-700 text-sm p-1"
                                    >
                                      <option value="NO">NO</option>
                                      <option value="YES">YES</option>
                                    </select>
                                  </td>

                                  <td className="p-2">
                                    <button
                                      className="underline hover:no-underline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteVideo(v);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </>
                        );
                      })}
                  </>
                ))}
              </tbody>

              {/* Deleted Videos */}
              {filteredVideos.some(v => v.deleted_at) && (
                <>
                  <tr className="bg-gray-900 text-gray-300">
                    <td colSpan={8} className="p-2 font-semibold">Deleted Videos</td>
                  </tr>
                  <tbody>
                    {filteredVideos.filter(v => v.deleted_at).map(v => (
                      <tr
                        key={v.video_id}
                        className="border-b border-gray-700 cursor-pointer text-gray-400 hover:bg-gray-800"
                        onClick={() => setSelectedVideo(v)}
                      >
                        <td className="p-2">{v.session?.officer?.user.first_name} {v.session?.officer?.user.last_name}</td>
                        <td className="p-2">{v.session?.officer?.user.organization?.name}</td>
                        <td className="p-2">{v.session?.officer?.user.branch?.name}</td>
                        <td className="p-2">{v.session?.camera?.serial_number}</td>
                        <td className="p-2"><ConvertTime seconds={v.duration} /></td>
                        <td className="p-2">{v.storage_state}</td>
                        <td className="p-2">—</td> {/* no tamper change */}
                        <td className="p-2">—</td> {/* no delete action */}
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>

          {/* ANALYSIS BUTTONS */}
          <div className="space-y-2">
            <button
              onClick={() => {
                // openAnalysisModal("faces") //UNCOMMENT WHEN THE LOGIC FOR ANALYSIS WORK
                setComingSoonOpen(true); //REMOVE ONCE ANALYSIS WORKS
              }}
              className="border w-full p-2 underline hover:no-underline"
            >
              Search Faces
            </button>

            <button
              onClick={() => {
                // openAnalysisModal("plates") //UNCOMMENT WHEN THE LOGIC FOR ANALYSIS WORK
                setComingSoonOpen(true); //REMOVE ONCE ANALYSIS WORKS
              }}
              className="border w-full p-2 underline hover:no-underline"
            >
              Search Number Plates
            </button>
          </div>
        </div>
        <div className="p-3 text-sm text-gray-400">
          {!showVideoModal && (
            <p>Click a video row to view additional details.</p>
          )}
        </div>
      </div>


      {showVideoModal && selectedVideo && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4">

          <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">

            {/* HEADER */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.18em] text-red-300">Video Evidence Record</p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {selectedVideo.session?.officer?.user.first_name} {selectedVideo.session?.officer?.user.last_name}
                </h2>
                <p className="mt-1 break-all font-mono text-xs text-white/45">Officer ID: {selectedVideo.session?.officer_id ?? "N/A"}</p>
                <p className="mt-1 break-all text-sm text-white/55">{selectedVideo.video_id}</p>
              </div>

              <button
                onClick={()=>{
                if(videoRef.current){
                  videoRef.current.pause();
                  videoRef.current.src="";
                }

                setStreamUrl(null);
                setShowVideoModal(false);
                setVideoUnlocked(false);
                }}
                className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="flex min-h-0 flex-1 overflow-hidden">

              {/* LEFT: VIDEO PLAYER */}
              <div className="flex w-2/3 flex-col items-center justify-center bg-black">

                {!videoUnlocked && (
                  <button
                    className="border border-white/10 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
                    onClick={openVideo}
                  >
                    View Video
                  </button>
                )}

                {videoUnlocked && streamUrl && (
                    <div
                      ref={containerRef}
                      className={
                        isFullscreen
                          ? "fixed inset-0 bg-black flex items-center justify-center"
                          : "relative w-full bg-black"
                      }
                    >
                      <video
                        ref={videoRef}
                        src={streamUrl}
                        crossOrigin="use-credentials"
                        className={
                          isFullscreen
                            ? "w-full h-full object-contain"
                            : "h-80 w-full object-contain"
                        }
                        controls={false}
                        disablePictureInPicture
                        onLoadedMetadata={() => {
                          if (videoRef.current) {
                            setDuration(videoRef.current.duration);
                          }
                        }}
                        onPlay={() => {
                          setIsPlaying(true);
                          void logVideoEvent("VIDEO_PLAY", {
                            current_time: videoRef.current?.currentTime ?? 0,
                          });
                        }}
                        onPause={() => {
                          setIsPlaying(false);
                          void logVideoEvent("VIDEO_PAUSE", {
                            current_time: videoRef.current?.currentTime ?? 0,
                          });
                        }}
                        onEnded={() => {
                          setIsPlaying(false);
                          void logVideoEvent("VIDEO_ENDED", {
                            duration: videoRef.current?.duration ?? 0,
                          });
                        }}
                        onSeeked={() => {
                          void logVideoEvent("VIDEO_SEEK", {
                            current_time: videoRef.current?.currentTime ?? 0,
                          });
                        }}
                        onTimeUpdate={() => {
                          if (!videoRef.current) return;

                          setCurrentTime(videoRef.current.currentTime);

                          const now = Date.now();
                          if (now - lastSentRef.current < 2000) return;

                          lastSentRef.current = now;

                          axios.post(
                            `${API_URL}/video/track`,
                            {
                              video_id: selectedVideo.video_id,
                              position: videoRef.current.currentTime,
                            },
                            { withCredentials: true }
                          );
                        }}

                        onContextMenu={(e) => e.preventDefault()}

                       onError={async () => {

                        if(streamRetryRef.current){
                          return;
                        }

                        streamRetryRef.current = true;

                        console.log("Video stream failed, renewing ticket");

                        await refreshStreamSession();

                        setTimeout(() => {
                          streamRetryRef.current = false;
                        }, 5000);

                      }}
                      />

                      {/* WATERMARK */}
                      <VideoWatermark video={selectedVideo} time={time} />

                      {isExpired && (
                        <VideoExpiredOverlay logo="/logo_1.png" />
                      )}

                      {/* CONTROLS OVERLAY */}
                      <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-2 bg-black/70 p-3">

                        {/* TIME DISPLAY */}
                        <div className="flex justify-between text-xs text-gray-300 px-1">
                          <span>{formatTime(currentTime)}</span>
                          <span>-{formatTime(remainingTime)}</span>
                        </div>
                        
                        {/* SEEK BAR */}
                        <input
                          type="range"
                          min={0}
                          max={duration || 0}
                          value={currentTime}
                          onChange={handleSeek}
                          className="w-full"
                        />

                        {/* BUTTONS */}
                        <div className="flex justify-center items-center gap-3">
                          
                          <button onClick={togglePlay} className="border border-white/10 bg-gray-900 px-3 py-1 text-xs hover:bg-white/10">
                            {isPlaying ? "Pause" : "Play"}
                          </button>

                          <button onClick={toggleMute} className="border border-white/10 bg-gray-900 px-3 py-1 text-xs hover:bg-white/10">
                            {isMuted ? "Unmute" : "Mute"}
                          </button>

                          <button
                            onClick={toggleFullscreen}
                            className="border border-white/10 bg-gray-900 px-3 py-1 text-xs hover:bg-white/10"
                          >
                            {isFullscreen ? 'Exit' : 'Fullscreen'}
                          </button>

                        </div>
                      </div>
                    </div>
                )}
              </div>

              {/* RIGHT: DETAILS */}
              <div className="w-1/3 space-y-4 overflow-y-auto border-l border-white/10 bg-gray-950 p-4">

                {/* VIDEO DETAILS */}
                <div>
                  <h3 className="text-sm uppercase text-gray-400 mb-2 underline">
                    Video Details
                  </h3>

                  <div className="text-sm space-y-1 text-left">
                    <p><span className="text-gray-400">Video ID:</span> {selectedVideo.video_id}</p>
                    <p><span className="text-gray-400">Format:</span> {selectedVideo.format}</p>
                    <p><span className="text-gray-400">Resolution:</span> {selectedVideo.resolution}</p>
                    <p><span className="text-gray-400">Storage:</span> {selectedVideo.storage_state}</p>
                    <p><span className="text-gray-400">Retention tier:</span> {selectedVideo.storage_tier ?? "TEMPORARY"}</p>
                    <p><span className="text-gray-400">Retention status:</span> <span className={selectedVideo.retention_status === "RETENTION_EXPIRED" ? "text-red-300" : selectedVideo.legal_hold ? "text-yellow-300" : "text-emerald-300"}>{selectedVideo.retention_status ?? "ACTIVE"}</span></p>
                    <p><span className="text-gray-400">Temporary retention ends:</span> {selectedVideo.retention_until ? new Date(selectedVideo.retention_until).toLocaleString() : "Not assigned"}</p>
                    {selectedVideo.storage_tier === "ARCHIVE" && <p><span className="text-gray-400">Archive retention ends:</span> {selectedVideo.archive_until ? new Date(selectedVideo.archive_until).toLocaleString() : "Not assigned"}</p>}
                    <p><span className="text-gray-400">Evidence object:</span> {selectedVideo.storage_object_exists === false ? "Deleted; metadata retained" : "Available"}</p>
                    <p>
                      <span className="text-gray-400">Legal Hold:</span>{" "}
                      {selectedVideo.legal_hold ? "YES" : "NO"}
                    </p>

                    <p>
                      <span className="text-gray-400">Restore Status:</span>{" "}
                      {selectedVideo.restore_status ?? "NOT_REQUESTED"}
                    </p>

                    <p>
                      <span className="text-gray-400">Restore Expires:</span>{" "}
                      {selectedVideo.restore_expires_at
                        ? new Date(selectedVideo.restore_expires_at).toLocaleString()
                        : "N/A"}
                    </p>
                    <p><span className="text-gray-400 block">Path:</span>
                      <span className="break-all">{selectedVideo.file_path}</span>
                    </p>
                    <p><span className="text-gray-400">Video Delete Reason:</span> {selectedVideo.video_del_reason}</p>
                  </div>
                </div>

                <hr className="border-gray-700" />

                {/* TIMESTAMPS */}
                <div>
                  <h3 className="text-sm uppercase text-gray-400 mb-2 underline">
                    Timestamps
                  </h3>

                  <div className="text-sm space-y-1 text-left">
                    <p><span className="text-gray-400">Video Start Time:</span> {new Date(selectedVideo.start_timestamp).toLocaleString()}</p>
                    <p><span className="text-gray-400">Video End Time:</span> {new Date(selectedVideo.end_timestamp).toLocaleString()}</p>
                    <p><span className="text-gray-400">Video Created At:</span> {new Date(selectedVideo.created_at).toLocaleString()}</p>
                    <p><span className="text-gray-400">Video Deleted At:</span> {selectedVideo.deleted_at ? new Date(selectedVideo.deleted_at).toLocaleString() : "Video was not Deleted."}</p>
                  </div>
                </div>

                <hr className="border-gray-700" />

                {/* ROUTE */}
                <div>
                  <h3 className="text-sm uppercase text-gray-400 mb-2 underline">
                    GPS Route (video start and end coordinates)
                  </h3>

                  <div className="text-sm space-y-1 text-left">
                    <p><span className="text-gray-400">Start Lat:</span> {selectedVideo.start_lat}</p>
                    <p><span className="text-gray-400">Start Lon:</span> {selectedVideo.start_lon}</p>
                    <p><span className="text-gray-400">End Lat:</span> {selectedVideo.end_lat}</p>
                    <p><span className="text-gray-400">End Lon:</span> {selectedVideo.end_lon}</p>
                  </div>
                </div>

                <button
                  onClick={openVerifyModal}
                  className="w-full mt-4 px-4 py-2 border text-sm underline hover:no-underline"
                >
                  Verify Snapshot Integrity
                </button>

                <div className="space-y-3">

                  {/* ACTION SELECT */}
                  <select
                    value={storageAction}
                    onChange={(e) =>
                      setStorageAction(
                        e.target.value as
                          | "LEGAL_HOLD"
                          | "RELEASE"
                          | "EXTEND"
                          | "ARCHIVE"
                          | "DELETE"
                          | ""
                      )
                    }
                    className="w-full p-2 bg-gray-900 border border-gray-700 text-sm"
                  >
                    <option value="">Select Evidence Storage Action</option>

                    <option value="LEGAL_HOLD">
                      Place Legal Hold
                    </option>
                    <option value="RELEASE">
                      Release Legal Hold
                    </option>
                    <option value="ARCHIVE">Move to archive retention</option>
                    <option value="EXTEND">Extend retention date</option>
                    <option value="DELETE">Request physical object deletion</option>
                  </select>

                  {/* LEGAL HOLD */}
                  {storageAction === "LEGAL_HOLD" && (
                    <button
                      onClick={placeLegalHold}
                      disabled={selectedVideo.legal_hold}
                      className="w-full border border-yellow-600 text-yellow-400 p-2 text-sm underline hover:no-underline disabled:opacity-50"
                    >
                      Place Legal Hold
                    </button>
                  )}

                  {storageAction === "ARCHIVE" && (
                    <button onClick={() => void archiveEvidence()} disabled={selectedVideo.storage_tier === "ARCHIVE"} className="w-full border border-sky-500/50 p-2 text-sm text-sky-200 underline hover:no-underline disabled:opacity-50">Move to archive retention</button>
                  )}

                  {storageAction === "EXTEND" && (
                    <button onClick={() => void extendEvidenceRetention()} className="w-full border border-violet-500/50 p-2 text-sm text-violet-100 underline hover:no-underline">Extend retention date</button>
                  )}

                  {storageAction === "DELETE" && (
                    <button onClick={() => void handleDeleteVideo(selectedVideo)} disabled={selectedVideo.legal_hold || selectedVideo.storage_object_exists === false} className="w-full border border-red-600 p-2 text-sm text-red-300 underline hover:no-underline disabled:opacity-50">Request physical object deletion</button>
                  )}

                  {/* RELEASE */}
                  {storageAction === "RELEASE" && (
                    <button
                      onClick={releaseLegalHold}
                      disabled={!selectedVideo.legal_hold}
                      className="w-full border border-red-600 text-red-400 p-2 text-sm underline hover:no-underline disabled:opacity-50"
                    >
                      Release Legal Hold
                    </button>
                  )}
                </div>

                <hr className="border-gray-700" />

                {/* OFFICER */}
                <div>
                  <h3 className="text-sm uppercase text-gray-400 mb-2 underline">
                    Officer
                  </h3>

                  <div className="text-sm text-left">
                    <p><span className="text-gray-400">Name:</span> {selectedVideo.session?.officer?.user.first_name}{" "}
                    {selectedVideo.session?.officer?.user.last_name}</p>
                    <p><span className="text-gray-400">Badge Number:</span> {selectedVideo.session?.officer?.badge_number ?? 'No Badge Number'}</p>
                    <p><span className="text-gray-400">Email:</span> {selectedVideo.session?.officer?.user.email}</p>
                  </div>
                </div>

                <hr className="border-gray-700" />

                {/* CAMERA */}
                <div>
                  <h3 className="text-sm uppercase text-gray-400 mb-2 underline">
                    Camera
                  </h3>

                  <div className="text-sm text-left">
                    <p><span className="text-gray-400">Serial Number:</span> {selectedVideo.session?.camera?.serial_number}</p>
                    <p><span className="text-gray-400">Model:</span> {selectedVideo.session?.camera?.model}</p>
                    <p><span className="text-gray-400">Type:</span> {selectedVideo.session?.camera?.type}</p>
                  </div>
                </div>

                <hr className="border-gray-700" />

                {/* EXPORT VIDEO BUTTON */}
                <div>
                  <button className="border w-full p-1 underline hover:no-underline">Export Video</button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FOR VIDEO UNLOCK */}

      {analysisModalOpen && analysisType && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 w-[90%] max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between">
              <h2 className="font-semibold text-white">
                {analysisType === "faces"
                  ? "Select videos to search for faces"
                  : "Select videos to search for number plates"}
              </h2>

              <button
                onClick={() => setAnalysisModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2">
              {Object.entries(groupedVideos).map(([date, officers]) => (
                <div key={date} className="border border-gray-700">
                  <button
                    type="button"
                    onClick={() => setAnalysisExpandedDate(analysisExpandedDate === date ? null : date)}
                    className="w-full text-left bg-gray-900 hover:bg-gray-800 p-3 font-semibold"
                  >
                    {analysisExpandedDate === date ? "▼" : "▶️"} {date}
                  </button>
 
                  {analysisExpandedDate === date &&
                    Object.entries(officers).map(([officerName, officerVideos]) => {
                      const officerKey = `${date}-${officerName}`;

                      return (
                        <div key={officerKey}>
                          <button
                            type="button"
                            onClick={() =>
                              setAnalysisExpandedOfficer(
                                analysisExpandedOfficer === officerKey ? null : officerKey
                              )
                            }
                            className="w-full text-left bg-gray-800 hover:bg-gray-700 p-3 pl-8 font-semibold"
                          >
                            {analysisExpandedOfficer === officerKey ? "▼" : "▶️"} {officerName} -{" "}
                            ({officerVideos.length}) video{officerVideos.length > 1 ? "s" : ""}
                            <span className="ml-2 font-mono text-[11px] text-white/45">ID: {officerVideos[0]?.session?.officer_id ?? "N/A"}</span>
                          </button>

                          {analysisExpandedOfficer === officerKey &&
                            officerVideos.map((video) => (
                              <label
                                key={video.video_id}
                                className="flex items-center gap-3 border-t border-gray-700 p-3 pl-12 hover:bg-gray-800 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedAnalysisVideos.includes(video.video_id)}
                                  onChange={() => toggleAnalysisVideo(video.video_id)}
                                />

                                <div className="text-sm">
                                  <p className="text-white">
                                    {video.start_timestamp
                                      ? new Date(video.start_timestamp).toLocaleString()
                                      : "Unknown time"}
                                  </p>
                                </div>
                              </label>
                            ))}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-700 flex gap-3">
              <button
                onClick={runAnalysis}
                disabled={analysisLoading || selectedAnalysisVideos.length === 0}
                className="bg-red-700 hover:bg-red-800 disabled:bg-gray-700 px-4 py-2 font-semibold"
              >
                {analysisLoading ? "Analyzing..." : "Run Analysis & Export PDF"}
              </button>

              <button
                onClick={() => setAnalysisModalOpen(false)}
                className="border border-gray-700 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showVerifyModal && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 w-[90%] max-w-xl p-6">
            <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
              <h2 className="text-lg font-semibold text-white">
                Verify Snapshot Integrity
              </h2>

              <button
                onClick={() => setShowVerifyModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {snapshotOptions.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No analysis snapshots found for this video.
              </p>
            ) : (
              <>
                <label className="block text-sm text-gray-300 mb-2">
                  Select Snapshot
                </label>

                <select
                  value={selectedSnapshotId}
                  onChange={(e) => setSelectedSnapshotId(e.target.value)}
                  className="w-full bg-black border border-gray-700 p-2 text-sm text-white"
                >
                  {snapshotOptions.map((snapshot) => (
                    <option
                      key={snapshot.snapshot_id}
                      value={snapshot.snapshot_id}
                    >
                      {snapshot.snapshot_id} | {snapshot.officer_name} | {snapshot.label}
                    </option>
                  ))}
                </select>

                <button
                  disabled={!selectedSnapshotId || verifyLoading}
                  onClick={async () => {
                    try {
                      setVerifyLoading(true);

                      const res = await axios.get(
                        `${API_URL}/video-analysis/snapshot/${selectedSnapshotId}/verify`,
                        { withCredentials: true }
                      );

                      await showMessage({
                        title: "Snapshot Integrity",
                        message: `Integrity Status: ${res.data.status}. Matches: ${res.data.matches}. Original Hash: ${res.data.original_hash}. Current Hash: ${res.data.current_hash}`,
                        tone: res.data.matches ? "success" : "danger",
                      });
                    } catch (err) {
                      console.error("Verification failed", err);
                      await showMessage({
                        title: "Verification Failed",
                        message: "Failed to verify snapshot.",
                        tone: "danger",
                      });
                    } finally {
                      setVerifyLoading(false);
                    }
                  }}
                  className="mt-4 w-full bg-red-700 hover:bg-red-800 disabled:bg-gray-700 text-white py-2 font-semibold"
                >
                  {verifyLoading ? "Verifying..." : "Verify Snapshot"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {analysisJobModalOpen && analysisJobStatus && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 w-[420px] p-6 space-y-4">

            <h2 className="text-lg font-semibold">
              Running Analysis
            </h2>

            <div className="text-sm text-gray-400">
              Status: {analysisJobStatus.status}
            </div>

            {analysisJobStatus && (
              <div className="w-full bg-gray-800 h-2 overflow-hidden">
                <div
                  className="bg-red-600 h-2 transition-all duration-300"
                  style={{
                    width:
                      analysisJobStatus.total > 0
                        ? `${(analysisJobStatus.completed / analysisJobStatus.total) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            )}


            {analysisJobStatus.status !== "COMPLETED" && (
              <p className="text-xs text-gray-500">
                Processing video {analysisJobStatus.completed} of {analysisJobStatus.total}
              </p>
            )}

            {analysisJobStatus.status === "COMPLETED" && (
              <p className="text-xs text-white">
                Analysis complete. Generating PDF...
              </p>
            )}

          </div>
        </div>
      )}

      {/* COMING SOON MODAL */}
      <ComingSoonModal 
        open={comingSoonOpen}
        onClose={
          () => setComingSoonOpen(false)
        }/>
      {dialogElement}
    </div>
  );
}

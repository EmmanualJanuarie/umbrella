import { useState, useEffect, useRef, useDeferredValue, useMemo } from "react";
import axios from "axios";
import { type Video } from "../../data/types";
import { UserName } from "../../components/helpers/UserName";
import { ConvertTime } from "../../components/helpers/ConvertTime";
import VideoWatermark from "../../components/helpers/VideoWaterMark";
import VideoExpiredOverlay from "../../components/helpers/VideoExpiredOverlay";
import React from "react";
import {
  REDACTED_EVIDENCE_PATH,
  evidenceFileName,
  formatEvidenceDate,
  humanizeEvidenceValue,
} from "../../components/helpers/evidenceDisplay";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export default function BranchVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedOfficer, setExpandedOfficer] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [, setIsSearching] = useState(false);

  const [videoUnlocked, setVideoUnlocked] = useState(false);
  const [showVideosModal, setShowVideosModal] = useState(false);

  const [isExpired, setIsExpired] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRetryRef = useRef(false);

  const [time, setTime] = useState(new Date());

  const lastSentRef = useRef(0);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const refreshVideos = async (searchValue = deferredSearch) => {
    try {
      setIsSearching(true);
      const res = await axios.get(`${API_URL}/video`, {
        withCredentials: true,
        params: { search: searchValue },
      });
      setVideos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch videos", err);
      setVideos([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshVideos(deferredSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [deferredSearch]);

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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.currentTime = value;
    setCurrentTime(value);
  };

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

  /* ================= PLAYBACK TRACKING ================= */
  const logVideoEvent = async (
    action: "VIDEO_PLAY" | "VIDEO_PAUSE" | "VIDEO_ENDED" | "VIDEO_SEEK",
    details?: Record<string, unknown>
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
        { withCredentials: true }
      );
    } catch (err) {
      console.error(`Failed to log ${action}`, err);
    }
  };

    /* ================= FULLSCREEN TRACKING ================= */

  // ================================
  // Search Filter
  // ================================
  const filteredVideos = videos;

  // GROUP VIDEOS BY DATA AND OFFICER
  const groupedVideos = useMemo(() => {
    return filteredVideos.reduce<Record<string, Record<string, Video[]>>>(
      (groups, video) => {
        const dateKey = video.start_timestamp
          ? new Date(video.start_timestamp).toLocaleDateString("en-ZA", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "Unknown Date";

        const officerName = video.session?.officer?.user
          ? `${video.session.officer.user.first_name} ${video.session.officer.user.last_name}`
          : "Unknown Officer";

        groups[dateKey] ??= {};
        groups[dateKey][officerName] ??= [];
        groups[dateKey][officerName].push(video);

        return groups;
      },
      {}
    );
  }, [filteredVideos]);

  // ================================
  // Handle Video Click
  // ================================
  const handleSelectVideo = async (video: Video) => {
    setSelectedVideo(video);
    setShowVideosModal(true);

    try {
      await axios.post(
        `${API_URL}/video/access/video/click`,
        { video_id: video.video_id },
        { withCredentials: true }
      );
    } catch (err) {
      console.error("Failed to log click", err);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border border-white/10 bg-body-black text-white shadow-2xl">

      {/* LEFT PANE */}
      <div className="flex min-h-0 w-full flex-1 flex-col">

        <div className="border-b border-white/10 bg-gradient-to-r from-red-950/35 to-[#111214] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Branch evidence</p>
          <h2 className="mt-1 text-lg font-semibold">Video recordings</h2>
        </div>

        {/* SEARCH BAR */}
        <div className="border-b border-white/10 bg-black/20 p-3">
          <input
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-white/10 bg-gray-950 p-3 text-sm outline-none focus:border-red-500"
          />
        </div>

        {/* TABLE */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">

            {/* HEADER */}
            <thead className="sticky top-0 z-10 bg-[#17181b] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="p-2">Officer</th>
                <th className="p-2">Camera</th>
                <th className="p-2">Duration</th>
                <th className="p-2">Tampered</th>
                <th className="p-2">Start of Rec.</th>
                <th className="p-2">End of Rec.</th>
              </tr>
            </thead>

            {/* BODY */}
            <tbody>
              {Object.entries(groupedVideos).map(([date, officers]) => (
                <React.Fragment key={date}>

                  {/* DATE ROW */}
                  <tr
                    onClick={() =>
                      setExpandedDate(expandedDate === date ? null : date)
                    }
                    className="cursor-pointer bg-white/[0.04] transition hover:bg-white/[0.07]"
                  >
                    <td colSpan={6} className="p-3 font-semibold">
                      {expandedDate === date ? "▼" : "▶"} {date}
                    </td>
                  </tr>

                  {expandedDate === date &&
                    Object.entries(officers).map(([officerName, officerVideos]) => {

                      const officerKey = `${date}-${officerName}`;

                      return (
                        <React.Fragment key={officerKey}>

                          {/* OFFICER ROW */}
                          <tr
                            onClick={() =>
                              setExpandedOfficer(
                                expandedOfficer === officerKey ? null : officerKey
                              )
                            }
                            className="cursor-pointer bg-black/30 transition hover:bg-white/[0.05]"
                          >
                            <td colSpan={6} className="p-3 pl-8 font-semibold">
                              {expandedOfficer === officerKey ? "▼" : "▶"}{" "}
                              {officerName} ({officerVideos.length})
                            </td>
                          </tr>

                          {/* VIDEO ROWS */}
                          {expandedOfficer === officerKey &&
                            officerVideos.map((v) => (
                              <tr
                                key={v.video_id}
                                onClick={() => handleSelectVideo(v)}
                                className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04] ${
                                  selectedVideo?.video_id === v.video_id
                                    ? "bg-gray-900"
                                    : ""
                                }`}
                              >
                                {/* OFFICER */}
                                <td className="p-2 text-white font-medium">
                                  {officerName}
                                </td>

                                {/* CAMERA */}
                                <td className="p-2 text-gray-300">
                                  {v.session?.camera?.model ?? "N/A"}
                                </td>

                                {/* DURATION */}
                                <td className="p-2">
                                  <ConvertTime seconds={v.duration} />
                                </td>

                                {/* TAMPERED */}
                                <td className="p-2">
                                  <span
                                    className={`px-2 py-1  text-xs font-semibold ${
                                      v.tamper_flag
                                        ? "bg-red-500/20 text-red-400 border border-red-500"
                                        : "bg-green-500/20 text-green-400 border border-green-500"
                                    }`}
                                  >
                                    {v.tamper_flag ? "TAMPERED" : "CLEAN"}
                                  </span>
                                </td>

                                {/* START */}
                                <td className="p-2 text-xs text-gray-300">
                                  {v.start_timestamp
                                    ? new Date(v.start_timestamp).toLocaleString()
                                    : "N/A"}
                                </td>

                                {/* END */}
                                <td className="p-2 text-xs text-gray-300">
                                  {v.end_timestamp
                                    ? new Date(v.end_timestamp).toLocaleString()
                                    : "N/A"}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              ))}
            </tbody>
            </table>
            </div>
      </div>

      <div className="p-3 text-sm text-gray-400 text-center">
        {!showVideosModal && (
          <p>Select a field above to view additional information.</p>
        )}
      </div>

      <div>
        {/* VIDEO MODAL */}
        {selectedVideo && showVideosModal && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Video evidence details">
            <div className="flex max-h-[94vh] min-w-0 w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#111214] text-white shadow-2xl">

              {/* HEADER */}
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-red-950/40 via-black/25 to-black/10 px-4 py-4 sm:px-6 sm:py-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Protected video evidence</p>
                  <h2 className="mt-1 truncate text-xl font-semibold text-white">{evidenceFileName(selectedVideo)}</h2>
                  <p className="mt-1 text-sm text-white/55">
                    {selectedVideo.session?.officer?.user
                      ? `${selectedVideo.session.officer.user.first_name} ${selectedVideo.session.officer.user.last_name}`
                      : "Officer unavailable"}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-white/35">{selectedVideo.video_id}</p>
                </div>

                <button
                  onClick={() => {
                    setShowVideosModal(false);
                    setSelectedVideo(null);
                    setVideoUnlocked(false);
                    setStreamUrl(null);
                  }}
                  aria-label="Close video evidence details"
                  className="shrink-0 border border-white/10 px-3 py-2 text-[0px] text-white/70 after:text-sm after:content-['Close'] hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
              {/* VIDEO PLAYER */}
              <div className="border-b border-white/10 bg-black p-3 sm:p-5">
                {!videoUnlocked && (
                  <button
                    className="flex h-[clamp(220px,40vh,430px)] w-full flex-col items-center justify-center border border-white/10 bg-[radial-gradient(circle_at_center,rgba(127,29,29,0.18),transparent_55%)] text-sm font-semibold text-white transition hover:border-red-500/45 hover:bg-red-500/5"
                    onClick={openVideo}
                  >
                    <span className="text-base">Open protected stream</span>
                    <span className="mt-2 text-xs font-normal text-white/40">Playback activity is monitored and audited</span>
                  </button>
                )}
                {videoUnlocked && streamUrl &&(
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
                            : "h-[clamp(220px,40vh,430px)] w-full object-contain"
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

              {/* GRID INFO */}
              <div className="grid min-w-0 gap-4 p-3 text-sm sm:p-5 lg:grid-cols-2">

                {/* SESSION INFO */}
                <div className="min-w-0 border border-white/10 bg-white/[0.025] p-4">
                  <h4 className="mb-4 border-b border-white/10 pb-3 text-sm font-semibold">Session and officer</h4>

                  {selectedVideo.session ? (
                    <div className="space-y-2 text-left text-white/70">
                      <p>
                        <strong>Start:</strong>{" "}
                        {selectedVideo.session.start_time
                          ? new Date(selectedVideo.session.start_time).toLocaleString()
                          : "N/A"}
                      </p>

                      <p>
                        <strong>End:</strong>{" "}
                        {selectedVideo.session.end_time
                          ? new Date(selectedVideo.session.end_time).toLocaleString()
                          : "In Progress"}
                      </p>

                      <p>
                        <strong>Officer:</strong>{" "}
                        {selectedVideo.session.officer?.user.first_name}{" "}
                        {selectedVideo.session.officer?.user.last_name}
                      </p>
                      <p><strong>Officer ID:</strong> <span className="break-all font-mono text-xs">{selectedVideo.session.officer_id ?? "N/A"}</span></p>
                    </div>
                  ) : (
                    <p className="text-gray-400">No session data</p>
                  )}
                </div>

                {/* CAMERA INFO */}
                <div className="min-w-0 border border-white/10 bg-white/[0.025] p-4">
                  <h4 className="mb-4 border-b border-white/10 pb-3 text-sm font-semibold">Camera assignment</h4>

                  {selectedVideo.session?.camera ? (
                    <div className="space-y-2 text-left text-white/70">
                      <p><strong>Model:</strong> {selectedVideo.session.camera.model}</p>
                      <p><strong>Serial:</strong> {selectedVideo.session.camera.serial_number}</p>
                      <p><strong>Status:</strong> {humanizeEvidenceValue(selectedVideo.session.camera.status)}</p>
                      <p><strong>Assigned By:</strong> <UserName userId={selectedVideo.session.camera.assigned_to_officer_by} showRole /></p>
                    </div>
                  ) : (
                    <p className="text-gray-400">No camera assigned</p>
                  )}
                </div>
              </div>

               <div className="grid min-w-0 gap-4 px-3 pb-5 text-sm sm:px-5 lg:grid-cols-2">
                  {/* SHIFT DATA */}
                  {selectedVideo.session ? (
                    <div className="min-w-0 space-y-2 border border-white/10 bg-white/[0.025] p-4 text-left text-sm text-white/70">
                        <h4 className="mb-4 border-b border-white/10 pb-3 text-sm font-semibold text-white">Shift context</h4>
                        <p>
                          <strong>Officer:</strong>{" "}
                          {selectedVideo.session.officer?.user.first_name}{" "}
                          {selectedVideo.session.officer?.user.last_name}
                        </p>
                        <p><strong>Officer ID:</strong> <span className="break-all font-mono text-xs">{selectedVideo.session.officer_id ?? "N/A"}</span></p>

                        <p><strong>Shift Reference:</strong> <span className="break-all font-mono text-xs">{selectedVideo.session.shift_id ?? "Not linked"}</span></p>
                        <p><strong>Scheduled Start:</strong> {formatEvidenceDate(selectedVideo.session.shift?.start_time ?? selectedVideo.session.start_time)}</p>
                        <p><strong>Scheduled End:</strong> {formatEvidenceDate(selectedVideo.session.shift?.end_time ?? selectedVideo.session.end_time, "In progress")}</p>
                        <p><strong>Shift Status:</strong> {humanizeEvidenceValue(selectedVideo.session.shift?.status)}</p>
                        {selectedVideo.session.shift?.deleted_at && <p><strong>Deleted By:</strong> <UserName userId={selectedVideo.session.shift.deleted_by} showRole /></p>}
                        {selectedVideo.session.shift?.deleted_at && <p><strong>Deleted At:</strong> {formatEvidenceDate(selectedVideo.session.shift.deleted_at)}</p>}
                    </div>
                  ) : (
                    <p className="text-gray-400">No shift info</p>
                  )}

                  <div className="min-w-0 space-y-2 border border-white/10 bg-white/[0.025] p-4 text-left text-sm text-white/70">
                  <h4 className="mb-4 border-b border-white/10 pb-3 text-sm font-semibold text-white">Evidence record</h4>
                  <p><strong>Video Name:</strong> {evidenceFileName(selectedVideo)}</p>
                  <p><strong>Storage Path:</strong> <span className="font-semibold text-red-200">{REDACTED_EVIDENCE_PATH}</span></p>
                  <p><strong>Recorded:</strong> {formatEvidenceDate(selectedVideo.start_timestamp ?? selectedVideo.created_at)}</p>
                  <p><strong>Duration:</strong> {<><ConvertTime seconds={selectedVideo.duration}/></>}</p>
                  <p><strong>Integrity:</strong> <span className={selectedVideo.tamper_flag ? "text-red-300" : "text-emerald-300"}>{selectedVideo.tamper_flag ? "Tamper flag detected" : "No tamper flag"}</span></p>
                  <p><strong>Storage State:</strong> {humanizeEvidenceValue(selectedVideo.storage_state)}</p>
                  <p><strong>Retention:</strong> <span className={selectedVideo.retention_status === "RETENTION_EXPIRED" ? "text-red-300" : selectedVideo.legal_hold ? "text-yellow-300" : "text-emerald-300"}>{humanizeEvidenceValue(selectedVideo.retention_status ?? "ACTIVE")}</span></p>
                  <p><strong>Retention ends:</strong> {formatEvidenceDate(selectedVideo.storage_tier === "ARCHIVE" ? selectedVideo.archive_until : selectedVideo.retention_until, "Not assigned")}</p>
                  {selectedVideo.legal_hold && <p className="text-yellow-300"><strong>Legal hold:</strong> Active</p>}
                  <p><strong>Format:</strong> {selectedVideo.format ?? "Not available"}{selectedVideo.resolution ? ` · ${selectedVideo.resolution}` : ""}</p>
                  </div>
               </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL FOR VIDEO UNLOCK */}
    </div>
  );
}

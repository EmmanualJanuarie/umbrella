import { useEffect, useState, useMemo, useRef, useDeferredValue } from "react";
import { type Video } from "../../data/types";
import axios from "axios";
import { BranchName } from "../../components/helpers/BranchName";
import { ConvertTime } from "../../components/helpers/ConvertTime";
import { BranchLocation } from "../../components/helpers/BranchLocation";
import VideoWatermark from "../../components/helpers/VideoWaterMark";
import VideoExpiredOverlay from "../../components/helpers/VideoExpiredOverlay";
import React from "react";
import { UserName } from "../../components/helpers/UserName";

export default function Videos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedOfficer, setExpandedOfficer] = useState<string | null>(null);

  const streamRetryRef = useRef(false);
  const [, setIsSearching] = useState(false);

  const [loading, setLoading] = useState(false);
  const [videoUnlocked, setVideoUnlocked] = useState(false);
  const [showVideosModal, setShowVideosModal] = useState(false);

  const [time, setTime] = useState(new Date());

  const [isExpired, setIsExpired] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const lastSentRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const refreshVideos = async (searchValue = deferredSearch) => {
    try {
      setLoading(true);
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
      setLoading(false);
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

  /* ---------------- SEARCH FILTER ---------------- */
  const filteredVideos = useMemo(() => {
    const term = search.toLowerCase();

    return videos.filter((v) =>
      v.video_id.toLowerCase().includes(term) ||
      v.storage_state.toLowerCase().includes(term) ||
      (v.session?.officer
        ? `${v.session.officer.user.first_name} ${v.session.officer.user.last_name}`
            .toLowerCase()
            .includes(term)
        : false) ||
      (v.session?.officer?.user?.branch?.name?.toLowerCase().includes(term) ?? false) ||
      (v.session?.officer?.user?.organization?.name?.toLowerCase().includes(term) ?? false) ||
      (v.session?.camera?.serial_number?.toLowerCase().includes(term) ?? false)
    );
  }, [search, videos]);

  // Group videos by date and officer for UI display
  const groupedVideos = useMemo(() => {
    const activeVideos = filteredVideos.filter((v) => !v.deleted_at);

    return activeVideos.reduce<Record<string, Record<string, Video[]>>>(
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

  /* ---------------- UI ---------------- */
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border border-white/10 bg-body-black text-white shadow-2xl">
      {/* VIDEO TABLE */}
      <div className="w-full border-r border-gray-700 flex flex-col">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-red-950/35 to-black/20 p-4">
          <h2 className="font-semibold">
            Video Evidence — All Branches
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshVideos(deferredSearch)}
              className="border border-white/10 bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:border-red-500/60"
            >
              Refresh
            </button>
            <input
              type="text"
              placeholder="Search videos, officers, branches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-black border border-gray-700 px-3 py-2 text-sm w-72"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#17181b] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="p-2">Officer</th>
                <th className="p-2">Branch</th>
                <th className="p-2">Camera</th>
                <th className="p-2">Duration</th>
                <th className="p-2">Tampered</th>
                <th className="p-2">Start Of Rec.</th>
                <th className="p-2">End Of Rec.</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-400">
                    Loading videos...
                  </td>
                </tr>
              ) : filteredVideos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-400">
                    No video evidence found
                  </td>
                </tr>
              ) : (
                Object.entries(groupedVideos).map(([date, officers]) => (
                  <React.Fragment key={date}>
                    <tr
                      onClick={() => setExpandedDate(expandedDate === date ? null : date)}
                      className="cursor-pointer bg-white/[0.04] transition hover:bg-white/[0.07]"
                    >
                      <td colSpan={9} className="p-3 font-semibold">
                        {expandedDate === date ? "▼" : "▶️"} {date}
                      </td>
                    </tr>

                    {expandedDate === date &&
                      Object.entries(officers).map(([officerName, officerVideos]) => {
                        const officerKey = `${date}-${officerName}`;

                        return (
                          <React.Fragment key={officerKey}>
                            <tr
                              onClick={() =>
                                setExpandedOfficer(
                                  expandedOfficer === officerKey ? null : officerKey
                                )
                              }
                              className="cursor-pointer bg-black/30 transition hover:bg-white/[0.05]"
                            >
                              <td colSpan={9} className="p-3 pl-8 font-semibold">
                                {expandedOfficer === officerKey ? "▼" : "▶️"} {officerName} —{" "}
                                ({officerVideos.length}) video
                                {officerVideos.length > 1 ? "s" : ""}
                              </td>
                            </tr>

                            {expandedOfficer === officerKey &&
                              officerVideos.map((v) => (
                                <tr
                                  key={v.video_id}
                                  onClick={async () => {
                                    setSelectedVideo(v);
                                    setShowVideosModal(true);

                                    try {
                                      await axios.post(
                                        `${API_URL}/video/access/video/click`,
                                        { video_id: v.video_id },
                                        { withCredentials: true }
                                      );
                                    } catch (err) {
                                      console.error("Failed to log video click", err);
                                    }
                                  }}
                                  className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04] ${
                                    selectedVideo?.video_id === v.video_id ? "bg-gray-900" : ""
                                  }`}
                                >
                                  <td className="p-2">{officerName}</td>
                                  <td className="p-2">
                                    <BranchName branchId={v.session?.branch_id} />
                                  </td>
                                  <td className="p-2">{v.session?.camera?.model ?? "N/A"}</td>
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

                                  <td className="p-2">
                                    {v.start_timestamp
                                      ? `${new Date(v.start_timestamp).toDateString()}, ${new Date(
                                          v.start_timestamp
                                        ).toLocaleTimeString()}`
                                      : "N/A"}
                                  </td>
                                  <td className="p-2">
                                    {v.end_timestamp
                                      ? `${new Date(v.end_timestamp).toDateString()}, ${new Date(
                                          v.end_timestamp
                                        ).toLocaleTimeString()}`
                                      : "N/A"}
                                  </td>
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-3 text-sm text-gray-400 text-center">
        {!showVideosModal && (
          <p>Select a video to inspect classified evidence metadata.</p>
        )}
      </div>

     {/* VIDEO MODAL */}
      <>
        {showVideosModal && selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#111214] shadow-2xl">
            
            {/* HEADER */}
              <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-red-950/35 to-black/20 p-5">
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-white">
                    Video Intelligence Details
                  </h2>
                </div>

                <button
                  onClick={() => setShowVideosModal(false)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            <div className="grid min-h-0 gap-5 overflow-y-auto p-5 lg:grid-cols-[360px_minmax(0,1fr)]">
              {/* LEFT — METADATA */}
              <div className="space-y-3 border border-white/10 bg-white/[0.025] p-4 text-sm text-white/70">
                <p><strong>Officer:</strong> {selectedVideo.session?.officer?.user ? `${selectedVideo.session.officer.user.first_name} ${selectedVideo.session.officer.user.last_name}` : "N/A"}</p>
                <p><strong>Officer ID:</strong> <span className="break-all font-mono text-xs">{selectedVideo.session?.officer_id ?? "N/A"}</span></p>
                <p><strong>Email:</strong> {selectedVideo.session?.officer?.user?.email ?? "No Officer Email"}</p>
                <p><strong>Branch:</strong> <BranchName branchId={selectedVideo.session?.branch_id}/></p>
                <p><strong>Branch Location:</strong> <BranchLocation branchId={selectedVideo.session?.branch_id}/></p>

                <div className="pt-2 border-t border-gray-700" />

                <p><strong>Camera Model:</strong> {selectedVideo.session?.camera?.model ?? "No Camera Model"}</p>
                <p><strong>Assigner:</strong> <UserName userId={selectedVideo.session?.camera?.assigned_to_officer_by} showRole /></p>
                <p><strong>Assigned At:</strong> {selectedVideo.session?.camera?.assigned_to_officer_at
                      ? `${new Date(selectedVideo.session?.camera?.assigned_to_officer_at).toDateString()}, ${new Date(selectedVideo.session?.camera?.assigned_to_officer_at).toLocaleTimeString()}`
                      : "No Assigned Time"}
                </p>
                <p><strong>Serial Number:</strong> {selectedVideo.session?.camera?.serial_number ?? "No Camera Serial Number"}</p>

                <div className="pt-2 border-t border-gray-700" />

                <p><strong>Storage State:</strong> {selectedVideo.storage_state}</p>
                <p><strong>Retention:</strong> <span className={selectedVideo.retention_status === "RETENTION_EXPIRED" ? "text-red-300" : selectedVideo.legal_hold ? "text-yellow-300" : "text-emerald-300"}>{selectedVideo.retention_status ?? "ACTIVE"}</span></p>
                <p><strong>Retention ends:</strong> {selectedVideo.storage_tier === "ARCHIVE" ? (selectedVideo.archive_until ? new Date(selectedVideo.archive_until).toLocaleString() : "Not assigned") : (selectedVideo.retention_until ? new Date(selectedVideo.retention_until).toLocaleString() : "Not assigned")}</p>
                {selectedVideo.legal_hold && <p className="text-yellow-300"><strong>Legal hold:</strong> Active</p>}
                <p><strong>Duration:</strong> <ConvertTime seconds={selectedVideo.duration} /></p>
                <p><strong>Tamper Flag:</strong> {selectedVideo.tamper_flag ? "TRUE" : "FALSE"}</p>

                <div className="pt-2 border-t border-gray-700" />

                <p><strong>GPS:</strong> {selectedVideo.start_lat}, {selectedVideo.end_lat}, {selectedVideo.start_lon}, {selectedVideo.end_lon}</p>
              </div>

              {/* RIGHT — VIDEO PLAYER */}
              <div className="flex-1 flex flex-col items-center justify-center h-96 border border-gray-700 bg-black">
                {!selectedVideo ? (
                    <p className="text-gray-400">Select a video</p>
                  ) : (
                    <div className="text-sm space-y-2">
                      {!videoUnlocked && (
                        <button
                          className="px-6 py-3 border text-white font-bold"
                          onClick={openVideo}
                        >
                          View Video
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
                            : "w-full h-64 object-contain"
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
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 flex flex-col gap-2">

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
                          
                          <button onClick={togglePlay} className="text-xs px-2 py-1 bg-gray-800">
                            {isPlaying ? "Pause" : "Play"}
                          </button>

                          <button onClick={toggleMute} className="text-xs px-2 py-1 bg-gray-800">
                            {isMuted ? "Unmute" : "Mute"}
                          </button>

                          <button
                            onClick={toggleFullscreen}
                            className="text-xs px-2 py-1 bg-gray-800"
                          >
                            {isFullscreen ? 'Exit' : 'Fullscreen'}
                          </button>

                        </div>
                      </div>
                    </div>
                      )}
                    </div>
                  )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </>

      {/* MODAL FOR VIDEO UNLOCK */}
    </div>
  );
}

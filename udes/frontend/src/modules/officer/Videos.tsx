import { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import { type Video, type Session, type Camera } from "../../data/types";
import { ConvertTime } from "../../components/helpers/ConvertTime";
import VideoWatermark from "../../components/helpers/VideoWaterMark";
import VideoExpiredOverlay from "../../components/helpers/VideoExpiredOverlay";
import React from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export default function OfficerVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [, setLoading] = useState(false);
  const [videoUnlocked, setVideoUnlocked] = useState(false);
  const [showVideosModal, setShowVideosModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isExpired, setIsExpired] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSentRef = useRef(0);

  const streamRetryRef = useRef(false);

  const [time, setTime] = useState(new Date());
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const refreshVideos = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/video`, { withCredentials: true });
      setVideos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch videos", err);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshVideos();
  }, []);

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

  const handleSelectVideo = async (video: Video) => {
    setSelectedVideo(video);
    setShowVideosModal(true);

    await axios.post(
      `${API_URL}/video/access/video/click`,
      { video_id: video.video_id },
      { withCredentials: true }
    );
  };

  /* ================= LINKED DATA ================= */
  const linkedSession: Session | undefined = useMemo(
    () => selectedVideo?.session,
    [selectedVideo]
  );

  const linkedCamera: Camera | undefined = useMemo(
    () => selectedVideo?.session?.camera,
    [selectedVideo]
  );

  // GROUP VIDEO BY DATE
  const groupedVideos = useMemo(() => {
    return videos.reduce<Record<string, Video[]>>((groups, video) => {
      const dateKey = video.start_timestamp
        ? new Date(video.start_timestamp).toLocaleDateString("en-ZA", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "Unknown Date";

      groups[dateKey] ??= [];
      groups[dateKey].push(video);

      return groups;
    }, {});
  }, [videos]);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  /* ================= UI ================= */
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border border-white/10 bg-body-black text-white shadow-2xl">

      {/* LEFT PANE */}
      <div className="relative isolate min-h-0 w-full flex-1 overflow-auto">
        <div className="sticky top-0 z-30 border-b border-white/10 bg-[#111214] p-4 font-semibold shadow-[0_8px_16px_rgba(0,0,0,0.35)]">
          My Videos
        </div>

        <table className="relative z-0 w-full min-w-[720px] text-sm">
          <thead className="sticky top-[57px] z-20 bg-[#17181b] text-xs uppercase tracking-wide text-white/45">
            <tr>
              <th className="p-2">Duration</th>
              <th className="p-2">Tampered</th>
              <th className="p-2">Start Of Rec.</th>
              <th className="p-2">End Of Rec.</th>
            </tr>
          </thead>

          <tbody>
            {Object.entries(groupedVideos).map(([date, dateVideos]) => (
              <React.Fragment key={date}>
                
                {/* DATE DROPDOWN ROW */}
                <tr
                  onClick={() =>
                    setExpandedDate(expandedDate === date ? null : date)
                  }
                  className="cursor-pointer bg-white/[0.04] transition hover:bg-white/[0.07]"
                >
                  <td colSpan={5} className="p-3 font-semibold text-left">
                    {expandedDate === date ? "▼" : "▶️"} {date} ({dateVideos.length})
                  </td>
                </tr>

                {/* VIDEOS */}
                {expandedDate === date &&
                  dateVideos.map((video) => (
                    <tr
                      key={video.video_id}
                      onClick={() => handleSelectVideo(video)}
                      className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04]"
                    >

                      <td className="p-2">
                        <ConvertTime seconds={video.duration} />
                      </td>

                      {/* TAMPERED */}
                      <td className="p-2">
                        <span
                          className={`px-2 py-1  text-xs font-semibold ${
                            video.tamper_flag
                              ? "bg-red-500/20 text-red-400 border border-red-500"
                              : "bg-green-500/20 text-green-400 border border-green-500"
                          }`}
                        >
                          {video.tamper_flag ? "TAMPERED" : "CLEAN"}
                        </span>
                      </td>

                      <td className="p-2">
                        {video.start_timestamp
                          ? new Date(video.start_timestamp).toLocaleTimeString()
                          : "N/A"}
                      </td>

                      <td className="p-2">
                        {video.end_timestamp
                          ? new Date(video.end_timestamp).toLocaleTimeString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL AREA */}
      <div className="flex-1 p-4 overflow-y-auto space-y-6">

        {!showVideosModal ? (
          <div className="text-gray-400 text-center mt-20">
            Select a video to review
          </div>
        ) : (
          selectedVideo && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
              onClick={() => setShowVideosModal(false)}
            >
              <div
                className="max-h-[92vh] w-full max-w-6xl overflow-y-auto border border-white/10 bg-[#111214] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >

                {/* HEADER */}
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                  <h2 className="text-lg font-semibold">Video Evidence</h2>
                  <button onClick={() => setShowVideosModal(false)}>✕</button>
                </div>

                {/* VIDEO SECTION */}
                <section className="border border-gray-700 p-4">

                  {!videoUnlocked && (
                    <button
                      className="w-full h-64 border border-gray-700"
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
                </section>

                {/* INFO */}
                <div className="mt-4 grid gap-4 md:grid-cols-3">

                  <div className="border border-white/10 bg-white/[0.025] p-4 text-sm text-white/70">
                    <h3 className="font-semibold mb-2">Session</h3>
                    {linkedSession ? (
                      <>
                        <p>Start: {new Date(linkedSession.start_time).toLocaleString()}</p>
                        <p>End: {linkedSession.end_time ? new Date(linkedSession.end_time).toLocaleString() : "Active"}</p>
                      </>
                    ) : (
                      <p>Unavailable</p>
                    )}
                  </div>

                  <div className="border border-white/10 bg-white/[0.025] p-4 text-sm text-white/70">
                    <h3 className="font-semibold mb-2">Camera</h3>
                    {linkedCamera ? (
                      <>
                        <p>{linkedCamera.model}</p>
                        <p>{linkedCamera.serial_number}</p>
                      </>
                    ) : (
                      <p>Unavailable</p>
                    )}
                  </div>

                  <div className="border border-white/10 bg-white/[0.025] p-4 text-sm text-white/70">
                    <h3 className="mb-2 font-semibold text-white">Evidence</h3>
                    <p>Duration: <ConvertTime seconds={selectedVideo.duration} /></p>
                    <p>Resolution: {selectedVideo.resolution || "Unavailable"}</p>
                    <p>Integrity: {selectedVideo.tamper_flag ? "Review required" : "No tamper flag"}</p>
                    <p>Storage: {selectedVideo.storage_state || "Unavailable"}</p>
                    <p>Retention: {selectedVideo.retention_status?.replaceAll("_", " ") ?? "Active"}</p>
                    <p>Available until: {selectedVideo.retention_until ? new Date(selectedVideo.retention_until).toLocaleString() : "Not assigned"}</p>
                    {selectedVideo.legal_hold && <p className="text-yellow-300">Legal hold active</p>}
                  </div>

                </div>

              </div>
            </div>
          )
        )}
      </div>

      {/* UNLOCK MODAL */}
    </div>
  );
}

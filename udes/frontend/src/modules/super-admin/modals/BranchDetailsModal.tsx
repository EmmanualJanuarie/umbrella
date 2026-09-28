/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useMemo } from "react";
import VideoWatermark from "../../../components/helpers/VideoWaterMark";
import axios from "axios";
import VideoExpiredOverlay from "../../../components/helpers/VideoExpiredOverlay";
import { ConvertTime } from "../../../components/helpers/ConvertTime";

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBranch: any;
  branchSessions: any[];
  branchVideos: any[];
  selectedVideo: any;
  setSelectedVideo: (video: any) => void;
  showVideoModal: boolean;
  setShowVideoModal: (show: boolean) => void;
}

const BranchModal: React.FC<BranchModalProps> = ({
  isOpen,
  onClose,
  selectedBranch,
  branchSessions,
  branchVideos,
  selectedVideo,
  setSelectedVideo,
  showVideoModal,
  setShowVideoModal,
}) => {
  const [videoUnlocked, setVideoUnlocked] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [time, setTime] = useState(new Date());

  const [isExpired, setIsExpired] = useState(false);

  const lastSentRef = useRef(0);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const streamRetryRef = useRef(false);

  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [, setLoadingDetails] = useState(false);

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

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedOfficers, setExpandedOfficers] = useState<Record<string, boolean>>({});

  useEffect(() => {
  if (!selectedBranch?.branch_id) return;

  const timer = setTimeout(async () => {
    try {
      setLoadingDetails(true);

      const res = await axios.get(
        `${API_URL}/branches/${selectedBranch.branch_id}/details`,
        {
          withCredentials: true,
          params: {
            search,
          },
        }
      );

      setSessions(res.data.sessions);
      setVideos(res.data.videos);
    } catch (err) {
      console.error("Failed to load branch details", err);
    } finally {
      setLoadingDetails(false);
    }
  }, 350);

  return () => clearTimeout(timer);
}, [API_URL, selectedBranch?.branch_id, search]);

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
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* ================= CLOCK ================= */
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /* ================= FULLSCREEN ================= */
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  /* ================= FETCH STREAM ================= */
  const getStreamUrl = async () => {

    const res = await axios.get(
      `${API_URL}/stream-video/signed-url/${selectedVideo?.video_id}`,
      {withCredentials:true}
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

  /* ================= REFRESH STREAM FOR NEW ONE ================= */
  const refreshStreamSession = async () => {

  if(!selectedVideo) return;

  try {

  const current =
  videoRef.current?.currentTime ?? 0;

  const url = await getStreamUrl();

  setStreamUrl(url);

  requestAnimationFrame(async()=>{

    if(videoRef.current){

      videoRef.current.currentTime=current;

      try{
        videoRef.current.play().catch((err)=>{
          console.log("Playback requires user action:", err);
        });
      }
      catch(err){
        console.log("Autoplay blocked",err);
      }

    }

  });


  }catch(err){

  console.error(err);
  setIsExpired(true);

  }

  };

  /* ================= GROUP VIDEOS BY DATE & OFFICER NAME ================= */
  const groupedVideos = React.useMemo(() => {
  const groups: Record<string, Record<string, any[]>> = {};

  videos.forEach((v) => {
    const dateKey = v.start_timestamp
      ? new Date(v.start_timestamp).toLocaleDateString("en-ZA", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "Unknown Date";

    const officerName = v.officer?.user
      ? `${v.officer.user.first_name} ${v.officer.user.last_name}`
      : v.session?.officer?.user
      ? `${v.session.officer.user.first_name} ${v.session.officer.user.last_name}`
      : "Unknown Officer";

    if (!groups[dateKey]) groups[dateKey] = {};
    if (!groups[dateKey][officerName]) groups[dateKey][officerName] = [];

    groups[dateKey][officerName].push(v);
  });

  return groups;
}, [videos]);

  /* ================= CUSTOM PLAYBACK ================= */
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

   if (!isOpen || !selectedBranch) return null;


  return (
    
   <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
    <div className="w-full max-w-6xl h-[92vh] overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl flex flex-col">
        
        {/* HEADER (NON-SCROLLING) */}
        <div className="border-b border-white/10 bg-black/35 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-red-300">Branch Record</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{selectedBranch.name}</h2>
            <p className="mt-1 text-sm text-white/55">{selectedBranch.location || "No location recorded"}</p>
          </div>
            <button
            className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
            onClick={onClose}
            >
            Close
            </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase text-white/40">Sessions</p>
            <p className="mt-1 text-xl font-semibold">{sessions.length}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase text-white/40">Videos</p>
            <p className="mt-1 text-xl font-semibold">{videos.length}</p>
          </div>
        </div>
        </div>

         {/* search for officers */}
          <div className="border-b border-white/10 bg-black/20 p-5">
            <input
              type="text"
              placeholder="Search officer, email, badge, or camera serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-white/10 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
            />
          </div>

        {/* SCROLLABLE CONTENT ONLY */}
        <div className="flex-1 overflow-y-auto p-5">
            {/* Sessions */}
            <div className="mb-6">
            <h3 className="mb-2 border border-white/10 bg-white/[0.03] p-3 text-sm font-semibold uppercase text-white/65">Sessions</h3>
            {branchSessions.length === 0 ? (
                <p className="text-gray-400">No sessions available</p>
            ) : (
                <table className="w-full text-left border border-gray-700 mb-2">
                <thead className="bg-gray-800">
                    <tr>
                    <th className="p-2 border-b border-gray-700">Officer</th>
                    <th className="p-2 border-b border-gray-700">Camera</th>
                    <th className="p-2 border-b border-gray-700">Start</th>
                    <th className="p-2 border-b border-gray-700">End</th>
                    <th className="p-2 border-b border-gray-700">Status</th>
                    <th className="p-2 border-b border-gray-700">Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map((s) => (
                    <tr key={s.session_id} className="hover:bg-gray-800">
                        <td className="p-2 border-b border-gray-700">{s.officer?.user.first_name} {s.officer?.user.last_name}</td>
                        <td className="p-2 border-b border-gray-700">{s.camera?.serial_number}</td>
                        <td className="p-2 border-b border-gray-700">{new Date(s.start_time).toLocaleString()}</td>
                        <td className="p-2 border-b border-gray-700">{s.end_time ? new Date(s.end_time).toLocaleString() : "-"}</td>
                        <td className="p-2 border-b border-gray-700">{s.status}</td>
                        <td className="p-2 border-b border-gray-700">{s.notes || "-"}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            )}
            </div>

            {/* Videos */}
            <div className="mb-6">
            <h3 className="mb-2 border border-white/10 bg-white/[0.03] p-3 text-sm font-semibold uppercase text-white/65 sticky top-0">Videos</h3>
            {branchVideos.length === 0 ? (
                <p className="text-gray-400">No videos available</p>
            ) : (
                <table className="w-full text-left border border-gray-700">
                <thead className="bg-gray-800">
                    <tr>
                    <th className="p-2 border-b border-gray-700">Camera</th>
                    <th className="p-2 border-b border-gray-700">Officer</th>
                    <th className="p-2 border-b border-gray-700">Duration (mins)</th>
                    <th className="p-2 border-b border-gray-700">Captured</th>
                    <th className="p-2 border-b border-gray-700">Action</th>
                    </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedVideos).map(([date, officers]) => (
                    <React.Fragment key={date}>
                      
                      {/* DATE ROW */}
                      <tr
                        className="bg-gray-950 cursor-pointer hover:bg-gray-800"
                        onClick={() =>
                          setExpandedDates((prev) => ({
                            ...prev,
                            [date]: !prev[date],
                          }))
                        }
                      >
                        <td colSpan={5} className="p-2 font-semibold">
                          {expandedDates[date] ? "▼" : "▶"} {date}
                        </td>
                      </tr>

                      {/* OFFICERS */}
                      {expandedDates[date] &&
                        Object.entries(officers).map(([officerName, vids]) => {
                          const officerKey = `${date}-${officerName}`;

                          return (
                            <React.Fragment key={officerKey}>
                              
                              {/* OFFICER ROW */}
                              <tr
                                className="bg-gray-900 cursor-pointer hover:bg-gray-800"
                                onClick={() =>
                                  setExpandedOfficers((prev) => ({
                                    ...prev,
                                    [officerKey]: !prev[officerKey],
                                  }))
                                }
                              >
                                <td colSpan={5} className="p-2 pl-6 font-medium">
                                  {expandedOfficers[officerKey] ? "▼" : "▶"} {officerName} — ({vids.length}) videos
                                </td>
                              </tr>

                              {/* VIDEO ROWS */}
                              {expandedOfficers[officerKey] &&
                                vids.map((v) => {
                                  const camera = v.camera ?? v.session?.camera;
                                  const officer = v.officer ?? v.session?.officer;

                                  return (
                                    <tr key={v.video_id} className="hover:bg-gray-800">
                                      <td className="p-2 border-b border-gray-700">
                                        {camera?.serial_number ?? "No camera"}
                                      </td>

                                      <td className="p-2 border-b border-gray-700">
                                        {officer?.user
                                          ? `${officer.user.first_name} ${officer.user.last_name}`
                                          : "No officer"}
                                      </td>

                                      <td className="p-2 border-b border-gray-700">
                                        <ConvertTime seconds={v.duration} />
                                      </td>

                                      <td className="p-2 border-b border-gray-700">
                                        {v.start_timestamp
                                          ? new Date(v.start_timestamp).toLocaleString()
                                          : "N/A"}
                                      </td>

                                      <td className="p-2 border-b border-gray-700">
                                        <button
                                          className="underline hover:no-underline"
                                          onClick={() => {
                                            setSelectedVideo({
                                              ...v,
                                              camera,
                                              officer,
                                            });
                                            setShowVideoModal(true);
                                          }}
                                        >
                                          View
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  ))}
                </tbody>
                </table>
            )}
            </div>

       </div>
      </div>

      {showVideoModal && selectedVideo && (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-700 w-[90%] max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* HEADER */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-950">
            <div>
              <h2 className="text-lg font-semibold text-red-500">
                Video Evidence Review
              </h2>
              <p className="text-sm text-gray-400">
                Super Admin Access • Read Only
              </p>
            </div>

            <button
              onClick={() => setShowVideoModal(false)}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="flex flex-1 overflow-hidden">

            {/* LEFT: VIDEO PLAYER */}
            <div className="w-2/3 bg-black flex items-center justify-center">
              {selectedVideo.file_path ? (
                <div className="text-sm space-y-2">
                {!videoUnlocked && (
                  <button
                    className="w-full h-64 object-contain border-gray-700 mb-4 underline hover:no-underline"
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
              </div>
              ) : (
                <p className="text-gray-500">Video file unavailable</p>
              )}
            </div>

            {/* RIGHT: METADATA */}
            <div className="w-1/3 overflow-y-auto p-4 space-y-4 border-l border-gray-700">

              {/* SECTION */}
              <div>
                <h3 className="text-sm uppercase text-gray-400 mb-2 underline">
                  Video Details
                </h3>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-400">Video ID:</span> {selectedVideo.video_id}</p>
                  <p><span className="text-gray-400">Duration:</span> {Math.round(selectedVideo.duration / 60)} mins</p>
                  <p><span className="text-gray-400">Start Time:</span> {new Date(selectedVideo.start_timestamp).toLocaleString()}</p>
                  <p><span className="text-gray-400">End Time:</span> {new Date(selectedVideo.end_timestamp).toLocaleString()}</p>
                  <p><span className="text-gray-400">Format:</span> {selectedVideo.format}</p>
                  <p><span className="text-gray-400">Resolution:</span> {selectedVideo.resolution}</p>
                </div>

                <br></br>
                <h3 className="text-sm uppercase text-gray-400 mb-2 underline">
                  Officer Route
                </h3>

                <div className="text-sm space-y-1">
                  <p><span className="text-gray-400">Start Lat:</span> {selectedVideo.start_lat}</p>
                  <p><span className="text-gray-400">Start Lon:</span> {selectedVideo.start_lon}</p>
                  <p><span className="text-gray-400">End Lat:</span> {selectedVideo.end_lat}</p>
                  <p><span className="text-gray-400">End Lon:</span> {selectedVideo.end_lon}</p>
                  <p><span className="text-gray-400">GPS Accuracy:</span> {selectedVideo.gps_accuracy}</p>
                </div>
              </div>

              <hr className="border-gray-700" />

              {/* OFFICER */}
              <div>
                <h3 className="text-sm uppercase text-gray-400 mb-2 underline">
                  Officer
                </h3>
                <div className="text-sm space-y-1">
                  <p>{selectedVideo.officer?.user.first_name} {selectedVideo.officer?.user.last_name}</p>
                  <p className="break-all font-mono text-xs text-gray-400">ID: {selectedVideo.officer?.officer_id ?? "N/A"}</p>
                  <p className="text-gray-400">{selectedVideo.officer?.user.email}</p>
                </div>
              </div>

              <hr className="border-gray-700" />

              {/* CAMERA */}
              <div>
                <h3 className="text-sm uppercase text-gray-400 mb-2 underline">
                  Camera
                </h3>
                <div className="text-sm space-y-1">
                  <p>Serial: {selectedVideo.camera?.serial_number}</p>
                  <p>Model: {selectedVideo.camera?.model}</p>
                </div>
              </div>

              <hr className="border-gray-700" />

              {/* SECURITY NOTICE */}
              <div className="bg-gray-950 border border-red-700 p-3 text-xs text-red-400">
                ⚠ This footage is classified as official law enforcement evidence.
                Unauthorized access, duplication, or distribution is prohibited.
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

    {/* MODAL FOR VIDEO UNLOCK */}
    </div>
  );
};

export default BranchModal;

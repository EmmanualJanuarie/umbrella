/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { type Branch, type Camera, type Session, type Video } from "../../data/types";
import { UserName } from "../../components/helpers/UserName";
import { ConvertTime } from "../../components/helpers/ConvertTime";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export default function Branches() {
  const [branchList, setBranchList] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branchSessions, setBranchSessions] = useState<Session[]>([]);
  const [branchVideos, setBranchVideos] = useState<Video[]>([]);
  const [sessionCameras, setSessionCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchesModal, setShowBranchesModal] = useState(false);
  const branchesRequestRef = useRef<Promise<Branch[]> | null>(null);
  const [filters, setFilters] = useState({
    officerId: "",
    sessionDateFrom: "",
    sessionDateTo: "",
    videoUploaded: "",
    tamperFlag: "",
    cameraStatus: "",
  });
  //TRACKING ACCESS LOGS
  useEffect(() => {
    // When component mounts → user entered the branches
    const logEnter = async () => {
      try {
        return;
      } catch (err) {
        console.error("Failed to log branches entry", err);
      }
    };

    // When component unmounts → user leaves the branches
    const logExit = async () => {
      try {
        return;
      } catch (err) {
        console.error("Failed to log branches exit", err);
      }
    };

    logEnter();

    return () => {
      logExit(); // this runs when user navigates away or closes the component
    };
  }, []);

  // ================================
  // FETCH BRANCHES
  // ================================
  const refreshBranches = useCallback(async (showLoading = true) => {
    if (branchesRequestRef.current) return branchesRequestRef.current;

    const request = (async () => {
    try {
      if (showLoading) setLoading(true);
      const res = await axios.get(`${API_URL}/branches`, {
        withCredentials: true,
        params: { search: branchSearch },
      });
      const nextBranches = Array.isArray(res.data) ? res.data : [];
      setBranchList(nextBranches);
      return nextBranches;
    } catch (err) {
      console.error("Failed to fetch branches", err);
      return [];
    } finally {
      if (showLoading) setLoading(false);
      branchesRequestRef.current = null;
    }
    })();

    branchesRequestRef.current = request;
    return request;
  }, [branchSearch]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      await refreshBranches(true);
    }, 350);

    return () => clearTimeout(timer);
  }, [branchSearch, refreshBranches]);

  // ================================
  // FETCH DETAILS WHEN SELECTED
  // ================================
  const handleSelectBranch = (branch: Branch) => {
  setSelectedBranch(branch);
  setLoadingDetails(true);

  axios
    .get(`${API_URL}/branches/${branch.branch_id}`, { withCredentials: true })
    .then((res) => {
      const branchData = res.data;
      setSelectedBranch(branchData);

      const sessions = branchData.Session || [];
      setBranchSessions(sessions);

      const videos = sessions.flatMap((s: any) => s.videos || []);
      setBranchVideos(videos);

     const cameras = branchData.camera || [];
      setSessionCameras(cameras);
    })
    .catch((err) => {
      console.error("Failed to fetch branch details", err);
      // optionally reset data if failed
      setBranchSessions([]);
      setBranchVideos([]);
    })
    .finally(() => {
      setLoadingDetails(false); //important!
    });
};

  const filteredSessions = branchSessions.filter((s) => {
    const sessionDate = new Date(s.start_time);

    if (filters.officerId && s.officer_id !== filters.officerId) return false;

    if (filters.sessionDateFrom &&
        sessionDate < new Date(filters.sessionDateFrom)) return false;

    if (filters.sessionDateTo &&
        sessionDate > new Date(filters.sessionDateTo)) return false;

    return true;
  });

  const filteredVideos = branchVideos.filter((v) => {

    if (filters.officerId) {
      const session = branchSessions.find(s => s.session_id === v.session_id);
      if (session?.officer_id !== filters.officerId) return false;
    }

    if (filters.videoUploaded &&
        v.uploaded.toString() !== filters.videoUploaded) return false;

    if (filters.tamperFlag &&
        v.tamper_flag.toString() !== filters.tamperFlag) return false;

    return true;
  });

const filteredCameras = sessionCameras.filter((c) => {
  if (filters.cameraStatus &&
      c.status !== filters.cameraStatus) return false;

  if (filters.officerId &&
      c.officer?.officer_id !== filters.officerId) return false;

  return true;
});

  return (
    <div className="h-full bg-body-black text-white border border-gray-700">
      {/* LEFT PANE */}
      <div className="w-full border-r border-gray-700 overflow-y-auto">
        <div className="p-4 flex justify-between items-center border-b border-gray-700">
          <span className="font-semibold">Branches</span>
          <div className="flex gap-2">
            <button
              className="px-2 py-1 border border-white/10 text-white text-sm hover:bg-white/10"
              onClick={() => void refreshBranches()}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* BRANCHES SEARCHBAR */}
        <div className="p-2 border-b border-gray-700">
          <input
            type="text"
            placeholder="Search branches..."
            value={branchSearch}
            onChange={(e) => setBranchSearch(e.target.value)}
            className="w-full p-2 bg-gray-900 border border-gray-600 text-white text-sm"
          />
        </div>

        {loading ? (
          <div className="p-4 text-gray-400">Loading...</div>
        ) : (
          branchList.map((branch) => (
            <div
              key={branch.branch_id}
              onClick={async () => {
                handleSelectBranch(branch)
                setShowBranchesModal(true);
              
                // Log the branch click
                try {
                  await axios.post(
                    `${API_URL}/branches/access/branch/click`,
                    {
                      branch_id: branch.branch_id, // clicked branch
                    },
                    { withCredentials: true }
                  );
                } catch (err) {
                  console.error("Failed to log branch click", err);
                }
              }}
              className={`p-4 cursor-pointer border-b border-gray-800 hover:bg-gray-800 ${
                selectedBranch?.branch_id === branch.branch_id ? "bg-gray-900" : ""
              }`}
            >
              <p className="font-medium">{branch.name}</p>
            </div>
          ))
        )}
      </div>
      <div className="p-3 text-sm text-gray-400 text-center">
        {!showBranchesModal && (
          <p>Select a video to view operational data.</p>
        )}
      </div>

      <div>
        {showBranchesModal && selectedBranch && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center">

            <div className="bg-gray-900 border border-gray-700 w-[95%] max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">

              {/* HEADER */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-white">
                    Branch Operations Overview
                  </h2>
                  <p className="text-sm text-gray-400">
                    {selectedBranch.name}
                  </p>
                </div>

                <button
                  onClick={() => setShowBranchesModal(false)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>

              {/* BODY */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* FILTER BAR */}
                <div className="border border-gray-700 p-4 bg-gray-900">
                  <h3 className="font-semibold mb-4">Operational Filters</h3>

                  <div className="grid grid-cols-4 gap-4">

                    <select
                      className="p-2 bg-gray-800 border border-gray-600"
                      value={filters.officerId}
                      onChange={(e) =>
                        setFilters({ ...filters, officerId: e.target.value })
                      }
                    >
                      <option value="">All Officers</option>
                      {[...new Map(
                        branchSessions.map((s) => [
                          s.officer_id,
                          `${s.officer?.user?.first_name ?? ""} ${s.officer?.user?.last_name ?? ""}`
                        ])
                      )].map(([id, name]) => (
                        <option key={id} value={id}>
                          {name.trim() || id}
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      className="p-2 bg-gray-800 border border-gray-600"
                      value={filters.sessionDateFrom}
                      onChange={(e) =>
                        setFilters({ ...filters, sessionDateFrom: e.target.value })
                      }
                    />

                    <input
                      type="date"
                      className="p-2 bg-gray-800 border border-gray-600"
                      value={filters.sessionDateTo}
                      onChange={(e) =>
                        setFilters({ ...filters, sessionDateTo: e.target.value })
                      }
                    />

                    <select
                      className="p-2 bg-gray-800 border border-gray-600"
                      value={filters.cameraStatus}
                      onChange={(e) =>
                        setFilters({ ...filters, cameraStatus: e.target.value })
                      }
                    >
                      <option value="">All Camera Status</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>

                    <select
                      className="p-2 bg-gray-800 border border-gray-600"
                      value={filters.videoUploaded}
                      onChange={(e) =>
                        setFilters({ ...filters, videoUploaded: e.target.value })
                      }
                    >
                      <option value="">All Upload Status</option>
                      <option value="true">Uploaded</option>
                      <option value="false">Not Uploaded</option>
                    </select>

                    <select
                      className="p-2 bg-gray-800 border border-gray-600"
                      value={filters.tamperFlag}
                      onChange={(e) =>
                        setFilters({ ...filters, tamperFlag: e.target.value })
                      }
                    >
                      <option value="">All Tamper Status</option>
                      <option value="true">Tampered</option>
                      <option value="false">Not Tampered</option>
                    </select>

                  </div>
                </div>

                {/* BRANCH OVERVIEW */}
                <section className="border border-white/10 bg-black/25 p-4 text-left">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-red-300">Branch Operations</p>
                      <h3 className="mt-1 text-xl font-semibold">{selectedBranch.name}</h3>
                      <p className="mt-1 text-sm text-white/50">{selectedBranch.location || "No location recorded"}</p>
                    </div>
                    <button
                      onClick={() => handleSelectBranch(selectedBranch)}
                      className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                    >
                      Refresh Details
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      ["Sessions", branchSessions.length],
                      ["Videos", branchVideos.length],
                      ["Cameras", sessionCameras.length],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase text-white/40">{label}</p>
                        <p className="mt-1 text-2xl font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {loadingDetails ? (
                  <div className="text-gray-400">Loading details...</div>
                ) : (
                  <div className="space-y-6">

                    {/* SESSIONS */}
                    <section className="border border-gray-700 p-4">
                      <h3 className="font-semibold underline mb-2">
                        Sessions ({branchSessions.length})
                      </h3>

                      {branchSessions.length === 0 ? (
                        <p className="text-gray-400">No sessions recorded</p>
                      ) : (
                        <table className="w-full text-sm border border-gray-600">
                          <thead className="bg-gray-900">
                            <tr>
                              <th className="p-2">Officer Name</th>
                              <th className="p-2">Start Time</th>
                              <th className="p-2">End Time</th>
                              <th className="p-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSessions.map((s) => (
                              <tr key={s.session_id} className="border-t border-gray-800">
                                <td className="p-2"><UserName userId={s.user_id} /></td>
                                <td className="p-2">{`${new Date(s.start_time).toDateString()}, ${new Date(s.start_time).toLocaleTimeString()}`}</td>
                                <td className="p-2">{`${new Date(s.end_time).toDateString()}, ${new Date(s.end_time).toLocaleTimeString()}`}</td>
                                <td className="p-2">{s.notes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>

                    {/* VIDEOS */}
                    <section className="border border-gray-700 p-4 overflow-x-auto">
                      <h3 className="font-semibold underline mb-2">
                        Videos ({branchVideos.length})
                      </h3>

                      {branchVideos.length === 0 ? (
                        <p className="text-gray-400">No videos recorded</p>
                      ) : (
                        <table className="w-full text-sm border border-gray-600">
                          <thead className="bg-gray-900">
                            <tr>
                              <th className="p-2">Officer Name</th>
                              <th className="p-2">Coordinates</th>
                              <th className="p-2">Duration</th>
                              <th className="p-2">Uploaded</th>
                              <th className="p-2">Tampered</th>
                              <th className="p-2">Format</th>
                              <th className="p-2">Start of Recording</th>
                              <th className="p-2">End of Recording</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredVideos.map((v) => (
                              <tr key={v.video_id} className="border-t border-gray-800">
                                <td className="p-2">{<>
                                  <UserName userId={v.user_id}/>
                                </>}</td>
                                <td className="p-2">{`${v.start_lat}, ${v.end_lat}, ${v.start_lon}, ${v.end_lon}`}</td>
                                <td className="p-2">{
                                  <>
                                    <ConvertTime seconds={v.duration}/>
                                  </>
                                  }</td>
                                <td className="p-2">{v.uploaded ? "Yes" : "No"}</td>
                                <td className="p-2">{v.tamper_flag ? "Yes" : "No"}</td>
                                <td className="p-2">{v.format}</td>
                                <td className="p-2">{`${new Date(v.start_timestamp).toDateString()}, ${new Date(v.start_timestamp).toLocaleTimeString()}`}</td>
                                <td className="p-2">{`${new Date(v.end_timestamp).toDateString()}, ${new Date(v.end_timestamp).toLocaleTimeString()}`}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>

                    {/* Cameras */}
                    <section className="border border-gray-700 p-4">
                      <h3 className="font-semibold underline mb-2">
                        Cameras ({sessionCameras.length})
                      </h3>
                      {sessionCameras.length === 0 ? (
                        <p className="text-gray-400">No cameras recorded</p>
                      ) : (
                        <table className="w-full text-sm border border-gray-600">
                          <thead className="bg-gray-900">
                            <tr>
                              <th className="p-2">Assigned Officer's Name</th>
                              <th className="p-2">Assigned by (BTO)</th>
                              <th className="p-2">Model</th>
                              <th className="p-2">Type</th>
                              <th className="p-2">Purchased Date</th>
                              <th className="p-2">Serial Number</th>
                              <th className="p-2">Status</th>
                              
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCameras.map((c) => (
                              <tr key={c.camera_id} className="border-t border-gray-800">
                                <td className="p-2">{
                                  <>
                                  {c.officer ? `${c.officer.user.first_name} ${c.officer.user.last_name}` : 'No Assigned Officer'}
          
                                  </>}
                                </td>
                                <td className="p-2">{
                                  <>
                                    <UserName userId={c.assigned_to_officer_by}/>
                                  </>}
                                </td>
                                <td className="p-2">{c.model}</td>
                                <td className="p-2">{c.type}</td>
                                <td className="p-2">
                                    {c.purchase_date
                                      ? `${new Date(c.purchase_date).toDateString()}, ${new Date(
                                          c.purchase_date
                                        ).toLocaleTimeString()}`
                                      : "N/A"
                                    }
                                </td>
                                <td className="p-2">{c.serial_number}</td>
                                <td style={{ color:
                                        c.status === 'ACTIVE' ? '#22c55e' :
                                        c.status === 'INACTIVE' ? '#FF9800' : '#4b5563'
                                      }}>{c.status}
                                  </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>

                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}

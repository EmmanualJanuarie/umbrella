import { useCallback, useDeferredValue, useEffect, useState } from "react";
import axios from "axios";
import {
  type Camera,
  type Branch,
  type Officer,
  type User,
  type Shift,
  type Session,
} from "../../data/types";
import { UserName } from "../../components/helpers/UserName";

const runAction = async (action: () => Promise<unknown>, options?: unknown) => {
  void options;
  await action();
};

  type CameraDetails = {
  officer?: Officer & { user: User };
  shifts: Shift[];
  sessions: Session[];
};

export default function Cameras() {
  const [activeTab, setActiveTab] = useState<"UNASSIGNED" | "ASSIGNED">("UNASSIGNED");
  const [assigningCameraId, setAssigningCameraId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [cameraDetails, setCameraDetails] = useState<CameraDetails | null>(null);
  const [search, setSearch] = useState("");

    const [isSearching, setIsSearching] = useState(false);
  
    const deferredSearch = useDeferredValue(search);


  const [showCameraModal, setShowCameraModal] = useState(false);

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const refreshCameras = async () => {
  try {
    const res = await axios.get(`${API_URL}/camera`, {
      withCredentials: true,
      params: {
        search: deferredSearch,
        type: activeTab,
      },
    });

    setCameras(res.data);
  } catch (err) {
    console.error("Failed to refresh cameras:", err);
  }
};

  // ======================================================
  // FETCH DATA (role-aware via backend)
  // ======================================================
  // Fetch cameras once (org_owner scope)
  const fetchCameras = useCallback(
    async (searchValue: string, tab: "UNASSIGNED" | "ASSIGNED") => {
      try {
        if (cameras.length === 0) {
          setLoading(true);
        } else {
          setIsSearching(true);
        }

        const res = await axios.get(`${API_URL}/camera`, {
          withCredentials: true,
          params: { search: searchValue, type: tab },
        });

        setCameras(res.data);
      } catch (err) {
        console.error("Failed to fetch cameras:", err);
      } finally {
        setLoading(false);
        setIsSearching(false);
      }
    },
    [API_URL, cameras.length]
  );

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await axios.get(`${API_URL}/branches`, { withCredentials: true });
        setBranches(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch branches:", err);
        setBranches([]);
      }
    };

    void fetchBranches();
  }, [API_URL]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCameras(deferredSearch, activeTab);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activeTab, deferredSearch, fetchCameras]);

  // ======================================================
  // HELPERS
  // ======================================================
  const getBranch = (branchId?: string): Branch | undefined =>
    branches.find((b) => b.branch_id === branchId);


  // ======================================================
  // ASSIGN CAMERA TO BRANCH (ORG_OWNER)
  // ======================================================
  const handleAssign = async (camera: Camera) => {
   runAction(async () => {
     if (!selectedBranch) return;

    try {
      await axios.post(`${API_URL}/camera/allocate/branch`, {
        camera_id: camera.camera_id,
        branch_id: selectedBranch,
      }, {withCredentials: true, });

      const now = new Date().toISOString();
      setCameras((prev) =>
        prev.map((c) =>
          c.camera_id === camera.camera_id
            ? { ...c, branch_id: selectedBranch, assigned_to_branch_at: now  }
            : c
        )
      );
      await refreshCameras();

      setAssigningCameraId(null);
      setSelectedBranch("");
    } catch (err) {
      console.error("Failed to assign camera", err);
    }
   }, {});
  };

  // ======================================================
  // UI
  // ======================================================
  return (
    <div className="flex h-full flex-col border border-white/10 bg-body-black text-white">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/25 p-4">
        <div>
          <h2 className="text-lg font-semibold">Camera Inventory</h2>
          <p className="mt-1 text-sm text-white/50">
            {loading ? "Loading camera inventory..." : "Assign cameras to branches and inspect operational history."}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void refreshCameras()}
            disabled={isSearching}
            className="border border-white/10 px-4 py-2 text-sm text-white/75 hover:bg-white/10 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={() => setActiveTab("UNASSIGNED")}
            className={`border border-white/10 px-4 py-2 text-sm ${
              activeTab === "UNASSIGNED" ? "bg-red-600/20 text-white" : "bg-white/[0.03] text-white/70"
            }`}
          >
            Unassigned
          </button>
          <button
            onClick={() => setActiveTab("ASSIGNED")}
            className={`border border-white/10 px-4 py-2 text-sm ${
              activeTab === "ASSIGNED" ? "bg-red-600/20 text-white" : "bg-white/[0.03] text-white/70"
            }`}
          >
            Assigned
          </button>
        </div>
      </div>

      <div className="p-4">
        <input
          type="text"
          placeholder="Search cameras..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-white/10 bg-gray-950 p-2 text-white"
        />
      </div>



      {/* TABLE */}
        <div className="relative min-h-0 flex-1 overflow-auto border-t border-white/10">
        {isSearching && (
          <div className="absolute right-2 top-2 z-10 border border-white/10 bg-gray-900 px-2 py-1 text-xs text-gray-400">
            Updating...
          </div>
        )}
        
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="sticky top-0 bg-gray-950 text-xs uppercase text-white/45">
            <tr>
              <th className="p-3">Serial</th>
              <th className="p-3">Model</th>
              <th className="p-3">Status</th>
              <th className="p-3">Organization Assignment</th>
              <th className="p-3">Branch Assignment</th>
              <th className="p-3">Officer Assignment</th>
              <th className="p-3">Officer Name</th>
              <th className="p-3">Purchase Date</th>
              {activeTab === "UNASSIGNED" && <th className="p-3">Assign</th>}
              {activeTab === "ASSIGNED" && <th className="p-3">Branch</th>}
            </tr>
          </thead>

          <tbody>
            {cameras.map((camera) => {
              const branch = getBranch(camera.branch_id);

              return (
                <tr
                  key={camera.camera_id}
                  onClick={async () => {
                    setSelectedCamera(camera);
                    setShowCameraModal(true);

                    try {
                      const res = await axios.get(
                        `${API_URL}/camera/${camera.camera_id}/details`,
                        { withCredentials: true }
                      );
                      setCameraDetails(res.data);
                    } catch (err) {
                      console.error("Failed to fetch camera details", err);
                    }

                     // Log the camera click
                    try {
                      await axios.post(
                        `${API_URL}/camera/access/camera/click`,
                        {
                          camera_id: camera.camera_id, // clicked camera
                        },
                        { withCredentials: true }
                      );
                    } catch (err) {
                      console.error("Failed to log camera click", err);
                    }
                    
                  }}
                  className={`cursor-pointer border-b border-white/10 hover:bg-white/10 ${
                    selectedCamera?.camera_id === camera.camera_id
                      ? "bg-red-600/10"
                      : ""
                  }`}
                >
                  <td className="p-3 font-mono text-xs">{camera.serial_number}</td>
                  <td className="p-3">{camera.model}</td>
                  <td className="p-3"><span className={`border px-2 py-1 text-xs ${
                        camera.status === 'ACTIVE' ? 'border-green-500/30 bg-green-500/10 text-green-200' :
                        camera.status === 'INACTIVE' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200' : 'border-white/10 bg-white/5 text-white/60'
                      }`}>{camera.status}</span>
                  </td>

                  <td className="p-3 text-white/70">{camera.assigned_to_org_at
                      ? `${new Date(camera.assigned_to_org_at).toDateString()},${new Date(camera.assigned_to_org_at).toLocaleTimeString()} `
                      : 'N/A'
                    }
                    <p className="mt-1 text-xs text-white/40">By <UserName userId={camera.assigned_to_org_by}/></p>
                  </td>

                  <td className="p-3 text-white/70">{camera.assigned_to_branch_at
                      ? `${new Date(camera.assigned_to_branch_at).toDateString()},${new Date(camera.assigned_to_branch_at).toLocaleTimeString()} `
                      : 'N/A'
                    }
                    <p className="mt-1 text-xs text-white/40">By <UserName userId={camera.assigned_to_branch_by}/></p>
                  </td>

                  <td className="p-3 text-white/70">{camera.assigned_to_officer_at
                      ? `${new Date(camera.assigned_to_officer_at).toDateString()},${new Date(camera.assigned_to_officer_at).toLocaleTimeString()} `
                      : 'N/A'
                    }
                    <p className="mt-1 text-xs text-white/40">By <UserName userId={camera.assigned_to_officer_by}/></p>
                  </td>

                  {/* removed duplicate assigner-only columns */}
                  {false && <td className="p-3">
                    <UserName userId={camera.assigned_to_org_by}/>
                  </td>}

                  <td className="p-3">
                    {camera.officer ? `${camera.officer.user.first_name} ${camera.officer.user.last_name}` : 'No Assigned Officer'}
                  </td>

                   <td className="p-3">{camera.purchase_date
                      ? `${new Date(camera.purchase_date).toDateString()},${new Date(camera.purchase_date).toLocaleTimeString()} `
                      : 'N/A'
                    }
                  </td>
                  {/* FIGURE OUT HOW TO STAMP THE ASSIGNED TO ORG DATE, AND PURCHASE DATE, THEN LATER THE SAME FOR BRANCH */}

                  {/* ASSIGN */}
                  {activeTab === "UNASSIGNED" && (
                    <td className="p-3"
                    onClick={(e) => e.stopPropagation()}>
                      {assigningCameraId === camera.camera_id ? (
                        <div className="flex gap-2">
                          <select
                            value={selectedBranch}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>{
                              e.stopPropagation();
                              setSelectedBranch(e.target.value)
                            }

                            }
                            className="bg-gray-900 border border-gray-700 p-1 text-xs"
                          >
                            <option value="">Select Branch</option>
                            {branches.map((b) => (
                              <option
                                key={b.branch_id}
                                value={b.branch_id}
                              >
                                {b.name}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAssign(camera);
                            }}
                            className="px-3 py-1 bg-red-700 hover:bg-red-600 text-xs"
                          >
                            ASSIGN
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigningCameraId(camera.camera_id);
                          }}
                          className="underline hover:no-underline"
                        >
                          ASSIGN
                        </button>
                      )}
                    </td>
                  )}

                  {/* ASSIGNED */}
                  {activeTab === "ASSIGNED" && (
                    <td className="p-3 text-gray-300">
                      {branch?.name ?? "N/A"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 text-sm text-gray-400 text-center">
        {!showCameraModal && (
          <p>Click a camera field to view additional details.</p>
        )}
      </div>

      {/* INFO PANEL */}
      {showCameraModal && selectedCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.18em] text-red-300">Camera Record</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{selectedCamera.serial_number}</h2>
                <p className="mt-1 text-sm text-white/55">{selectedCamera.model} / {selectedCamera.type}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  {selectedCamera.status}
                </span>
                <button onClick={() => setShowCameraModal(false)} className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Device Identity</h3>
                  <dl className="mt-4 space-y-3">
                    {[
                      ["Serial number", selectedCamera.serial_number ?? "N/A"],
                      ["Model", selectedCamera.model ?? "N/A"],
                      ["Type", selectedCamera.type ?? "N/A"],
                      ["Purchase date", selectedCamera.purchase_date ? new Date(selectedCamera.purchase_date).toLocaleString() : "N/A"],
                    ].map(([label, value]) => (
                      <div key={label} className="border-b border-white/10 pb-3">
                        <dt className="text-xs uppercase text-white/40">{label}</dt>
                        <dd className="mt-1 break-words text-sm text-white/85">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Assignment</h3>
                  <dl className="mt-4 space-y-3">
                    <div className="border-b border-white/10 pb-3">
                      <dt className="text-xs uppercase text-white/40">Branch</dt>
                      <dd className="mt-1 text-sm text-white/85">{getBranch(selectedCamera.branch_id)?.name ?? "Not assigned"}</dd>
                    </div>
                    <div className="border-b border-white/10 pb-3">
                      <dt className="text-xs uppercase text-white/40">Branch location</dt>
                      <dd className="mt-1 text-sm text-white/85">{getBranch(selectedCamera.branch_id)?.location ?? "N/A"}</dd>
                    </div>
                    <div className="border-b border-white/10 pb-3">
                      <dt className="text-xs uppercase text-white/40">Officer</dt>
                      <dd className="mt-1 text-sm text-white/85">
                        {cameraDetails?.officer
                          ? `${cameraDetails.officer.user.first_name ?? ""} ${cameraDetails.officer.user.last_name ?? ""}`.trim()
                          : "No officer assigned"}
                      </dd>
                    </div>
                    <div className="border-b border-white/10 pb-3">
                      <dt className="text-xs uppercase text-white/40">Officer ID</dt>
                      <dd className="mt-1 break-all font-mono text-xs text-white/70">{cameraDetails?.officer?.officer_id ?? "N/A"}</dd>
                    </div>
                    <div className="border-b border-white/10 pb-3">
                      <dt className="text-xs uppercase text-white/40">Badge / department</dt>
                      <dd className="mt-1 text-sm text-white/85">
                        {cameraDetails?.officer ? `${cameraDetails.officer.badge_number ?? "No badge"} / ${cameraDetails.officer.department ?? "No department"}` : "N/A"}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {[
                  ["Shifts", cameraDetails?.shifts?.length ?? 0],
                  ["Sessions", cameraDetails?.sessions?.length ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="border border-white/10 bg-black/25 p-4">
                    <p className="text-xs uppercase text-white/40">{label}</p>
                    <p className="mt-1 text-2xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              <section className="mt-4 border border-white/10 bg-black/25 p-4">
                <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Recent Operational Activity</h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="max-h-64 overflow-y-auto text-sm text-white/70">
                    <h4 className="mb-2 font-semibold text-white">Shifts</h4>
                    {cameraDetails?.shifts?.length ? cameraDetails.shifts.map((s) => (
                      <div key={s.shift_id} className="mb-3 border-b border-white/10 pb-2">
                        <p>{s.status}</p>
                        <p className="text-xs text-white/45">{s.start_time ? new Date(s.start_time).toLocaleString() : "No start"}</p>
                      </div>
                    )) : <p className="text-white/45">No shifts</p>}
                  </div>
                  <div className="max-h-64 overflow-y-auto text-sm text-white/70">
                    <h4 className="mb-2 font-semibold text-white">Sessions</h4>
                    {cameraDetails?.sessions?.length ? cameraDetails.sessions.map((s) => (
                      <div key={s.session_id} className="mb-3 border-b border-white/10 pb-2">
                        <p>{s.status}</p>
                        <p className="text-xs text-white/45">{s.start_time ? new Date(s.start_time).toLocaleString() : "No start"}</p>
                      </div>
                    )) : <p className="text-white/45">No sessions</p>}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {showCameraModal && selectedCamera && false && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 w-[90%] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

            {/* HEADER */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
              <h2 className="text-lg font-semibold text-white">Camera Details</h2>
              <button
                onClick={() => setShowCameraModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="p-4 overflow-y-auto text-sm max-h-[80vh] space-y-4">

              {/* Camera Info */}
              <div className="text-left">
                <h3 className="font-semibold underline">Camera Information</h3>
                <p><strong>Serial:</strong> {selectedCamera?.serial_number}</p>
                <p><strong>Model:</strong> {selectedCamera?.model}</p>
                <p><strong>Status:</strong> {selectedCamera?.status}</p>
              </div>

              {/* Branch Info */}
              <div className="text-left">
                <h4 className="font-semibold underline mt-3">Branch Information</h4>
                {getBranch(selectedCamera?.branch_id) ? (
                  <>
                    <p><strong>Name:</strong> {getBranch(selectedCamera?.branch_id)?.name}</p>
                    <p><strong>Location:</strong> {getBranch(selectedCamera?.branch_id)?.location}</p>
                  </>
                ) : <p className="text-gray-400">Camera not assigned</p>}
              </div>

              {/* Assigned Officer */}
              <div className="text-left">
                <h4 className="font-semibold underline mt-3">Assigned Officer Information</h4>
                {cameraDetails?.officer ? (
                  <>
                    <p><strong>Name:</strong> {cameraDetails?.officer?.user.first_name ?? 'No'} {cameraDetails?.officer?.user.last_name ?? 'Name'}</p>
                    <p><strong>Email:</strong> {cameraDetails?.officer?.user.email ?? 'No Email'}</p>
                    <p><strong>Badge Number:</strong> {cameraDetails?.officer?.badge_number ?? "No Badge Number"}</p>
                    <p><strong>Department:</strong> {cameraDetails?.officer?.department ?? 'No Department'}</p>
                  </>
                ) : <p className="text-gray-400">No officer assigned</p>}
              </div>

              {/* Shifts */}
              <div className="text-left">
                <h4 className="font-semibold underline mt-3">Shift Schedule</h4>
                {cameraDetails?.shifts?.length ? (
                  cameraDetails?.shifts.map((s) => (
                    <div key={s.shift_id} className="mb-4 space-y-1">
                      <p><strong>Scheduled Shift:</strong> {s.start_time ? new Date(s.start_time).toDateString() : "No Start Date"} → {s.end_time ? new Date(s.end_time).toDateString() : "No End Date"}</p>
                      <p><strong>Shift Start Time:</strong> {s.start_time ? new Date(s.start_time).toLocaleTimeString() : "No Start Time"}</p>
                      <p><strong>Shift End Time:</strong> {s.end_time ? new Date(s.end_time).toLocaleTimeString() : "No End Time"}</p>
                      <p><strong>Shift Status:</strong> {s.status}</p>
                    </div>
                  ))
                ) : <p className="text-gray-400">No shifts scheduled</p>}
              </div>

              {/* Sessions */}
              <div className="text-left">
                <h4 className="font-semibold underline mt-3">Sessions</h4>
                {cameraDetails?.sessions?.length ? (
                  cameraDetails?.sessions.map((s) => (
                    <div key={s.session_id} className="mb-4 space-y-1">
                      <p><strong>Session Start Time:</strong> {new Date(s.start_time).toLocaleString()}</p>
                      <p><strong>Session End Time:</strong> {new Date(s.end_time).toLocaleString()}</p>
                      <p><strong>Session Status:</strong> {s.status}</p>
                      <p><strong>Officer Notes:</strong> {s.notes}</p>
                      <p><strong>Session Co-ordinates:</strong> {`${s.start_lat}, ${s.end_lat}, ${s.start_lon}, ${s.end_lon}`}</p>
                    </div>
                  ))
                ) : <p className="text-gray-400">No sessions</p>}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

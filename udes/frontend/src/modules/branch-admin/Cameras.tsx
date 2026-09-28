import { useDeferredValue, useEffect, useState } from "react";
import axios from "axios";
import { type Camera, type Officer } from "../../data/types";
import { UserName } from "../../components/helpers/UserName";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export default function Cameras() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [assignToOfficer, setAssignToOfficer] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [showCamerasModal, setShowCamerasModal] = useState(false);

  const refreshCameras = async (searchValue = deferredSearch) => {
    try {
      setLoading(true);
      const [cameraRes, officerRes] = await Promise.all([
        axios.get(`${API_URL}/camera`, {
          withCredentials: true,
          params: { search: searchValue },
        }),
        axios.get(`${API_URL}/officer`, {
          withCredentials: true,
        }),
      ]);

      setCameras(Array.isArray(cameraRes.data) ? cameraRes.data : []);
      setOfficers(Array.isArray(officerRes.data) ? officerRes.data : []);
    } catch (err) {
      console.error("Failed to refresh branch cameras", err);
      setCameras([]);
      setOfficers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshCameras(deferredSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [deferredSearch]);

  const getOfficerName = (officerId?: string | null) => {
    const officer = officers.find((item) => item.officer_id === officerId);
    return officer?.user
      ? `${officer.user.first_name} ${officer.user.last_name}`
      : "Unassigned";
  };

  const openCamera = async (camera: Camera) => {
    setSelectedCamera(camera);
    setAssignToOfficer("");
    setReassignReason("");
    setAssignError(null);
    setShowCamerasModal(true);

    try {
      await axios.post(
        `${API_URL}/camera/access/camera/click`,
        { camera_id: camera.camera_id },
        { withCredentials: true },
      );
    } catch (err) {
      console.error("Failed to log camera click", err);
    }
  };

  const handleAssign = async () => {
    if (!selectedCamera || !assignToOfficer) return;
    const isReassignment = Boolean(selectedCamera.assigned_to);

    if (isReassignment && !reassignReason.trim()) {
      setAssignError("A reassignment reason is required.");
      return;
    }

    try {
      setAssigning(true);
      setAssignError(null);

      await axios.post(
        `${API_URL}/camera/assign/officer`,
        {
          camera_id: selectedCamera.camera_id,
          officer_id: assignToOfficer,
          reason: isReassignment ? reassignReason.trim() : undefined,
        },
        { withCredentials: true },
      );

      const res = await axios.get(`${API_URL}/camera/${selectedCamera.camera_id}`, {
        withCredentials: true,
      });

      const updatedCamera: Camera = res.data;
      setCameras((prev) =>
        prev.map((camera) =>
          camera.camera_id === updatedCamera.camera_id ? updatedCamera : camera,
        ),
      );
      setSelectedCamera(updatedCamera);
      setAssignToOfficer("");
      setReassignReason("");
      await refreshCameras(deferredSearch);
    } catch (err) {
      console.error("Failed to assign camera", err);
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to assign camera"
        : "Failed to assign camera";
      setAssignError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setAssigning(false);
    }
  };

  const assignedCount = cameras.filter((camera) => camera.assigned_to).length;
  const unassignedCount = cameras.length - assignedCount;
  const assignedOfficerIds = new Set(cameras.map((camera) => camera.assigned_to).filter(Boolean));
  const availableOfficers = officers.filter((officer) => !assignedOfficerIds.has(officer.officer_id));

  return (
    <div className="flex h-full flex-col border border-white/10 bg-body-black text-white">
      <div className="border-b border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Camera Inventory</h2>
            <p className="text-sm text-white/50">
              {assignedCount} assigned / {unassignedCount} unassigned cameras
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshCameras(deferredSearch)}
              className="border border-white/10 bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:border-red-500/60"
            >
              Refresh
            </button>
            <input
              placeholder="Search serial number or model..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-72 border border-white/10 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-red-600"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-950 text-xs uppercase text-white/45">
            <tr>
              <th className="p-3">Serial</th>
              <th className="p-3">Model</th>
              <th className="p-3">Status</th>
              <th className="p-3">Assigned Officer</th>
              <th className="p-3">Assigned At</th>
              <th className="p-3">Assigned By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-white/45">
                  Loading cameras...
                </td>
              </tr>
            ) : cameras.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-white/45">
                  No cameras found
                </td>
              </tr>
            ) : (
              cameras.map((camera) => (
                <tr
                  key={camera.camera_id}
                  onClick={() => void openCamera(camera)}
                  className={`cursor-pointer border-t border-white/10 hover:bg-white/[0.04] ${
                    selectedCamera?.camera_id === camera.camera_id ? "bg-red-950/20" : ""
                  }`}
                >
                  <td className="p-3 font-mono text-xs">{camera.serial_number}</td>
                  <td className="p-3">{camera.model}</td>
                  <td className="p-3">
                    <span
                      className={`border px-2 py-1 text-xs ${
                        camera.status === "ACTIVE"
                          ? "border-green-500/40 bg-green-500/10 text-green-300"
                          : "border-white/10 bg-white/5 text-white/65"
                      }`}
                    >
                      {camera.status}
                    </span>
                  </td>
                  <td className="p-3">{getOfficerName(camera.assigned_to)}</td>
                  <td className="p-3">
                    {camera.assigned_to_officer_at
                      ? new Date(camera.assigned_to_officer_at).toLocaleString()
                      : "Not assigned"}
                  </td>
                  <td className="p-3">
                    {camera.assigned_to_officer_by ? (
                      <UserName userId={camera.assigned_to_officer_by} />
                    ) : (
                      "No assigner"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!showCamerasModal && (
        <div className="border-t border-white/10 p-3 text-center text-sm text-white/45">
          Select a camera row to view assignment details.
        </div>
      )}

      {showCamerasModal && selectedCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/30 p-5">
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.18em] text-red-300">Camera Record</p>
                <h2 className="mt-1 text-xl font-semibold">{selectedCamera.serial_number}</h2>
                <p className="text-sm text-white/50">{selectedCamera.model}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCamerasModal(false);
                  setSelectedCamera(null);
                }}
                className="border border-white/10 px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <section className="border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase text-white/40">Serial Number</p>
                  <p className="mt-2 font-mono text-sm">{selectedCamera.serial_number}</p>
                </section>
                <section className="border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase text-white/40">Model</p>
                  <p className="mt-2 text-sm">{selectedCamera.model}</p>
                </section>
                <section className="border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase text-white/40">Status</p>
                  <p className="mt-2 text-sm">{selectedCamera.status}</p>
                </section>
                <section className="border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase text-white/40">Assigned Officer</p>
                  <p className="mt-2 text-sm">{getOfficerName(selectedCamera.assigned_to)}</p>
                  <p className="mt-1 break-all font-mono text-xs text-white/45">ID: {selectedCamera.assigned_to ?? "N/A"}</p>
                </section>
                <section className="border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase text-white/40">Assigned At</p>
                  <p className="mt-2 text-sm">
                    {selectedCamera.assigned_to_officer_at
                      ? new Date(selectedCamera.assigned_to_officer_at).toLocaleString()
                      : "No timestamp"}
                  </p>
                </section>
                <section className="border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase text-white/40">Assigned By</p>
                  <div className="mt-2 text-sm">
                    {selectedCamera.assigned_to_officer_by ? (
                      <UserName userId={selectedCamera.assigned_to_officer_by} />
                    ) : (
                      "No assigner"
                    )}
                  </div>
                </section>
              </div>

              <section className="mt-5 border border-white/10 bg-black/25 p-4">
                <h3 className="font-semibold">
                  {selectedCamera.assigned_to ? "Reassign Officer" : "Assign to Officer"}
                </h3>
                <p className="mt-1 text-sm text-white/50">
                  Only officers available to this branch admin are listed.
                </p>
                {assignError && (
                  <div className="mt-3 border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-100">
                    {assignError}
                  </div>
                )}
                <select
                  className="mt-3 w-full border border-white/10 bg-gray-900 p-2 text-sm"
                  value={assignToOfficer}
                  onChange={(event) => setAssignToOfficer(event.target.value)}
                >
                  <option value="">Select Officer</option>
                  {availableOfficers.map((officer) => (
                    <option key={officer.officer_id} value={officer.officer_id}>
                      {officer.user.first_name} {officer.user.last_name} - {officer.officer_id}
                    </option>
                  ))}
                </select>
                {availableOfficers.length === 0 && (
                  <p className="mt-2 text-sm text-white/45">No unassigned officers are available.</p>
                )}

                {selectedCamera.assigned_to && (
                  <label className="mt-3 block text-sm">
                    <span className="text-white/65">Reassignment reason</span>
                    <textarea
                      value={reassignReason}
                      onChange={(event) => setReassignReason(event.target.value)}
                      className="mt-2 min-h-24 w-full border border-white/10 bg-gray-900 p-2 text-sm outline-none focus:border-red-600"
                      placeholder="Explain why this camera is being reassigned..."
                    />
                  </label>
                )}

                <button
                  type="button"
                  className="mt-3 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-gray-700"
                  disabled={!assignToOfficer || assigning || (Boolean(selectedCamera.assigned_to) && !reassignReason.trim())}
                  onClick={() => void handleAssign()}
                >
                  {assigning ? "Assigning..." : selectedCamera.assigned_to ? "Reassign Camera" : "Assign Camera"}
                </button>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

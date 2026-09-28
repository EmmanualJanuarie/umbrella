import { useState, useEffect, useCallback, useDeferredValue, useMemo } from "react";
import axios from "axios";
import { type Camera } from "../../data/types";

import AssignCameraModal from "../../components/modals/AssignCameraModel";
import { CameraFormModal } from "../../components/modals/CameraFormModal";
import { useActionDialog } from "../../components/modals/ActionDialog";

type InventoryTab = "UNASSIGNED" | "ASSIGNED";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const formatDateTime = (value?: string) => {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
};

const getStatusClass = (status: Camera["status"]) => {
  switch (status) {
    case "ACTIVE":
      return "border-green-500/40 bg-green-500/10 text-green-200";
    case "INACTIVE":
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-100";
    case "IN_STOCK":
      return "border-blue-500/40 bg-blue-500/10 text-blue-200";
    case "DAMAGED":
    case "LOST":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
};

export default function CameraInventory() {
  const [activeTab, setActiveTab] = useState<InventoryTab>("UNASSIGNED");
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formCamera, setFormCamera] = useState<Camera | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dialogElement, confirmAction } = useActionDialog();

  const deferredSearch = useDeferredValue(search);

  const fetchCameras = useCallback(
    async (searchValue: string) => {
      setRefreshing(true);
      setError(null);

      try {
        const res = await axios.get<Camera[]>(`${API_URL}/camera`, {
          withCredentials: true,
          params: { search: searchValue },
        });

        setCameras(res.data);
      } catch (err) {
        const message = axios.isAxiosError(err)
          ? err.response?.data?.message ?? "Failed to load cameras"
          : "Failed to load cameras";
        setError(Array.isArray(message) ? message.join(", ") : message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCameras(deferredSearch);
    }, 250);

    return () => clearTimeout(timer);
  }, [deferredSearch, fetchCameras]);

  useEffect(() => {
    const logInventoryAccess = async (action: "enter" | "exit") => {
      try {
        await axios.post(`${API_URL}/camera/access/inventory/${action}`, {}, { withCredentials: true });
      } catch {
        // Audit logging should never block the inventory screen.
      }
    };

    void logInventoryAccess("enter");

    return () => {
      void logInventoryAccess("exit");
    };
  }, []);

  const filteredCameras = useMemo(
    () =>
      cameras.filter((camera) =>
        activeTab === "ASSIGNED"
          ? Boolean(camera.assigned_to || camera.branch_id || camera.org_id)
          : !camera.assigned_to && !camera.branch_id && !camera.org_id,
      ),
    [activeTab, cameras],
  );

  const inventoryStats = useMemo(() => {
    const assigned = cameras.filter((camera) => camera.assigned_to || camera.branch_id || camera.org_id).length;

    return {
      total: cameras.length,
      assigned,
      unassigned: cameras.length - assigned,
    };
  }, [cameras]);

  const refreshCameras = async () => {
    await fetchCameras(search);
  };

  const openCreateCamera = () => {
    setFormCamera(null);
    setShowForm(true);
  };

  const openEditCamera = (camera: Camera) => {
    setFormCamera(camera);
    setShowForm(true);
  };

  const deleteCamera = async (camera: Camera) => {
    const confirmed = await confirmAction({
      title: "Delete Camera",
      message: `Delete camera ${camera.serial_number}? This removes it from the inventory view.`,
      confirmLabel: "Delete Camera",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await axios.delete(`${API_URL}/camera/${camera.camera_id}`, {
        withCredentials: true,
      });
      setCameras((current) => current.filter((item) => item.camera_id !== camera.camera_id));
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to delete camera"
        : "Failed to delete camera";
      setError(Array.isArray(message) ? message.join(", ") : message);
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 bg-body-black p-4 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-semibold">Camera Inventory</h2>
          <p className="mt-1 text-sm text-white/55">
            Manage stock, assignments, and camera hardware details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshCameras()}
            className="border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateCamera}
            className="bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
          >
            Add Camera
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase text-white/45">Visible Cameras</p>
          <p className="mt-1 text-2xl font-semibold">{inventoryStats.total}</p>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase text-white/45">Assigned</p>
          <p className="mt-1 text-2xl font-semibold">{inventoryStats.assigned}</p>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase text-white/45">Unassigned</p>
          <p className="mt-1 text-2xl font-semibold">{inventoryStats.unassigned}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex border border-white/10 bg-black/40 p-1">
          {(["UNASSIGNED", "ASSIGNED"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm ${
                activeTab === tab ? "bg-red-600 text-white" : "text-white/70 hover:bg-white/10"
              }`}
            >
              {tab === "UNASSIGNED" ? "Stock / Unassigned" : "Assigned"}
            </button>
          ))}
        </div>

        <div className="flex min-w-[280px] flex-1 justify-end">
          <input
            type="search"
            placeholder="Search serial, model, manufacturer, USB..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full max-w-md border border-white/10 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-red-500"
          />
        </div>
      </div>

      {error && (
        <div className="border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden border border-white/10 bg-black/30">
            {refreshing && (
          <div className="absolute right-3 top-3 z-10 border border-white/10 bg-gray-950/95 px-3 py-1 text-xs text-white/65 shadow-lg">
            Updating quietly
          </div>
        )}

        <div className="h-full overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="sticky top-0 bg-gray-950 text-xs uppercase text-white/50">
              <tr>
                <th className="px-4 py-3">Camera</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignment</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Last Assigned</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/50">
                    Loading cameras...
                  </td>
                </tr>
              ) : filteredCameras.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/50">
                    No cameras match this view.
                  </td>
                </tr>
              ) : (
                filteredCameras.map((camera) => {
                  const officerName = camera.officer?.user
                    ? `${camera.officer.user.first_name} ${camera.officer.user.last_name}`
                    : "No officer assigned";

                  return (
                    <tr key={camera.camera_id} className="border-t border-white/10 hover:bg-white/[0.03]">
                      <td className="px-4 py-4">
                        <p className="font-semibold">{camera.serial_number}</p>
                        <p className="text-xs text-white/50">
                          {camera.manufacturer ?? "Unknown maker"} / {camera.model}
                        </p>
                        <p className="mt-1 text-xs text-white/40">
                          USB {camera.usb_serial ?? "not recorded"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex border px-2 py-1 text-xs ${getStatusClass(camera.status)}`}>
                          {camera.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p>{officerName}</p>
                        <p className="text-xs text-white/45">{camera.assigned_to ?? "No officer id"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p>{camera.branch?.name ?? "Unassigned"}</p>
                        <p className="text-xs text-white/45">{camera.branch?.location ?? "No branch location"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p>{camera.organization?.name ?? "Unassigned"}</p>
                        <p className="text-xs text-white/45">{camera.org_id ?? "No organization id"}</p>
                      </td>
                      <td className="px-4 py-4 text-white/70">
                        <p>{formatDateTime(camera.assigned_to_officer_at)}</p>
                        <p className="text-xs text-white/45">
                          Branch: {formatDateTime(camera.assigned_to_branch_at)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {activeTab === "UNASSIGNED" && (
                            <button
                              type="button"
                              onClick={() => setSelectedCamera(camera)}
                              className="border border-red-500/50 px-3 py-1 text-xs text-red-100 hover:bg-red-600"
                            >
                              Assign
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditCamera(camera)}
                            className="border border-white/15 px-3 py-1 text-xs hover:bg-white/10"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteCamera(camera)}
                            className="border border-white/15 px-3 py-1 text-xs text-red-200 hover:bg-red-950"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCamera && (
        <AssignCameraModal
          camera={selectedCamera}
          onClose={() => setSelectedCamera(null)}
          onAssigned={async () => {
            setActiveTab("ASSIGNED");
            setSelectedCamera(null);
            await fetchCameras(search);
          }}
        />
      )}

      {showForm && (
        <CameraFormModal
          camera={formCamera}
          onClose={async () => {
            setShowForm(false);
            await refreshCameras();
          }}
        />
      )}
      {dialogElement}
    </div>
  );
}

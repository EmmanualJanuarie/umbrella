import { useEffect, useState } from "react";
import type { Camera } from "../../data/types";
import axios from "axios";

type AssignCameraModalProps = {
  camera: Camera;
  onClose: () => void;
  onAssigned?: () => void; // NEW
};

export default function AssignCameraModal({ camera, onClose, onAssigned }: AssignCameraModalProps) {
  const [orgId, setOrgId] = useState("");
  const [organizations, setOrganizations] = useState<{ org_id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  const handleAssign = async () => {
    if (!orgId || saving) return;
    setSaving(true);
    setError(null);

    try {
      await axios.post(
        `${API_URL}/camera/assign/organization`,
        { camera_id: camera.camera_id, org_id: orgId },
        { withCredentials: true }
      );

      onClose();          // close modal
      if (onAssigned) onAssigned(); // refresh table after assignment
    } catch (err) {
      console.error("Failed to assign camera", err);
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to assign camera"
        : "Failed to assign camera";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await axios.get(`${API_URL}/organization`, { withCredentials: true });
        setOrganizations(res.data);
      } catch (err) {
        console.error("Failed to fetch orgs", err);
      }
    };
    fetchOrgs();
  }, [API_URL]);

  const details = [
    ["Manufacturer", camera.manufacturer ?? "Not recorded"],
    ["Model", camera.model],
    ["Camera serial", camera.serial_number],
    ["USB serial", camera.usb_serial ?? "Not recorded"],
    ["Vendor ID", camera.vendor_id ?? "Not recorded"],
    ["Product ID", camera.product_id ?? "Not recorded"],
    ["Type", camera.type],
    ["Purchase date", camera.purchase_date ? new Date(camera.purchase_date).toLocaleDateString() : "Not recorded"],
  ];

  const assignment = [
    ["Organization", camera.organization?.name ?? "Unassigned"],
    ["Branch", camera.branch?.name ?? "Unassigned"],
    ["Officer", camera.officer?.user ? `${camera.officer.user.first_name} ${camera.officer.user.last_name}` : "Unassigned"],
    ["Officer ID", camera.officer?.officer_id ?? "Unassigned"],
    ["Assigned to org", camera.assigned_to_org_at ? new Date(camera.assigned_to_org_at).toLocaleString() : "Not assigned"],
    ["Assigned to branch", camera.assigned_to_branch_at ? new Date(camera.assigned_to_branch_at).toLocaleString() : "Not assigned"],
    ["Assigned to officer", camera.assigned_to_officer_at ? new Date(camera.assigned_to_officer_at).toLocaleString() : "Not assigned"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-red-300">Camera Inventory</p>
            <h3 className="mt-1 text-xl font-semibold">{camera.serial_number}</h3>
            <p className="mt-1 text-sm text-white/55">{camera.manufacturer ?? "Unknown manufacturer"} / {camera.model}</p>
          </div>
          <button className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <h4 className="text-sm font-semibold uppercase text-white/60">Device Identity</h4>
                <span className="border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/70">{camera.status}</span>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {details.map(([label, value]) => (
                  <div key={label} className="border-b border-white/10 pb-3">
                    <dt className="text-xs uppercase text-white/40">{label}</dt>
                    <dd className="mt-1 break-words text-sm text-white/85">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-4">
              <h4 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Assignment</h4>
              <dl className="mt-4 space-y-3">
                {assignment.map(([label, value]) => (
                  <div key={label} className="border-b border-white/10 pb-3">
                    <dt className="text-xs uppercase text-white/40">{label}</dt>
                    <dd className="mt-1 break-words text-sm text-white/85">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section className="mt-4 border border-white/10 bg-black/25 p-4">
            <h4 className="text-sm font-semibold uppercase text-white/60">Assign to Organization</h4>
            <p className="mt-1 text-sm text-white/45">Stock cameras start unassigned. Assigning to an organization makes it available for branch allocation.</p>
            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <select
                className="min-w-0 flex-1 border border-white/10 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-red-500"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
              >
                <option value="">Select organization</option>
                {organizations.map((org) => (
                  <option key={org.org_id} value={org.org_id}>{org.name}</option>
                ))}
              </select>
              <button
                disabled={!orgId || saving}
                onClick={handleAssign}
                className="bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:bg-gray-700"
              >
                {saving ? "Assigning..." : "Assign Camera"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

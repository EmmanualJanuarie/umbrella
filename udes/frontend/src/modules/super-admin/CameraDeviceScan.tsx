import axios from "axios";
import { useCallback, useMemo, useState } from "react";

type CameraScanDevice = {
  camera_id?: string;
  camera_serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  device_id: string;
  status: string | null;
  detected_at: string;
  organization_name?: string | null;
  branch_name?: string | null;
  officer_name?: string | null;
  last_upload_at?: string | null;
  operational_state?: "ACTIVE" | "STALE" | "NEVER_REPORTED";
};

type ScanResponse = {
  detected_at: string;
  platform: string;
  supported: boolean;
  devices: CameraScanDevice[];
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

function stateClass(state?: CameraScanDevice["operational_state"]) {
  if (state === "ACTIVE") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (state === "STALE") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-white/15 bg-white/5 text-white/55";
}

export default function CameraDeviceScan() {
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => result?.devices.find((device) => device.device_id === selectedId) ?? null,
    [result, selectedId],
  );

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<ScanResponse>(`${API_URL}/camera-scan/devices`, {
        withCredentials: true,
      });
      setResult(response.data);
      setSelectedId((current) =>
        response.data.devices.some((device) => device.device_id === current)
          ? current
          : response.data.devices[0]?.device_id ?? null,
      );
    } catch (scanError) {
      setError(
        axios.isAxiosError(scanError)
          ? String(scanError.response?.data?.message ?? "The backend camera scan failed.")
          : "The backend camera scan failed.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-body-black p-4 text-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Backend-authoritative inventory</p>
          <h2 className="mt-1 text-xl font-semibold">Camera Operational Scan</h2>
          <p className="mt-1 max-w-3xl text-sm text-white/55">
            Checks registered cameras and their latest evidence activity. No camera data is processed in the browser.
          </p>
        </div>
        <button type="button" onClick={() => void scan()} disabled={loading} className="bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50">
          {loading ? "Scanning backend..." : "Run Camera Scan"}
        </button>
      </header>

      {error && <div className="border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase text-white/40">Registered cameras</p><p className="mt-1 text-2xl font-semibold">{result?.devices.length ?? "—"}</p></div>
        <div className="border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase text-white/40">Active in last 30 days</p><p className="mt-1 text-2xl font-semibold text-emerald-300">{result?.devices.filter((device) => device.operational_state === "ACTIVE").length ?? "—"}</p></div>
        <div className="border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase text-white/40">Last backend scan</p><p className="mt-1 text-sm font-semibold">{result ? new Date(result.detected_at).toLocaleString() : "Not scanned"}</p></div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1.5fr_0.8fr]">
        <section className="min-h-0 overflow-auto border border-white/10">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#17181b] text-xs uppercase tracking-wide text-white/40">
              <tr><th className="p-3">Camera</th><th className="p-3">Organisation</th><th className="p-3">Branch</th><th className="p-3">Officer</th><th className="p-3">Last upload</th><th className="p-3">Operational state</th></tr>
            </thead>
            <tbody>
              {(result?.devices ?? []).map((device) => (
                <tr key={device.device_id} onClick={() => setSelectedId(device.device_id)} className={`cursor-pointer border-t border-white/5 hover:bg-white/[0.04] ${selectedId === device.device_id ? "bg-red-600/10 shadow-[inset_3px_0_0_#dc2626]" : ""}`}>
                  <td className="p-3"><p className="font-mono text-xs">{device.camera_serial_number ?? "No serial"}</p><p className="text-xs text-white/40">{device.manufacturer ?? "Unknown"} {device.model ?? ""}</p></td>
                  <td className="p-3">{device.organization_name ?? "Unassigned"}</td>
                  <td className="p-3">{device.branch_name ?? "Unassigned"}</td>
                  <td className="p-3">{device.officer_name ?? "Unassigned"}</td>
                  <td className="p-3 whitespace-nowrap text-white/65">{device.last_upload_at ? new Date(device.last_upload_at).toLocaleString() : "Never"}</td>
                  <td className="p-3"><span className={`border px-2 py-1 text-xs font-semibold ${stateClass(device.operational_state)}`}>{String(device.operational_state ?? "UNKNOWN").replaceAll("_", " ")}</span></td>
                </tr>
              ))}
              {!loading && result?.devices.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-white/40">No registered cameras were found.</td></tr>}
              {!loading && !result && <tr><td colSpan={6} className="p-8 text-center text-white/40">Run the backend scan to load the operational inventory.</td></tr>}
            </tbody>
          </table>
        </section>

        <aside className="min-h-0 overflow-auto border border-white/10 bg-white/[0.025] p-4">
          <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Camera details</h3>
          {selected ? <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Camera ID", selected.camera_id],
              ["Serial number", selected.camera_serial_number],
              ["Manufacturer", selected.manufacturer],
              ["Model", selected.model],
              ["Registry status", selected.status],
              ["Organisation", selected.organization_name],
              ["Branch", selected.branch_name],
              ["Assigned officer", selected.officer_name],
              ["Last evidence upload", selected.last_upload_at ? new Date(selected.last_upload_at).toLocaleString() : "Never"],
            ].map(([label, value]) => <div key={label} className="border-b border-white/5 pb-3"><dt className="text-xs uppercase text-white/35">{label}</dt><dd className="mt-1 break-all text-white/75">{value ?? "Unavailable"}</dd></div>)}
          </dl> : <p className="mt-4 text-sm text-white/40">Select a camera to inspect its backend record.</p>}
        </aside>
      </div>
    </div>
  );
}

import { useState } from "react";
import axios from "axios";
import { CAMERA_TYPE, type Camera } from "../../data/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export function CameraFormModal({
  camera,
  onClose,
}: {
  camera?: Camera | null;
  onClose: () => void;
}) {
  const [serial, setSerial] = useState(camera?.serial_number ?? "");
  const [model, setModel] = useState(camera?.model ?? "");
  const [vendorId, setVendorId] = useState(camera?.vendor_id ?? "");
  const [manufacturer, setManufacturer] = useState(camera?.manufacturer ?? "");
  const [usbSerial, setUsbSerial] = useState(camera?.usb_serial ?? "");
  const [productId, setProductId] = useState(camera?.product_id ?? "");
  const [type, setType] = useState<string>(camera?.type ?? CAMERA_TYPE.BYOC);
  const [purchaseDate, setPurchaseDate] = useState<string>(
    camera?.purchase_date ? camera.purchase_date.slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormValid =
    serial.trim() !== "" &&
    model.trim() !== "" &&
    manufacturer.trim() !== "" &&
    productId.trim() !== "" &&
    vendorId.trim() !== "" &&
    usbSerial.trim() !== "";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isFormValid || saving) {
      setError("Serial number, model, manufacturer, vendor ID, product ID, and USB serial are required.");
      return;
    }

    const payload = {
      serial_number: serial.trim().toUpperCase(),
      model: model.trim(),
      vendor_id: vendorId.trim().toUpperCase().replace(/^0X/, ""),
      manufacturer: manufacturer.trim(),
      product_id: productId.trim().toUpperCase().replace(/^0X/, ""),
      usb_serial: usbSerial.trim(),
      type: type as "BYOC" | "UMBRELLA",
      ...(purchaseDate ? { purchase_date: purchaseDate } : {}),
    };

    setSaving(true);
    setError(null);

    try {
      const requestConfig = {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      };

      if (camera) {
        await axios.patch(
          `${API_URL}/camera/${camera.camera_id}`,
          payload,
          requestConfig,
        );
      } else {
        await axios.post(`${API_URL}/camera`, payload, requestConfig);
      }

      onClose();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.code === "ECONNABORTED"
          ? "Camera save timed out. Please check the backend/database connection and try again."
          : err.response?.data?.message ?? err.response?.data?.error ?? "Camera save failed"
        : "Camera save failed";
      console.error("Camera save failed", err);
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "w-full border border-white/10 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20";
  const labelClass = "text-xs font-semibold uppercase text-white/45";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-4xl overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold">
              {camera ? "Update Camera" : "Add Camera"}
            </h3>
            <p className="mt-1 text-sm text-white/55">
              Capture the hardware identity used by evidence attribution and camera-assignment workflows.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[78vh] overflow-y-auto p-6">
          {error && (
            <div className="mb-4 border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="mb-5 border border-white/10 bg-black/25 p-4">
            <h4 className="text-sm font-semibold uppercase text-white/60">Evidence Device Identity</h4>
            <p className="mt-1 text-sm text-white/45">
              These fields identify the physical camera during sync, chain-of-custody, and assignment checks.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className={labelClass}>Serial Number</span>
              <input
                required
                type="text"
                value={serial.toUpperCase()}
                onChange={(event) => setSerial(event.target.value)}
                className={fieldClass}
                placeholder="Example: CAM-2026-0001"
              />
            </label>

            <label className="space-y-1">
              <span className={labelClass}>Model</span>
              <input
                required
                type="text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className={fieldClass}
                placeholder="Example: MODEL-100"
              />
            </label>

            <label className="space-y-1">
              <span className={labelClass}>Manufacturer</span>
              <input
                required
                type="text"
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
                className={fieldClass}
                placeholder="Example: Camera Manufacturer"
              />
            </label>

            <label className="space-y-1">
              <span className={labelClass}>Camera Type</span>
              <select
                required
                value={type}
                onChange={(event) => setType(event.target.value)}
                className={fieldClass}
              >
                <option value="BYOC">BYOC</option>
                <option value="UMBRELLA">UMBRELLA</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className={labelClass}>Vendor ID</span>
              <input
                required
                type="text"
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
                className={fieldClass}
                placeholder="Example: 1A2B"
              />
            </label>

            <label className="space-y-1">
              <span className={labelClass}>Product ID</span>
              <input
                required
                type="text"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className={fieldClass}
                placeholder="Example: 3C4D"
              />
            </label>

            <label className="space-y-1">
              <span className={labelClass}>USB Serial Number</span>
              <input
                required
                type="text"
                value={usbSerial}
                onChange={(event) => setUsbSerial(event.target.value)}
                className={fieldClass}
                placeholder="Example: USB-DEVICE-0001"
              />
            </label>

            <label className="space-y-1">
              <span className={labelClass}>Purchase Date</span>
              <input
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
            <p className="text-xs text-white/45">
              Vendor, product, and USB serial are used to match inserted devices reliably.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isFormValid || saving}
                className="bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:bg-gray-700"
              >
                {saving ? "Saving..." : camera ? "Update Camera" : "Create Camera"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import axios from "axios";
import { format } from "date-fns/format";


import "react-big-calendar/lib/css/react-big-calendar.css";
import { type Camera } from "../../data/types.js";
import { UserName } from "../../components/helpers/UserName.js";
import { useActionDialog } from "../../components/modals/ActionDialog.js";

const runAction = async (action: () => Promise<unknown>, options?: unknown) => {
  void options;
  await action();
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

interface Officer {
  officer_id: string;
  badge_number?: string | null;
  user: {
    first_name: string;
    last_name: string;
    branch_id: string;
    role: string;
    deleted_at: string;
  };
  cameras?: Camera[];
}

interface Shift {
  shift_id: string;
  camera_id?: string | null;
  start_time: string;
  end_time: string;
  officer: Officer;
  deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  off_days: string[];
  shift_del_reason?: string;
  camera?: Camera | null;
}

export default function Shifts() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);

  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startClock, setStartClock] = useState("");

  const [endDate, setEndDate] = useState("");
  const [endClock, setEndClock] = useState("");
  const [shiftDurationHours, setShiftDurationHours] = useState<8 | 10 | 12>(8);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);

  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [offDays, setOffDays] = useState<string[]>([]);

  const activeOfficers = officers.filter((officer) => {
    return (
      // must be OFFICER role
      officer.user.role === "OFFICER" &&
      
      // must NOT be deleted (adjust field name if backend differs)
      !officer.user.deleted_at
    );
  });

  const applyShiftDuration = (
    date: string,
    clock: string,
    durationHours: 8 | 10 | 12,
  ) => {
    if (!date || !clock) return;
    const start = new Date(`${date}T${clock}`);
    if (Number.isNaN(start.getTime())) return;

    const end = new Date(start);
    end.setHours(end.getHours() + durationHours);

    setEndDate(format(end, "yyyy-MM-dd"));
    setEndClock(format(end, "HH:mm"));
  };

  const getDaysBetween = (
    start:string,
    end:string
    )=>{

    const days=[];

    const current=new Date(start);
    const last=new Date(end);

    while(current<=last){
      days.push(
        current.toISOString().split("T")[0]
      );

      current.setDate(
        current.getDate()+1
      );
    }


    return days;
  }

  const loadShifts = async () => {
    const res = await axios.get(`${API_URL}/shift`, { withCredentials: true });

    // Normalize deleted property
    const normalized = res.data.map((shift: Shift) => ({
      ...shift,
      deleted: !!shift.deleted_at, // force boolean
    }));

    setShifts(normalized);
  };

  const loadOfficers = async () => {
    const res = await axios.get(`${API_URL}/officer`, { withCredentials: true });
    setOfficers(res.data);
  };

  const loadCameras = async () => {
    const res = await axios.get(`${API_URL}/camera`, { withCredentials: true });
    setCameras(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    void Promise.all([loadShifts(), loadOfficers(), loadCameras()]);
  }, []);

  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const { dialogElement, showMessage, promptAction } = useActionDialog();

  

  const handleDeleteShift = async (s: Shift) => {
   runAction(async () => {
     const reason = await promptAction({
      title: "Delete Shift",
      message: `Delete shift [${s.shift_id}] by ${s.officer.user.first_name} ${s.officer.user.last_name}? Enter a reason.`,
      placeholder: "Deletion reason",
      confirmLabel: "Delete Shift",
      tone: "danger",
      required: true,
    });

    if (!reason) return;

    try {
      const res = await axios.delete(`${API_URL}/shift/${s.shift_id}`, {
        data: { reason },
        withCredentials: true
      });

      const deletedBy = res.data.deleted_by || "You";  // backend should ideally return this
      const deletedAt = res.data.deleted_at || new Date().toISOString();

      setShifts((prev) =>
        prev.map((sh) =>
          sh.shift_id === s.shift_id
            ? {
                ...sh,
                deleted: true,
                deleted_by: deletedBy,
                deleted_at: deletedAt,
                shift_del_reason: reason, // use correct field
              }
            : sh
        )
      );
    } catch (err) {
      console.error("Failed to delete shift", err);
    }
   }, {});
  };

const selectedOfficerObj = officers.find(o => o.officer_id === selectedOfficer);

const createShift = async () => {
    if (!selectedOfficer ) return;

    const start_time = new Date(`${startDate}T${startClock}`).toISOString();
    const end_time = new Date(`${endDate}T${endClock}`).toISOString();

  const payload: any = {
    officer_id: selectedOfficer,
    start_time,
    end_time,
    status: 'SCHEDULED',
    off_days: offDays
  };

  if (selectedCamera) payload.camera_id = selectedCamera;

  try {
    //Use POST for new shifts
    await axios.post(`${API_URL}/shift`, payload, { withCredentials: true });

    await loadShifts();

    // reset form
    setSelectedOfficer("");

    setStartDate("");
    setStartClock("");
    setEndDate("");
    setEndClock("");

    setSelectedCamera(null);
    setOffDays([]);
    setShowShiftsModal(false);
  } catch (err) {
    console.error("Failed to create shift", err);
    await showMessage({
      title: "Shift Creation Failed",
      message: "Failed to create shift. Please check the details and try again.",
      tone: "danger",
    });
  }
};

const canCreate =
  selectedOfficer &&
  startDate &&
  startClock &&
  endDate &&
  endClock;


  // Check if form has changes
const hasChanges = editingShift
  ? editingShift.officer.officer_id !== selectedOfficer ||
    format(new Date(editingShift.start_time), "yyyy-MM-dd") !== startDate ||
    format(new Date(editingShift.end_time), "yyyy-MM-dd") !== endDate ||
    format(new Date(editingShift.start_time), "HH:mm") !== startClock ||
    format(new Date(editingShift.end_time), "HH:mm") !== endClock ||
    (editingShift.camera_id ?? null) !== selectedCamera ||
    [...(editingShift.off_days ?? [])].sort().join("|") !== [...offDays].sort().join("|")
  : false;

const visibleShifts = shifts.filter((shift) => !shift.deleted_at);
const deletedShifts = shifts.filter((shift) => shift.deleted_at);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getShiftHours = (shift: Shift) => {
  const start = new Date(shift.start_time).getTime();
  const end = new Date(shift.end_time).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "N/A";
  return `${Math.round((end - start) / 3600000)}h`;
};

const getCameraCustodyLabel = (shift: Shift) => {
  if (!shift.camera_id) return null;
  const now = Date.now();
  const startsAt = new Date(shift.start_time).getTime();
  const endsAt = new Date(shift.end_time).getTime();
  if (startsAt <= now && now < endsAt) return "IN CUSTODY";
  if (now < startsAt) return "RESERVED";
  return "HANDOVER DUE";
};

const getNextCameraHandover = (shift: Shift) => {
  if (!shift.camera_id) return null;
  return visibleShifts
    .filter(
      (candidate) =>
        candidate.shift_id !== shift.shift_id &&
        candidate.camera_id === shift.camera_id &&
        new Date(candidate.start_time).getTime() >= new Date(shift.end_time).getTime(),
    )
    .sort(
      (first, second) =>
        new Date(first.start_time).getTime() - new Date(second.start_time).getTime(),
    )[0] ?? null;
};

const resetShiftForm = () => {
  setSelectedOfficer("");
  setStartDate("");
  setStartClock("");
  setEndDate("");
  setEndClock("");
  setSelectedCamera(null);
  setOffDays([]);
  setShiftDurationHours(8);
};

const openCreateShiftModal = () => {
  setEditingShift(null);
  resetShiftForm();
  setShowShiftsModal(true);
};

const openEditShiftModal = (shift: Shift) => {
  setEditingShift(shift);
  setSelectedOfficer(shift.officer.officer_id);

  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);

  setStartDate(format(start, "yyyy-MM-dd"));
  setStartClock(format(start, "HH:mm"));
  setEndDate(format(end, "yyyy-MM-dd"));
  setEndClock(format(end, "HH:mm"));

  const diffHours = Math.round((end.getTime() - start.getTime()) / 3600000);
  if (diffHours === 8 || diffHours === 10 || diffHours === 12) {
    setShiftDurationHours(diffHours);
  }

  setOffDays(
    Array.isArray(shift.off_days)
      ? shift.off_days
      : shift.off_days
        ? JSON.parse(shift.off_days as unknown as string)
        : []
  );

  setSelectedCamera(shift.camera_id ?? null);
  setIsModalOpen(true);
};

const fieldClass = "w-full border border-white/10 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20";
const labelClass = "text-xs font-semibold uppercase text-white/45";
const sectionClass = "border border-white/10 bg-black/25 p-4";
const officerColour = (officerId: string) => {
  const palette = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];
  return palette[[...officerId].reduce((value, character) => value + character.charCodeAt(0), 0) % palette.length];
};

  return (
    <div className="flex h-full flex-col border border-white/10 bg-body-black text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-red-300">Branch Operations</p>
          <h2 className="mt-1 text-xl font-semibold">Manage Shifts</h2>
          <p className="mt-1 text-sm text-white/50">
            Allocate a branch camera to each duty window. The same camera can be shared on non-overlapping shifts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadShifts()}
            className="border border-white/10 px-4 py-2 text-sm text-white/75 hover:bg-white/10"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowDeletedModal(true)}
            className="border border-white/10 px-4 py-2 text-sm text-white/75 hover:bg-white/10"
          >
            Deleted Shifts
          </button>
          <button
            type="button"
            onClick={openCreateShiftModal}
            className="bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
          >
            Create Shift
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-white/10 p-4 md:grid-cols-3">
        <div className="border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase text-white/45">Scheduled</p>
          <p className="mt-1 text-2xl font-semibold">{visibleShifts.length}</p>
        </div>
        <div className="border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase text-white/45">Active Officers</p>
          <p className="mt-1 text-2xl font-semibold">{activeOfficers.length}</p>
        </div>
        <div className="border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase text-white/45">Deleted Records</p>
          <p className="mt-1 text-2xl font-semibold">{deletedShifts.length}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1160px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-white/10 bg-gray-950 text-xs uppercase text-white/45">
            <tr>
              <th className="p-3">Officer</th>
              <th className="p-3">Start</th>
              <th className="p-3">End</th>
              <th className="p-3">Length</th>
              <th className="p-3">Camera</th>
              <th className="p-3">Camera custody & handover</th>
              <th className="p-3">Off Days</th>
              <th className="p-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleShifts.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-white/45">
                  No shifts scheduled yet.
                </td>
              </tr>
            ) : (
              visibleShifts.map((shift) => {
                const camera = shift.camera;
                const custodyStatus = getCameraCustodyLabel(shift);
                const nextHandover = getNextCameraHandover(shift);
                return (
                  <tr
                    key={shift.shift_id}
                    className="cursor-pointer border-b border-white/10 hover:bg-white/[0.06]"
                    style={{ borderLeft: `3px solid ${officerColour(shift.officer.officer_id)}` }}
                    onClick={() => openEditShiftModal(shift)}
                  >
                    <td className="p-3">
                      <p className="font-medium text-white">
                        {shift.officer.user.first_name} {shift.officer.user.last_name}
                      </p>
                    </td>
                    <td className="p-3 text-white/75">{formatDateTime(shift.start_time)}</td>
                    <td className="p-3 text-white/75">{formatDateTime(shift.end_time)}</td>
                    <td className="p-3">
                      <span className="border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
                        {getShiftHours(shift)}
                      </span>
                    </td>
                    <td className="p-3">
                      {camera ? (
                        <>
                          <p className="font-mono text-xs text-white">{camera.serial_number}</p>
                          <p className="mt-1 text-xs text-white/40">{camera.model}</p>
                        </>
                      ) : (
                        <span className="text-white/35">No assigned camera</span>
                      )}
                    </td>
                    <td className="p-3">
                      {camera && custodyStatus ? (
                        <div className="space-y-1.5">
                          <span
                            className={`inline-flex border px-2 py-1 text-[11px] font-semibold tracking-wide ${
                              custodyStatus === "IN CUSTODY"
                                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                                : custodyStatus === "RESERVED"
                                  ? "border-sky-500/35 bg-sky-500/10 text-sky-200"
                                  : "border-amber-500/35 bg-amber-500/10 text-amber-200"
                            }`}
                          >
                            {custodyStatus}
                          </span>
                          <p className="text-xs text-white/65">
                            Holder: {shift.officer.user.first_name} {shift.officer.user.last_name}
                            {shift.officer.badge_number ? ` · ${shift.officer.badge_number}` : ""}
                          </p>
                          <p className="text-xs text-white/45">
                            Handover time: {formatDateTime(shift.end_time)}
                          </p>
                          {nextHandover ? (
                            <p className="text-xs text-sky-200/80">
                              Next: {formatDateTime(nextHandover.start_time)} → {nextHandover.officer.user.first_name} {nextHandover.officer.user.last_name}
                            </p>
                          ) : (
                            <p className="text-xs text-white/35">No next holder scheduled</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/35">No camera custody scheduled</span>
                      )}
                    </td>
                    <td className="p-3 text-white/60">
                      {Array.isArray(shift.off_days) && shift.off_days.length > 0
                        ? `${shift.off_days.length} selected`
                        : "None"}
                    </td>
                    <td className="p-3 text-right">
                      <span className="border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-200">
                        SCHEDULED
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && editingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-red-300">Shift Record</p>
                <h2 className="mt-1 text-xl font-semibold">Edit Shift</h2>
                <p className="mt-1 text-sm text-white/50">
                  {editingShift.officer.user.first_name} {editingShift.officer.user.last_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingShift(null); }}
                className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 overflow-y-auto p-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className={sectionClass}>
                  <h3 className="mb-3 text-sm font-semibold uppercase text-white/60">Officer Assignment</h3>
                  <label className="space-y-1">
                    <span className={labelClass}>Officer</span>
                    <select className={fieldClass} value={selectedOfficer} onChange={(e) => setSelectedOfficer(e.target.value)}>
                      {activeOfficers.map((o) => (
                        <option key={o.officer_id} value={o.officer_id}>
                          {o.user.first_name} {o.user.last_name} - {o.officer_id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className={sectionClass}>
                  <h3 className="mb-3 text-sm font-semibold uppercase text-white/60">Schedule Window</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className={labelClass}>Start Date</span>
                      <input type="date" className={fieldClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>Start Time</span>
                      <input type="time" className={fieldClass} value={startClock} onChange={(e) => { setStartClock(e.target.value); applyShiftDuration(startDate, e.target.value, shiftDurationHours); }} />
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>Shift Length</span>
                      <select className={fieldClass} value={shiftDurationHours} onChange={(e) => { const value = Number(e.target.value) as 8 | 10 | 12; setShiftDurationHours(value); applyShiftDuration(startDate, startClock, value); }}>
                        <option value={8}>8 hours</option>
                        <option value={10}>10 hours</option>
                        <option value={12}>12 hours</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>End Date</span>
                      <input type="date" className={fieldClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </label>
                    <label className="space-y-1 md:col-span-2">
                      <span className={labelClass}>End Time</span>
                      <input type="time" className={fieldClass} value={endClock} onChange={(e) => setEndClock(e.target.value)} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className={sectionClass}>
                  <h3 className="mb-3 text-sm font-semibold uppercase text-white/60">Scheduled Camera</h3>
                  <p className="mb-3 text-xs text-white/45">Choose any active camera allocated to this branch. Overlapping allocations are blocked by the server.</p>
                  <select className={fieldClass} value={selectedCamera ?? ""} onChange={(e) => setSelectedCamera(e.target.value || null)}>
                    <option value="">No camera scheduled</option>
                    {cameras.filter((camera) => !["DAMAGED", "LOST", "INACTIVE"].includes(camera.status)).map((camera) => <option key={camera.camera_id} value={camera.camera_id}>{camera.serial_number} - {camera.model}</option>)}
                  </select>
                </div>

                {startDate && endDate && (
                  <div className={sectionClass}>
                    <h3 className="text-sm font-semibold uppercase text-white/60">Off Days</h3>
                    <p className="mt-1 text-xs text-white/45">Selected days are excluded from duty.</p>
                    <div className="mt-3 max-h-56 overflow-y-auto border border-white/10 p-2">
                      <div className="grid grid-cols-2 gap-2">
                        {getDaysBetween(startDate, endDate).map((day) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setOffDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])}
                            className={`border p-2 text-xs ${offDays.includes(day) ? "border-red-500 bg-red-600/20 text-white" : "border-white/10 bg-gray-950 text-white/55"}`}
                          >
                            {new Date(day).toDateString()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/35 px-6 py-4">
              <button
                type="button"
                className="border border-red-500/30 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10"
                onClick={async (e) => {
                  if (!editingShift) return;
                  e.stopPropagation();
                  await handleDeleteShift(editingShift);
                  setIsModalOpen(false);
                  setEditingShift(null);
                  await loadShifts();
                }}
              >
                Delete Shift
              </button>
              <div className="flex gap-2">
                <button type="button" className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10" onClick={() => { setIsModalOpen(false); setEditingShift(null); }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-semibold ${hasChanges ? "bg-red-600 hover:bg-red-500" : "bg-gray-700 text-white/45"}`}
                  disabled={!hasChanges}
                  onClick={async () => {
                    runAction(async () => {
                      if (!editingShift || !hasChanges) return;

                      const start_time = new Date(`${startDate}T${startClock}`).toISOString();
                      const end_time = new Date(`${endDate}T${endClock}`).toISOString();
                      if (Number.isNaN(new Date(start_time).getTime()) || Number.isNaN(new Date(end_time).getTime()) || new Date(end_time) <= new Date(start_time)) {
                        await showMessage({ title: "Invalid schedule", message: "The shift end must be after its start time.", tone: "danger" });
                        return;
                      }
                      try {
                        await axios.patch(
                          `${API_URL}/shift/${editingShift.shift_id}`,
                          {
                            officer_id: selectedOfficer,
                            start_time,
                            end_time,
                            status: 'SCHEDULED',
                            off_days: offDays,
                            camera_id: selectedCamera,
                          },
                          { withCredentials: true }
                        );

                        setIsModalOpen(false);
                        setEditingShift(null);
                        await loadShifts();
                        await showMessage({ title: "Shift updated", message: "The schedule and camera allocation were updated.", tone: "success" });
                      } catch (error) {
                        const message = axios.isAxiosError(error)
                          ? error.response?.data?.message
                          : "The shift could not be updated.";
                        await showMessage({
                          title: "Shift update failed",
                          message: Array.isArray(message) ? message.join(", ") : String(message ?? "The shift could not be updated."),
                          tone: "danger",
                        });
                      }
                    }, {});
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeletedModal && false && (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-gray-900 p-6 w-96 max-h-[80vh] overflow-auto">
          <h2 className="text-lg font-bold mb-4">Deleted Shifts</h2>
          <div className="max-h-80 overflow-y-auto">
             {shifts.filter(s => s.deleted_at).length === 0 ? (
            <p className="text-gray-400">No deleted shifts</p>
          ) : (
            shifts.filter(s => s.deleted_at).map((shift) => (
              <div key={shift.shift_id} className="bg-gray-800 p-2 mb-2">
                <p className="text-sm text-white">
                  Officer: {shift.officer.user.first_name} {shift.officer.user.last_name}
                </p>
                <p className="text-xs text-gray-400">
                  Shift: {new Date(shift.start_time).toLocaleString()} - {new Date(shift.end_time).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">
                  Deleted By: {
                    <>
                      <UserName userId={shift.deleted_by}/>
                    </>}
                </p>
                <p className="text-xs text-gray-400">
                  Deleted At: {shift.deleted_at ? new Date(shift.deleted_at).toLocaleString() : "Unknown"}
                </p>
                <p className="text-xs text-gray-400">
                  Reason: {shift.shift_del_reason || "No reason provided"}
                </p>
              </div>
            ))
          )}
          </div>
          <button
            className="bg-red-600 hover:bg-red-700 p-2 mt-2 w-full"
            onClick={() => setShowDeletedModal(false)}
          >
            Close
          </button>
        </div>
      </div>
    )}

    {showShiftsModal && false && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
        
        {/* MODAL BOX */}
        <div className="bg-gray-900 border border-gray-700 w-[90%] max-w-md max-h-[85vh] overflow-y-auto p-6 relative">

          {/* HEADER */}
          <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
            <h2 className="font-semibold text-lg">Create Shift</h2>

            <button
              onClick={() => setShowShiftsModal(false)}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          {/* FORM */}
          <div className="space-y-3 text-sm">

            <select
              className="w-full bg-gray-800 p-2"
              value={selectedOfficer}
              onChange={(e) => {
                const officerId = e.target.value;
                setSelectedOfficer(officerId);
                const officer = officers.find(o => o.officer_id === officerId);
                setSelectedCamera(officer?.cameras?.[0]?.camera_id || null);
              }}
            >
              <option value="">Select Officer</option>
              {activeOfficers.map((officer) => (
                <option key={officer.officer_id} value={officer.officer_id}>
                  {officer.user.first_name} {officer.user.last_name} - {officer.officer_id}
                </option>
              ))}
            </select>

            {/* CAMERA */}
            {selectedOfficerObj?.cameras?.length ? (
              <div className="bg-gray-800 border border-gray-700 p-3">
                <h3 className="font-semibold mb-2 underline">Assigned Camera</h3>
                {selectedOfficerObj?.cameras?.map((camera) => (
                  <div key={camera.camera_id} className="mb-1 text-sm">
                    <p><strong>Serial:</strong> {camera.serial_number}</p>
                    <p><strong>Model:</strong> {camera.model}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-800 border border-gray-700 p-3 text-gray-400 text-sm">
                This officer has no cameras assigned.
              </div>
            )}

            {/* DATES */}
            <div>
              <label className="block mb-1">Date - Shift Starts</label>
              <input
                type="date"
              className="w-full bg-gray-800 p-2"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                applyShiftDuration(e.target.value, startClock, shiftDurationHours);
              }}
            />
            </div>

            <div>
              <label className="block mb-1">When Shift Starts</label>
              <input
                type="time"
              className="w-full bg-gray-800 p-2"
              value={startClock}
              onChange={(e) => {
                setStartClock(e.target.value);
                applyShiftDuration(startDate, e.target.value, shiftDurationHours);
              }}
            />

            <div>
              <label className="block mb-1">Shift Length</label>
              <select
                className="w-full bg-gray-800 p-2"
                value={shiftDurationHours}
                onChange={(e) => {
                  const value = Number(e.target.value) as 8 | 10 | 12;
                  setShiftDurationHours(value);
                  applyShiftDuration(startDate, startClock, value);
                }}
              >
                <option value={8}>8 hours</option>
                <option value={10}>10 hours</option>
                <option value={12}>12 hours</option>
              </select>
            </div>
            </div>

            <div>
              <label className="block mb-1">Date - Shift Ends</label>
              <input
                type="date"
                className="w-full bg-gray-800 p-2"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1">When Shift Ends</label>
              <input
                type="time"
                className="w-full bg-gray-800 p-2"
                value={endClock}
                onChange={(e) => setEndClock(e.target.value)}
              />
            </div>

            {startDate && endDate && (

            <div>
              <h3 className="font-semibold mb-2">
              Select days officer is NOT working
              </h3>

              <p className="text-gray-400 text-xs mb-2">
              Highlighted days mean the officer has no duty.
              </p>

              <div className="max-h-48 overflow-y-auto border border-gray-700 p-2">
                <div className="grid grid-cols-3 gap-2">
                  {getDaysBetween(startDate, endDate).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setOffDays((prev) =>
                          prev.includes(day)
                            ? prev.filter((d) => d !== day)
                            : [...prev, day]
                        )
                      }
                      className={`
                        p-2 border text-xs
                        ${offDays.includes(day) ? "bg-red-600" : "bg-gray-800"}
                      `}
                    >
                      {new Date(day).toDateString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            )}

            {/* ACTION */}
            <button
              disabled={!canCreate}
              className={`w-full p-2 mt-2 ${
                canCreate
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gray-600 cursor-not-allowed"
              }`}
              onClick={() => {
                createShift();
                setShowShiftsModal(false);
              }}
            >
              Create Shift
            </button>

          </div>
        </div>
      </div>
    )}

      {showDeletedModal && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/35 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-red-300">Shift Archive</p>
                <h2 className="text-lg font-semibold">Deleted Shifts</h2>
              </div>
              <button className="border border-white/10 px-3 py-2 text-sm hover:bg-white/10" onClick={() => setShowDeletedModal(false)}>
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              {deletedShifts.length === 0 ? (
                <p className="text-sm text-white/45">No deleted shifts.</p>
              ) : (
                <div className="space-y-3">
                  {deletedShifts.map((shift) => (
                    <div key={shift.shift_id} className="border border-white/10 bg-black/25 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{shift.officer.user.first_name} {shift.officer.user.last_name}</p>
                          <p className="mt-1 text-xs text-white/45">{formatDateTime(shift.start_time)} - {formatDateTime(shift.end_time)}</p>
                        </div>
                        <span className="border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">Deleted</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-white/60 md:grid-cols-3">
                        <p>Deleted by: <UserName userId={shift.deleted_by}/></p>
                        <p>Deleted at: {shift.deleted_at ? formatDateTime(shift.deleted_at) : "Unknown"}</p>
                        <p>Reason: {shift.shift_del_reason || "No reason provided"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showShiftsModal && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-red-300">Shift Scheduling</p>
                <h2 className="mt-1 text-xl font-semibold">Create Shift</h2>
                <p className="mt-1 text-sm text-white/50">Assign an officer to a planned 8, 10, or 12 hour duty window.</p>
              </div>
              <button type="button" onClick={() => setShowShiftsModal(false)} className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
                Close
              </button>
            </div>

            <div className="grid gap-4 overflow-y-auto p-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className={sectionClass}>
                  <h3 className="mb-3 text-sm font-semibold uppercase text-white/60">Officer</h3>
                  <label className="space-y-1">
                    <span className={labelClass}>Select Officer</span>
                    <select className={fieldClass} value={selectedOfficer} onChange={(e) => setSelectedOfficer(e.target.value)}>
                      <option value="">Select Officer</option>
                      {activeOfficers.map((officer) => (
                        <option key={officer.officer_id} value={officer.officer_id}>
                          {officer.user.first_name} {officer.user.last_name} - {officer.officer_id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className={sectionClass}>
                  <h3 className="mb-3 text-sm font-semibold uppercase text-white/60">Schedule Window</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className={labelClass}>Start Date</span>
                      <input type="date" className={fieldClass} value={startDate} onChange={(e) => { setStartDate(e.target.value); applyShiftDuration(e.target.value, startClock, shiftDurationHours); }} />
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>Start Time</span>
                      <input type="time" className={fieldClass} value={startClock} onChange={(e) => { setStartClock(e.target.value); applyShiftDuration(startDate, e.target.value, shiftDurationHours); }} />
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>Shift Length</span>
                      <select className={fieldClass} value={shiftDurationHours} onChange={(e) => { const value = Number(e.target.value) as 8 | 10 | 12; setShiftDurationHours(value); applyShiftDuration(startDate, startClock, value); }}>
                        <option value={8}>8 hours</option>
                        <option value={10}>10 hours</option>
                        <option value={12}>12 hours</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>End Date</span>
                      <input type="date" className={fieldClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </label>
                    <label className="space-y-1 md:col-span-2">
                      <span className={labelClass}>End Time</span>
                      <input type="time" className={fieldClass} value={endClock} onChange={(e) => setEndClock(e.target.value)} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className={sectionClass}>
                  <h3 className="mb-3 text-sm font-semibold uppercase text-white/60">Scheduled Camera</h3>
                  <p className="mb-3 text-xs text-white/45">Cameras can be shared by officers on separate duty windows. Availability is validated when the shift is saved.</p>
                  <select className={fieldClass} value={selectedCamera ?? ""} onChange={(e) => setSelectedCamera(e.target.value || null)}>
                    <option value="">No camera scheduled</option>
                    {cameras.filter((camera) => !["DAMAGED", "LOST", "INACTIVE"].includes(camera.status)).map((camera) => <option key={camera.camera_id} value={camera.camera_id}>{camera.serial_number} - {camera.model}</option>)}
                  </select>
                </div>

                {startDate && endDate && (
                  <div className={sectionClass}>
                    <h3 className="text-sm font-semibold uppercase text-white/60">Off Days</h3>
                    <p className="mt-1 text-xs text-white/45">Selected days are excluded from duty.</p>
                    <div className="mt-3 max-h-56 overflow-y-auto border border-white/10 p-2">
                      <div className="grid grid-cols-2 gap-2">
                        {getDaysBetween(startDate, endDate).map((day) => (
                          <button key={day} type="button" onClick={() => setOffDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])} className={`border p-2 text-xs ${offDays.includes(day) ? "border-red-500 bg-red-600/20 text-white" : "border-white/10 bg-gray-950 text-white/55"}`}>
                            {new Date(day).toDateString()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/35 px-6 py-4">
              <button type="button" className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10" onClick={() => setShowShiftsModal(false)}>
                Cancel
              </button>
              <button type="button" disabled={!canCreate} className={`px-4 py-2 text-sm font-semibold ${canCreate ? "bg-red-600 hover:bg-red-500" : "bg-gray-700 text-white/45"}`} onClick={() => void createShift()}>
                Create Shift
              </button>
            </div>
          </div>
        </div>
      )}
      {dialogElement}
    </div>
  );
}

import { useEffect, useState } from "react";
import axios from "axios";

export interface Shift {
  shift_id: string;
  officer_id: string;
  branch_id?: string | null;
  org_id?: string | null;
  camera_id?: string | null;

  start_time: string;
  end_time: string;

  status: "SCHEDULED" | "COMPLETED";

  off_days: string[];

  deleted: boolean;
  shift_del_reason?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

type UploadHandoverGuidance = {
  has_camera_handover: boolean;
  current_camera_serial?: string | null;
  current_shift_ends_at?: string;
  next_handover_at?: string;
  upload_reminder_at?: string;
  grace_minutes?: number;
  milliseconds_remaining?: number;
  reminder_due?: boolean;
};

type DailyShift = Shift & {
  shiftDate: Date;
  dailyStart: Date;
  dailyEnd: Date;
  dailyStatus: "SCHEDULED" | "COMPLETED" | "OFF";
};

const buildDailyShifts = (shifts: Shift[]): DailyShift[] => {
  const days: DailyShift[] = [];

  for (const shift of shifts) {
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while(current <= last) {
      const dateString = current.toLocaleDateString("en-CA");

      if(shift.off_days && shift.off_days.includes(dateString)) {
        days.push({
          ...shift,
          shiftDate:new Date(current),
          dailyStart: start,
          dailyEnd:end,
          dailyStatus:"OFF"
        });
      } else {
        days.push({
          ...shift,
          shiftDate:new Date(current),
          dailyStart: start,
          dailyEnd: end,
          dailyStatus:
            current < new Date()
            ? "COMPLETED"
            : "SCHEDULED"
        });
      }

      current.setDate(current.getDate()+1);
    }
  }

  return days.sort((a, b) => b.shiftDate.getTime() - a.shiftDate.getTime());
};

const groupShifts = (shifts: DailyShift[]) => {
  const groups: Record<string, DailyShift[]> = {};

  shifts.forEach((shift) => {

    const key =
      `${new Date(shift.start_time).toDateString()} _to_ ${new Date(shift.end_time).toDateString()}`;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(shift);

  });


  return Object.entries(groups).map(([range, shifts]) => ({
    range,
    shifts
  }));

};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export default function OfficerShifts() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [handover, setHandover] = useState<UploadHandoverGuidance | null>(null);

  const [expandedShift, setExpandedShift] = useState<string | null>(null);

  /* ---------------- FETCH SHIFTS ---------------- */
  const fetchShifts = async () => {
    try {
      const res = await axios.get(`${API_URL}/shift`, {
        withCredentials: true,
      });
      // Sort by start_time descending to show previous first
      setShifts(res.data.sort((a: Shift, b: Shift) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchShifts();
  }, []);

  useEffect(() => {
    const loadHandover = async () => {
      try {
        const response = await axios.get<UploadHandoverGuidance>(
          `${API_URL}/shift/officer/upload-handover-guidance`,
          { withCredentials: true },
        );
        setHandover(response.data);
      } catch {
        setHandover(null);
      }
    };
    void loadHandover();
    const timer = window.setInterval(() => void loadHandover(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /* ---------------- CLOCK REFRESHING ---------------- */
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  /* ---------------- TODAY SHIFT ---------------- */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyShifts = buildDailyShifts(shifts);

  const todayShift = dailyShifts.find((shift) => {
    return shift.shiftDate.toDateString() === now.toDateString();
  });

  const shiftHistory = dailyShifts;

  const groupedShifts = groupShifts(shiftHistory);


  /* ---------------- UI ---------------- */
  if (loading) return <div className="p-4 text-gray-400">Loading schedule...</div>;

  return (
    <div className="flex flex-col h-full bg-body-black text-white border border-gray-700">
      <div className="p-4 border-b border-gray-700 font-semibold">Shift Schedule</div>

      {/* TODAY SHIFT */}
      <section className="p-4 border-b border-gray-700">
        <h3 className="font-semibold underline mb-2">Today's Schedule</h3>

        {!todayShift ? (
          <p className="text-gray-400">No shift scheduled for today</p>
        ) : (
          <div>
            <p className="text-gray-300">
              You are scheduled from{" "}
              <span className="text-white">
                {todayShift.dailyStart.toLocaleTimeString()}
              </span>{" "}
              to{" "}
              <span className="text-white">
                {todayShift.dailyEnd.toLocaleTimeString()}
              </span>
            </p>

            <p className="text-xs text-gray-400 mt-2">
              Status: Scheduled duty shift
            </p>
          </div>
        )}
      </section>

      {handover?.has_camera_handover && handover.next_handover_at && (
        <section className={`mx-4 mb-4 border p-4 ${handover.reminder_due ? "border-amber-400/60 bg-amber-500/10" : "border-sky-400/35 bg-sky-500/10"}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Camera handover reminder</p>
          <h3 className="mt-1 font-semibold">Scheduled camera custody changes at the exact handover time below.</h3>
          <p className="mt-2 text-sm text-white/70">
            Camera {handover.current_camera_serial ?? "assigned camera"} is scheduled to transfer at exactly {new Date(handover.next_handover_at).toLocaleString()} when the next consecutive shift begins.
          </p>
          <p className={`mt-2 text-sm font-semibold ${handover.reminder_due ? "text-amber-200" : "text-sky-200"}`}>
            {Math.ceil((handover.milliseconds_remaining ?? 0) / 60_000)} minutes remain. Reminder window: {handover.grace_minutes ?? 30} minutes before handover.
          </p>
        </section>
      )}

    
      {/* ---------------- SHIFT SCHEDULE TABLE ---------------- */}
      <section className="p-4">
        <h3 className="font-semibold underline mb-2">
          Upcoming & Previous Shifts
        </h3>

        {/* Main container */}
        <div className="border border-gray-700">

          {/* Scroll container - keeps the table compact */}
          <div className="max-h-64 overflow-y-auto">

            {/* 
              Loop through grouped shifts.
              Each group represents one scheduled period:
              Example:
              21 October - 28 October
            */}
            {groupedShifts.map((group) => (

              <div key={group.range}>

                {/* 
                  Expand / collapse dropdown header
                  Shows the date range of the shift
                */}
                <div onClick={() =>setExpandedShift(expandedShift === group.range ? null : group.range)}
                  className="p-3 bg-gray-900 cursor-pointer hover:bg-gray-800 border-b border-gray-700 font-semibold">
                  <p className="text-xs text-gray-400 mb-3">
                    Red highlighted days mean you are not scheduled to work.
                  </p>

                  {/* Dropdown indicator */}
                  {expandedShift === group.range ? "▼" : "▶️"}

                  {" "}

                  {/* Shift date range */}
                  {group.range}
                </div>

                {/* 
                  Only display the table when
                  this shift group is expanded
                */}
                {expandedShift === group.range && (
                  
                  <table className="w-full text-sm">
                    {/* Table headings */}
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="p-2 text-left">
                          Date
                        </th>

                        <th className="p-2 text-left">
                          Start
                        </th>
                        <th className="p-2 text-left">
                          End
                        </th>

                        <th className="p-2 text-left">
                          Status
                        </th>
                      </tr>
                    </thead>

                    {/* 
                      Daily shifts inside this schedule.
                      Example:
                      21 Oct
                      22 Oct
                      23 Oct
                      ...
                    */}
                    <tbody>
                      {group.shifts.map((shift) => (
                        <tr
                          key={`${shift.shift_id}-${shift.shiftDate.toISOString()}`}
                          className={`border-t border-gray-800 text-left ${shift.dailyStatus === "OFF" ? "bg-red-900 text-red-300" : ""}`}>
                          {/* Shift date */}
                          <td className="p-2">
                            {shift.shiftDate.toDateString()}
                          </td>

                          {/* Shift start time */}
                          <td className="p-2">
                            {shift.dailyStart.toLocaleTimeString()}
                          </td>

                          {/* Shift end time */}
                          <td className="p-2">
                            {shift.dailyEnd.toLocaleTimeString()}
                          </td>

                          {/* Scheduled / Completed */}
                          <td className="p-2">
                            {shift.dailyStatus}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

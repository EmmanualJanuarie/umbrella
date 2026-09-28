import { useState } from "react";
import type { User } from "../../../data/types";

interface DisableUserModalProps {
  user: User;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export default function DisableUserModal({
  user,
  onClose,
  onSubmit,
}: DisableUserModalProps) {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const finalReason = reason === "OTHER" ? customReason.trim() : reason;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.18em] text-red-300">Disable User</p>
            <h2 className="mt-1 text-xl font-semibold">{user.first_name} {user.last_name}</h2>
            <p className="mt-1 text-sm text-white/55">{user.email}</p>
          </div>
          <span className="border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs text-red-200">
            ACCESS CHANGE
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <section className="border border-white/10 bg-white/[0.03] p-4">
            <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">
              User Record
            </h3>
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="border-b border-white/10 pb-3">
                <dt className="text-xs uppercase text-white/40">Email</dt>
                <dd className="mt-1 break-words text-sm text-white/85">{user.email}</dd>
              </div>
              <div className="border-b border-white/10 pb-3">
                <dt className="text-xs uppercase text-white/40">Role</dt>
                <dd className="mt-1 text-sm text-white/85">{user.role}</dd>
              </div>
            </dl>
          </section>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-white/80">
            Disable Reason
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-12 w-full border border-white/15 bg-black/40 px-4 text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            >
              <option value="">Select Reason</option>
              <option value="RESIGNED">Resigned</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
              <option value="INVESTIGATION">Under Investigation</option>
              <option value="SECURITY_RISK">Security Risk</option>
              <option value="LICENSE_EXPIRED">License Expired</option>
              <option value="LEAVE_OF_ABSENCE">Leave of Absence</option>
              <option value="ADMIN_ACTION">Administrative Action</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          {reason === "OTHER" && (
            <label className="mt-4 grid gap-2 text-sm font-semibold text-white/80">
              Custom Reason
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter custom reason..."
                className="h-12 w-full border border-white/15 bg-black/40 px-4 text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
              />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 bg-black/25 px-6 py-4">
          <button onClick={onClose} className="border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10">
            Cancel
          </button>
          <button
            disabled={!finalReason}
            onClick={() => onSubmit(finalReason)}
            className="bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Disable User
          </button>
        </div>
      </div>
    </div>
  );
}

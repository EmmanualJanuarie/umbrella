import { useState } from "react";
import type { User } from "../../../data/types";

interface DeleteUserModalProps {
  user: User;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export default function DeleteUserModal({
  user,
  onClose,
  onSubmit,
}: DeleteUserModalProps) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.18em] text-red-300">Delete User</p>
            <h2 className="mt-1 text-xl font-semibold">
              {user.first_name} {user.last_name}
            </h2>
            <p className="mt-1 text-sm text-white/55">{user.email}</p>
          </div>
          <button onClick={onClose} className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <section className="border border-red-500/25 bg-red-500/5 p-4">
            <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">
              Permanent Action
            </h3>
            <p className="mt-4 text-sm leading-6 text-white/70">
              This will remove the user from active system use. Provide a clear reason for audit records.
            </p>
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="border-b border-white/10 pb-3">
                <dt className="text-xs uppercase text-white/40">User ID</dt>
                <dd className="mt-1 break-all text-xs text-white/70">{user.user_id}</dd>
              </div>
              <div className="border-b border-white/10 pb-3">
                <dt className="text-xs uppercase text-white/40">Role</dt>
                <dd className="mt-1 text-sm text-white/85">{user.role}</dd>
              </div>
            </dl>
          </section>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-white/80">
            Delete Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Enter the reason for deleting this user..."
              rows={5}
              className="min-h-32 w-full resize-none border border-white/15 bg-black/40 p-4 text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 bg-black/25 px-6 py-4">
          <button type="button" onClick={onClose} className="border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10">
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => onSubmit(reason.trim())}
            className="bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete User
          </button>
        </div>
      </div>
    </div>
  );
}

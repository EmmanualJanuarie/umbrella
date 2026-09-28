import { useEffect, useState, type MouseEvent } from "react";
import axios from "axios";
// adjust import path
import { type RequestStatus } from "../../data/types";
import { useActionDialog } from "../../components/modals/ActionDialog";

const runAction = async (action: () => Promise<unknown>, options?: unknown) => {
  void options;
  await action();
};

type PasswordChangeRequestWithRelations = {
  request_id: string;
  requested_by: string;
  branch_id?: string;
  org_id: string;
  status: RequestStatus;
  created_at: string;
  handled_at?: string;
  requester_note?: string;
      handler_note?: string;
  requester: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    branch?: { name: string };
    organization?: { name: string };
  };
  handler?: {
    user_id: string;
    first_name: string;
    last_name: string;
  };
};

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function statusClass(status: RequestStatus) {
  if (status === "APPROVED") return "border-green-500/40 bg-green-500/10 text-green-200";
  if (status === "REJECTED") return "border-red-500/40 bg-red-500/10 text-red-200";
  return "border-yellow-500/40 bg-yellow-500/10 text-yellow-100";
}

function DetailSection({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <section className="border border-white/10 bg-white/[0.03] p-4">
      <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">
        {title}
      </h3>
      <dl className="mt-4 space-y-3">
        {items.map(([label, value]) => (
          <div key={label} className="border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
            <dt className="text-xs uppercase text-white/40">{label}</dt>
            <dd className="mt-1 break-words text-sm text-white/85">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function PasswordChangeRequests() {
  const [selectedTab, setSelectedTab] = useState<"REQUESTED" | "COMPLETED">("REQUESTED");
  const [selectedRequest, setSelectedRequest] = useState<PasswordChangeRequestWithRelations | null>(null);
  const [requests, setRequests] = useState<PasswordChangeRequestWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [showPasswordChangeRequestModal, setShowPasswordChangeRequestModal] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
  const { dialogElement, promptAction } = useActionDialog();

  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/password-change-request/all`, {
          withCredentials: true,
          params: { search: searchTerm, tab: selectedTab },
        });
        setRequests(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load password change requests", err);
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = window.setTimeout(() => {
      void loadRequests();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [API_URL, refreshTick, searchTerm, selectedTab]);

  // Filtered requests based on tab
  const filteredRequests = requests;

  // Handle status updates
const handleStatusChange = async (
  request: PasswordChangeRequestWithRelations,
  status: "APPROVED" | "REJECTED"
) => {
 runAction(async () => {
   // Prompt for reason/note
  const note = await promptAction({
    title: `${status === "APPROVED" ? "Approve" : "Reject"} Password Change`,
    message: `Please enter a reason for marking this request as ${status.toLowerCase()}.`,
    placeholder: request.handler_note ?? "Handler note",
    confirmLabel: status === "APPROVED" ? "Approve Request" : "Reject Request",
    tone: status === "APPROVED" ? "success" : "danger",
    required: true,
  });

  if (note === null) {
    // User cancelled the prompt
    return;
  }

  //UPDATE UI IMMEDIATELY
  setRequests(prev => 
    prev.map(r =>
      r.request_id === request.request_id
      ? { ...r, status: status }
      : r
    )
  );

  try {
    const res = await axios.patch(
      `${API_URL}/password-change-request/${request.request_id}/handle`,
      { status, handler_note: note },
      { withCredentials: true }
    );

  const updated = res.data;

   // Correct ID field
    setRequests((prev) =>
      prev.map((r) =>
        r.request_id === request.request_id ? updated : r
      )
    );

    if (status === "APPROVED" || status === "REJECTED") setSelectedRequest(null);
  } catch (err) {
    console.error("Failed to update request", err);
  }
 },
  {});
};

const openRequestDetails = async (
  request: PasswordChangeRequestWithRelations,
  event: MouseEvent<HTMLTableRowElement>,
) => {
  const target = event.target as HTMLElement;
  if (target.closest("[data-row-action], button, select, option, input, textarea, a")) {
    return;
  }

  setSelectedRequest(request);
  setShowPasswordChangeRequestModal(true);

  try {
    await axios.post(
      `${API_URL}/password-change-request/access/password-request/request/click`,
      { request_id: request.request_id },
      { withCredentials: true },
    );
  } catch (err) {
    console.error("Failed to log password request click", err);
  }
};

  return (
    <div className="flex flex-col h-full w-full p-4 gap-4 bg-body-black text-white border border-gray-700">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 ${selectedTab === "REQUESTED" ? "bg-gray-900" : "bg-gray-800"}`}
          onClick={() => setSelectedTab("REQUESTED")}
        >
          Requested / In Progress
        </button>
        <button
          className={`px-4 py-2 ${selectedTab === "COMPLETED" ? "bg-gray-900" : "bg-gray-800"}`}
          onClick={() => setSelectedTab("COMPLETED")}
        >
          Completed
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-2">
        <input
          type="text"
          placeholder="Search by Ticket ID, email, branch, or organization..."
          className="bg-gray-800 text-white p-2 mb-2 border border-gray-700 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Requests Table */}
      <div className="flex items-center justify-between border border-gray-700 border-b-0 bg-black/20 px-3 py-2">
        <h3 className="text-sm font-semibold">Password Change Requests</h3>
        <button
          onClick={() => setRefreshTick((tick) => tick + 1)}
          disabled={loading}
          className="border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <div className="border border-gray-700 overflow-y-auto max-h-80">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-900 sticky top-0">
            <tr>
              <th className="p-2">Ticket ID</th>
              <th className="p-2">Requester Email</th>
              <th className="p-2">Branch</th>
              <th className="p-2">Organization</th>
              <th className="p-2">Status</th>
              <th className="p-2">Requested By</th>
              <th className="p-2">Handled By</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400">
                  {loading ? "Loading..." : "No requests found"}
                </td>
              </tr>
            ) : (
              filteredRequests.map(r => (
                <tr
                  key={r.request_id}
                  onClick={(event) => void openRequestDetails(r, event)}
                  className={`border-b border-gray-700 cursor-pointer hover:bg-gray-800 ${selectedRequest?.request_id === r.request_id ? "bg-gray-900" : ""}`}
                >
                  <td className="p-2">{r.request_id}</td>
                  <td className="p-2">{r.requester?.email ?? "N/A"}</td>
                  <td className="p-2">{r.requester?.branch?.name ?? "N/A"}</td>
                  <td className="p-2">{r.requester?.organization?.name ?? "N/A"}</td>
                  <td className="p-2">
                      {r.status === "PENDING" ? (
                        <select
                          data-row-action
                          className="bg-gray-800 text-white p-2"
                          value={r.status}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newStatus = e.target.value as "APPROVED" | "REJECTED";
                            handleStatusChange(r, newStatus);
                          }}
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="APPROVED">APPROVE</option>
                          <option value="REJECTED">REJECT</option>
                        </select>
                      ) : (
                        <span style={{ color:
                            r.status === 'APPROVED' ? '#22c55e' :
                            r.status === 'REJECTED' ? '#ef4444' : '#4b5563'
                          }}>{r.status}
                        </span>
                      )}
                    </td>

                   <td className="p-2">{r.requester?.first_name ?? "No"} {r.requester?.last_name ?? "Name"}</td>
                   <td className="p-2">{r.handler?.first_name ?? "No"} {r.handler?.last_name ?? "Name"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 text-sm text-gray-400 text-center">
        {!showPasswordChangeRequestModal && (
          <p>Click a password change request to view additional details.</p>
        )}
      </div>

      {showPasswordChangeRequestModal && selectedRequest && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.18em] text-red-300">
                  Password Request
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {selectedRequest.requester?.first_name ?? "Unknown"} {selectedRequest.requester?.last_name ?? "User"}
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  {selectedRequest.requester?.email ?? "No email"} / {selectedRequest.request_id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`border px-3 py-1 text-xs ${statusClass(selectedRequest.status)}`}>
                  {selectedRequest.status}
                </span>
                <button
                  onClick={() => setShowPasswordChangeRequestModal(false)}
                  className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <DetailSection
                  title="Request Details"
                  items={[
                    ["Ticket ID", selectedRequest.request_id],
                    ["Status", selectedRequest.status],
                    ["Created", formatDateTime(selectedRequest.created_at)],
                    [
                      "Handled",
                      selectedRequest.handled_at
                        ? formatDateTime(selectedRequest.handled_at)
                        : "Still pending",
                    ],
                  ]}
                />

                <DetailSection
                  title="Requester"
                  items={[
                    [
                      "Name",
                      `${selectedRequest.requester?.first_name ?? "No"} ${selectedRequest.requester?.last_name ?? "Name"}`,
                    ],
                    ["Email", selectedRequest.requester?.email ?? "No email"],
                    ["Branch", selectedRequest.requester?.branch?.name ?? "No branch"],
                    [
                      "Organization",
                      selectedRequest.requester?.organization?.name ?? "No organization",
                    ],
                  ]}
                />
              </div>

              <section className="mt-4 border border-white/10 bg-white/[0.03] p-4">
                <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">
                  Notes
                </h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="border border-white/10 bg-black/25 p-3">
                    <p className="text-xs uppercase text-white/40">Requester note</p>
                    <p className="mt-2 text-sm leading-6 text-white/80">
                      {selectedRequest.requester_note ?? "No note provided"}
                    </p>
                  </div>
                  <div className="border border-white/10 bg-black/25 p-3">
                    <p className="text-xs uppercase text-white/40">Handler note</p>
                    <p className="mt-2 text-sm leading-6 text-white/80">
                      {selectedRequest.handler_note ?? "No note provided"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-4 border border-white/10 bg-black/25 p-4">
                <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">
                  Handling Reference
                </h3>
                <dl className="mt-4 grid gap-3 md:grid-cols-2">
                  {[
                    ["Handled by", selectedRequest.handler ? `${selectedRequest.handler.first_name} ${selectedRequest.handler.last_name}` : "Not handled yet"],
                    ["Handler user ID", selectedRequest.handler?.user_id ?? "Not handled yet"],
                    ["Requester user ID", selectedRequest.requested_by],
                    ["Organization ID", selectedRequest.org_id],
                    ["Branch ID", selectedRequest.branch_id ?? "No branch"],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-white/10 pb-3">
                      <dt className="text-xs uppercase text-white/40">{label}</dt>
                      <dd className="mt-1 break-all text-xs text-white/70">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Request Details Panel */}
      {showPasswordChangeRequestModal && selectedRequest && false && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 w-[90%] max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

            {/* HEADER */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
              <h2 className="text-lg font-semibold text-white">Password Change Request</h2>
              <button
                onClick={() => setShowPasswordChangeRequestModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="p-4 overflow-y-auto text-sm max-h-[80vh] space-y-4">

              {/* Request Details */}
              <div>
                <h3 className="font-semibold underline mb-2 text-left">Request Details</h3>
                <span className="text-left">
                  <p><strong>Ticket ID:</strong> {selectedRequest!.request_id}</p>
                  <p><strong>Status:</strong> {selectedRequest!.status}</p>
                  <p><strong>Created At:</strong> {new Date(selectedRequest!.created_at).toLocaleString()}</p>
                  <p><strong>Handled At:</strong> {selectedRequest!.handled_at ? new Date(selectedRequest!.handled_at!).toLocaleString() : "Still Pending"}</p>
                  <p><strong>Requester Note:</strong> {selectedRequest!.requester_note ?? "No note provided"}</p>
                  <p><strong>Handler Note:</strong> {selectedRequest!.handler_note ?? "No note provided"}</p>
                </span>
              </div>

              {/* Requester Info */}
              <div>
                <h4 className="font-semibold underline mt-2 mb-1 text-left">Requester Info</h4>
                {selectedRequest!.requester ? (
                  <span className="text-left">
                    <p><strong>Email:</strong> {selectedRequest!.requester.email ?? "No Email"}</p>
                    <p><strong>Branch:</strong> {selectedRequest!.requester.branch?.name ?? "No Branch Name"}</p>
                    <p><strong>Organization:</strong> {selectedRequest!.requester.organization?.name ?? "No Organization Name"}</p>
                  </span>
                ) : <p>N/A</p>}
              </div>

              {/* Handler Info */}
              {selectedRequest!.handler && (
                <div>
                  <h4 className="font-semibold underline mt-2 mb-1 text-left">Handled By</h4>
                  <span className="text-left">
                    <p><strong>Name:</strong> {selectedRequest!.handler?.first_name} {selectedRequest!.handler?.last_name}</p>
                    <p><strong>User ID:</strong> {selectedRequest!.handler?.user_id}</p>
                  </span>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {dialogElement}
    </div>
  );
}

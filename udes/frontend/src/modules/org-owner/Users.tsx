import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Branch, User, UserStatusHistory } from "../../data/types";
import axios from "axios";
import { UserName } from "../../components/helpers/UserName";
import { BranchLocation } from "../../components/helpers/BranchLocation";
import { AssignBranchModal } from "./modals/AssignBranchModal";
import { useUser } from "../../context/UserContext";

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState("");

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [, setIsSearching] = useState(false);

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);

  const openBranchModal = () => setIsBranchModalOpen(true);
  const closeBranchModal = () => setIsBranchModalOpen(false);

  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<UserStatusHistory[]>([]);


  const { user: currentUser } = useUser();

  const canAssignBranch =
    currentUser?.role === "ORG_OWNER" || currentUser?.role === "SUPER_ADMIN";

  const fetchUsers = useCallback(async (
    searchValue = deferredSearch,
    branchId = selectedBranchId,
    showLoading = true,
  ) => {
    try {
      if (showLoading) setLoading(true);
      setIsSearching(true);

      const res = await axios.get(`${API_URL}/user`, {
        withCredentials: true,
        params: {
          search: searchValue,
          branchId: branchId || undefined,
        },
      });

      const nextUsers = Array.isArray(res.data) ? res.data : [];
      setUsers(nextUsers);
      return nextUsers;
    } catch (err) {
      console.error("Search failed", err);
      setUsers([]);
      return [];
    } finally {
      if (showLoading) setLoading(false);
      setIsSearching(false);
    }
  }, [API_URL, deferredSearch, selectedBranchId]);

 /* ================= FETCH USERS ================= */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchUsers(deferredSearch, selectedBranchId, true);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [deferredSearch, fetchUsers, selectedBranchId]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await axios.get(`${API_URL}/branches`, { withCredentials: true });
        setBranches(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch branches", err);
      }
    };

    void fetchBranches();
  }, [API_URL]);

  const onBranchAssigned = async () => {
    setLoading(true);

    try {
      const updatedUsers = await fetchUsers(deferredSearch, selectedBranchId, false);

      if (selectedUser) {
        const updatedSelectedUser = updatedUsers.find(
          (u) => u.user_id === selectedUser.user_id,
        );

        if (updatedSelectedUser) setSelectedUser(updatedSelectedUser);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase();

    return users.filter((u) =>
      u.user_id.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term) ||
      (u.branch?.name.toLowerCase().includes(term) ?? false) ||
      (u.organization?.name.toLowerCase().includes(term) ?? false)
    );
  }, [search, users]);

  /* ---------------- UI ---------------- */
  return (
    <div className="h-full w-full bg-body-black text-white border border-gray-700">
      
      {/* LEFT — USERS TABLE */}
      <div className="w-full border-r border-gray-700 flex flex-col overflow-y-auto max-h-96">
        <div className="p-3 border-b border-gray-700 flex flex-wrap justify-between items-center gap-3">
          <h2 className="font-semibold">
            User Registry — All Branches
          </h2>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-black border border-gray-700 px-3 py-1 text-sm"
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.branch_id} value={branch.branch_id}>{branch.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search users, roles, branches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-black border border-gray-700 px-3 py-1 text-sm w-72"
          />
          <button
            onClick={() => void fetchUsers(deferredSearch, selectedBranchId)}
            disabled={loading}
            className="border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-center text-gray-400">
              Loading users...
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900 sticky top-0">
                <tr>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Branch</th>
                  <th className="p-2">Organization</th>
                  <th className="p-2">Officer</th>
                  <th className="p-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const officer = u.officers;

                    return (
                      <tr
                        key={u.user_id}
                        onClick={async () => {
                          setSelectedUser(u)
                          setShowUsersModal(true);
                          
                          // Log the user click
                          try {
                            await axios.post(
                              `${API_URL}/user/access/user/click`,
                              {
                                user_id: u.user_id, // clicked user
                              },
                              { withCredentials: true }
                            );
                          } catch (err) {
                            console.error("Failed to log user click", err);
                          }

                        }}
                        className={`border-b border-gray-700 cursor-pointer hover:bg-gray-800 ${
                          selectedUser?.user_id === u.user_id
                            ? "bg-gray-900"
                            : ""
                        }`}
                      >
                        <td className="p-2">{u.email}</td>
                        <td className="p-2">{u.role}</td>
                        <td className="p-2">{u.branch?.name ?? "N/A"}</td>
                        <td className="p-2">{u.organization?.name ?? "N/A"}</td>
                        <td className="p-2">{officer ? "YES" : "NO"}</td>
                        <td className="p-2">
                          {`${new Date(u.created_at).toDateString()}, ${new Date(u.created_at).toLocaleTimeString()}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="p-3 text-sm text-gray-400 text-center">
        {!showUsersModal && (
          <p>Select a user field to view operational data.</p>
        )}
      </div>

      {/* USER MODAL */}
      <>
          {showUsersModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
                <div className="text-left">
                  <p className="text-xs uppercase tracking-[0.18em] text-red-300">User Record</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">
                    <UserName userId={selectedUser.user_id}/>
                  </h2>
                  <p className="mt-1 text-sm text-white/55">{selectedUser.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`border px-3 py-1 text-xs ${selectedUser.active === false ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-green-500/40 bg-green-500/10 text-green-200"}`}>
                    {selectedUser.active === false ? "DISABLED" : "ACTIVE"}
                  </span>
                  <button onClick={() => setShowUsersModal(false)} className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
                    Close
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="border border-white/10 bg-white/[0.03] p-4">
                    <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Identity</h3>
                    <dl className="mt-4 space-y-3">
                      {[
                        ["Email", selectedUser.email],
                        ["Role", selectedUser.role],
                        ["Branch", selectedUser.branch?.name ?? "N/A"],
                        ["Location", selectedUser.branch_id ? <BranchLocation branchId={selectedUser.branch_id}/> : "N/A"],
                      ].map(([label, value]) => (
                        <div key={label as string} className="border-b border-white/10 pb-3">
                          <dt className="text-xs uppercase text-white/40">{label as string}</dt>
                          <dd className="mt-1 break-words text-sm text-white/85">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="border border-white/10 bg-white/[0.03] p-4">
                    <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Officer Profile</h3>
                    {selectedUser.officers ? (
                      <dl className="mt-4 space-y-3">
                        {[
                          ["Officer ID", selectedUser.officers.officer_id],
                          ["Badge number", selectedUser.officers.badge_number ?? "N/A"],
                          ["Department", selectedUser.officers.department ?? "N/A"],
                          ["Officer status", selectedUser.officers.status ?? "N/A"],
                          ["Active camera", selectedUser.officers.cameras?.[0]?.serial_number ?? "None"],
                        ].map(([label, value]) => (
                          <div key={label} className="border-b border-white/10 pb-3">
                            <dt className="text-xs uppercase text-white/40">{label}</dt>
                            <dd className="mt-1 break-words text-sm text-white/85">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-4 text-sm text-white/45">This user does not have an officer profile.</p>
                    )}
                  </section>
                </div>

                <section className="mt-4 border border-white/10 bg-black/25 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <h3 className="text-sm font-semibold uppercase text-white/60">Account Actions</h3>
                    <button
                      onClick={async () => {
                        setShowHistoryModal(true);
                        const res = await axios.get(`${API_URL}/user/${selectedUser.user_id}/status-history`, { withCredentials: true });
                        setHistory(res.data);
                      }}
                      className="border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                    >
                      View Status History
                    </button>
                  </div>
                  {canAssignBranch && (
                    <button onClick={openBranchModal} className="mt-4 border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/10">
                      {selectedUser.branch_id ? "Reassign Branch" : "Assign Branch"}
                    </button>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}
          {showUsersModal && selectedUser && false && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 overflow-y-auto pt-10">
            <div className="bg-gray-900 border border-gray-700 w-[90%] max-w-2xl p-6 relative">

              {/* HEADER */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-white">
                    User Intelligence
                  </h2>
                </div>

                <button
                  onClick={() => setShowUsersModal(false)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col space-y-2 text-sm overflow-y-auto max-h-[32rem]">

                <p>
                  <strong>User Name:</strong>{" "}
                  <UserName userId={selectedUser?.user_id ?? ""}/>
                </p>
                <p><strong>Email:</strong> {selectedUser?.email}</p>
                <p><strong>Role:</strong> {selectedUser?.role}</p>

                <div className="pt-2 border-t border-gray-700" />

                <p><strong>Branch:</strong> {selectedUser?.branch?.name ?? "N/A"}</p>
                <p>
                  <strong>Location:</strong> <BranchLocation branchId={selectedUser?.branch_id}/>
                </p>

                {/* ASSIGN BRANCH BUTTON */}
                <div>
                  {canAssignBranch && (
                  <button
                    onClick={openBranchModal}
                    className="mt-2 px-3 py-1 border text-white text-sm w-3/12"
                  >
                    {selectedUser?.branch_id ? "Reassign Branch" : "Assign Branch"}
                  </button>
                )}
                </div>

                <div className="pt-2 border-t border-gray-700" />

                <p>
                  <strong className="underline">Officer Profile</strong>
                </p>

                {selectedUser?.officers && (
                  <>
                    <p><strong>Badge Number:</strong> {selectedUser?.officers?.badge_number ?? "N/A"}</p>
                    <p><strong>Department:</strong> {selectedUser?.officers?.department ?? "N/A"}</p>
                    <p>
                      <strong>Status:</strong>{" "}
                      <span style={{ color:
                        selectedUser?.officers?.status === 'ACTIVE' ? '#22c55e' :
                        selectedUser?.officers?.status === 'INACTIVE' ? '#FF9800' : '#4b5563'
                      }}>
                        {selectedUser?.officers?.status ?? "N/A"}
                      </span>
                    </p>
                    <p>
                      <strong>Active Camera:</strong> {selectedUser?.officers?.cameras?.[0]?.serial_number ?? "NONE"}
                    </p>

                    <p>
                      <strong>User Disabled:</strong>{" "}
                      {selectedUser?.active === false
                        ? <span className="text-red-500">Yes</span>
                        : <span className="text-green-500">No</span>}
                    </p>

                    <p>
                      <button
                          onClick={async () => {
                            setShowHistoryModal(true);

                            const res = await axios.get(
                              `${API_URL}/user/${selectedUser?.user_id ?? ""}/status-history`,
                              { withCredentials: true }
                            );

                            setHistory(res.data);
                          }}
                          className="mt-2 px-3 py-1 border text-white text-sm w-3/12"
                        >
                          View Account Activation History
                      </button>
                    </p>
                  </>

                  
                )}
              </div>
            </div>
          </div>
        )}
      </>

      {/* ASSIGN BRANCH MODAL */}
      <AssignBranchModal 
        userId={selectedUser?.user_id ?? ""}
        isOpen={isBranchModalOpen}
        onClose={closeBranchModal}
        onAssigned={onBranchAssigned}
      />


      {/* ENABLE & DISABLE USER HISTORY */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          
          <div className="bg-gray-900 border border-gray-700 w-[500px]  overflow-y-auto p-4 max-h-90">

            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">Account History</h2>

              <button onClick={() => setShowHistoryModal(false)}>
                ✕
              </button>
            </div>

            {history.length === 0 ? (
              <p className="text-gray-400">No history found</p>
            ) : (
              history.map((h) => (
                <div
                  key={h.history_id}
                  className="border-b border-gray-700 py-2 text-sm text-left"
                >
                  <p>
                    <strong>Action:</strong>{" "}
                    {h.action === "DISABLED" ? "Disabled" : "Enabled"}
                  </p>

                  <p>
                    <strong>Reason:</strong> {h.reason || "N/A"}
                  </p>

                  <p>
                    <strong>Date:</strong>{" "}
                    {new Date(h.created_at).toLocaleString()}
                  </p>

                  <p>
                   <strong>By:</strong>{" "}
                    {h.performer?.first_name
                      ? `${h.performer.first_name} ${h.performer.last_name}`
                      : h.performed_by}
                  </p>
                </div>
              ))
            )}

          </div>
        </div>
      )}
    </div>
  );
}

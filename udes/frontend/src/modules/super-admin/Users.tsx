import { useCallback, useMemo, useState } from "react";
import { OFFICER_STATUS } from "../../data/types";
import axios from "axios";
import { useEffect } from "react";
import type {Organization, Branch, User, Camera, UserStatusHistory } from "../../data/types";
import UpdateUserModal from "./modals/UpdateUserModal";
import DisableUserModal from "./modals/DisableUserModal";
import EnableUserModal from "./modals/EnableUserModal";
import DeleteUserModal from "./modals/DeleteUserModal";

const runAction = async (action: () => Promise<unknown>, options?: unknown) => {
  void options;
  await action();
};

type UserDetailsModalProps = {
  user: User;
  cameras: Camera[];
  getUserName: (user: User) => string;
  getOrgNameByUser: (orgId: string) => string;
  getBranchName: (branchId: string) => string;
  onClose: () => void;
  onLoadHistory: () => Promise<void>;
};

function UserDetailsModal({
  user,
  cameras,
  getUserName,
  getOrgNameByUser,
  getBranchName,
  onClose,
  onLoadHistory,
}: UserDetailsModalProps) {
  const officer = user.officers;
  const assignedCameras = cameras.filter((camera) => camera.assigned_to === officer?.officer_id);
  const isActive = user.active !== false && !user.deleted_at;

  const identityItems = [
    ["Full name", getUserName(user)],
    ["Email", user.email],
    ["Role", user.role],
    ["Officer ID", officer?.officer_id ?? "Not applicable"],
    ["Badge number", officer?.badge_number ?? "Not applicable"],
    ["Department", officer?.department ?? "Not assigned"],
  ];

  const assignmentItems = [
    ["Organization", user.organization?.name ?? getOrgNameByUser(user.org_id)],
    ["Branch", user.branch?.name ?? (user.branch_id ? getBranchName(user.branch_id) : "Not assigned")],
    ["Officer status", officer?.status ?? "Not an officer"],
    ["Cameras assigned", String(assignedCameras.length)],
  ];

  const auditItems = [
    ["User ID", user.user_id],
    ["Organization ID", user.org_id],
    ["Branch ID", user.branch_id ?? "Not assigned"],
    ["Created", user.created_at ? new Date(user.created_at).toLocaleString() : "Not recorded"],
    ["Deleted", user.deleted_at ? new Date(user.deleted_at).toLocaleString() : "No"],
    ["Delete reason", user.user_del_reason ?? "None"],
  ];

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.18em] text-red-300">User Record</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{getUserName(user)}</h2>
            <p className="mt-1 text-sm text-white/55">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`border px-3 py-1 text-xs ${isActive ? "border-green-500/40 bg-green-500/10 text-green-200" : "border-red-500/40 bg-red-500/10 text-red-200"}`}>
              {isActive ? "ACTIVE" : "DISABLED"}
            </span>
            <button onClick={onClose} className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {[["Identity", identityItems], ["Authority & Assignment", assignmentItems]].map(([title, items]) => (
              <section key={title as string} className="border border-white/10 bg-white/[0.03] p-4">
                <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">{title as string}</h3>
                <dl className="mt-4 space-y-3">
                  {(items as string[][]).map(([label, value]) => (
                    <div key={label} className="border-b border-white/10 pb-3">
                      <dt className="text-xs uppercase text-white/40">{label}</dt>
                      <dd className="mt-1 break-words text-sm text-white/85">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <section className="mt-4 border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold uppercase text-white/60">Assigned Evidence Devices</h3>
              <button onClick={() => void onLoadHistory()} className="border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10">
                View Status History
              </button>
            </div>
            {assignedCameras.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {assignedCameras.map((camera) => (
                  <div key={camera.camera_id} className="border border-white/10 bg-black/25 p-3">
                    <p className="font-semibold">{camera.serial_number ?? camera.camera_id}</p>
                    <p className="mt-1 text-sm text-white/65">{camera.manufacturer ?? "Unknown maker"} / {camera.model}</p>
                    <p className="mt-2 text-xs text-white/45">Status: {camera.status} / Type: {camera.type}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/45">No cameras are assigned to this user.</p>
            )}
          </section>

          <section className="mt-4 border border-white/10 bg-black/25 p-4">
            <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">Audit Reference</h3>
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              {auditItems.map(([label, value]) => (
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
  );
}

type BranchUserRole = "OFFICER" | "BRANCH_ADMIN";

type AddBranchUserModalProps = {
  branch: Branch;
  organizationName: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

function AddBranchUserModal({
  branch,
  organizationName,
  onClose,
  onCreated,
}: AddBranchUserModalProps) {
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<BranchUserRole>("OFFICER");
  const [hasBadge, setHasBadge] = useState(false);
  const [badgeNumber, setBadgeNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departments = [
    "Patrol", "Traffic", "Criminal Investigations", "K9 Unit", "SWAT", "Internal Affairs",
    "Cyber Crime", "Narcotics", "Vice", "Bomb Squad", "Community Policing", "Border Patrol",
    "Marine Unit", "Air Support", "Forensics", "Intelligence", "Records", "Dispatch",
    "Training Academy", "Public Affairs", "Special Investigations", "Fraud", "Arson",
    "Drug Enforcement", "Special Operations", "Homicide", "VIP Protection", "Emergency Response",
    "Recruitment", "Branch Admin", "Other"
  ];

  const generateStrongPassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}<>?,.";
    let nextPassword = "";
    for (let i = 0; i < 18; i += 1) {
      nextPassword += charset[Math.floor(Math.random() * charset.length)];
    }
    setPassword(nextPassword);
  };

  const canSave =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    password.length >= 8 &&
    department.trim() &&
    (!hasBadge || badgeNumber.trim());

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || saving) {
      setError("Complete all required fields. Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await axios.post(
        `${API_URL}/user`,
        {
          userPayload: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim().toLowerCase(),
            password,
            role,
            org_id: branch.org_id,
            branch_id: branch.branch_id,
          },
          officerPayload: {
            badge_number: hasBadge ? badgeNumber.trim() : "",
            department: department.trim() || "Not assigned",
            status: OFFICER_STATUS.ACTIVE,
          },
        },
        { withCredentials: true, timeout: 15000 },
      );

      await onCreated();
      onClose();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? err.response?.data?.error ?? "Failed to create user"
        : "Failed to create user";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = "w-full border border-white/10 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20";
  const labelClass = "text-xs font-semibold uppercase text-white/45";

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-red-300">Branch User</p>
            <h2 className="mt-1 text-xl font-semibold">Add User</h2>
            <p className="mt-1 text-sm text-white/55">{organizationName} / {branch.name}</p>
          </div>
          <button type="button" onClick={onClose} className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6">
          {error && (
            <div className="mb-4 border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className={labelClass}>First Name</span>
              <input className={fieldClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Last Name</span>
              <input className={fieldClass} value={lastName} onChange={(event) => setLastName(event.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Email</span>
              <input type="email" className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value.toLowerCase())} required />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Role</span>
              <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value as BranchUserRole)}>
                <option value="OFFICER">OFFICER</option>
                <option value="BRANCH_ADMIN">BRANCH ADMIN</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Department</span>
              <select className={fieldClass} value={department} onChange={(event) => setDepartment(event.target.value)} required>
                <option value="">Select Department</option>
                {departments.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Badge Number</span>
              <select className={fieldClass} value={hasBadge ? "HAS_BADGE" : "NO_BADGE"} onChange={(event) => setHasBadge(event.target.value === "HAS_BADGE")}>
                <option value="NO_BADGE">No Badge Number</option>
                <option value="HAS_BADGE">Badge Number</option>
              </select>
            </label>
            {hasBadge && (
              <label className="space-y-1">
                <span className={labelClass}>Badge Value</span>
                <input className={fieldClass} value={badgeNumber} onChange={(event) => setBadgeNumber(event.target.value)} required />
              </label>
            )}
            <label className="space-y-1 md:col-span-2">
              <span className={labelClass}>Password</span>
              <div className="flex gap-2">
                <input type="text" className={fieldClass} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
                <button type="button" onClick={generateStrongPassword} className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10">
                  Suggest
                </button>
              </div>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-4">
            <button type="button" onClick={onClose} className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10">
              Cancel
            </button>
            <button type="submit" disabled={!canSave || saving} className="bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:bg-gray-700">
              {saving ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User| null>(null);
  const [search, setSearch] = useState("");
  const [showUpdateUser, setShowUpdateUser] = useState(false);
  const [updateUser, setUpdateUser] = useState<User | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [showUserModal, setShowUserModal] = useState(false);

  const [showDisableModal, setShowDisableModal] =
  useState(false);

  const [disableUser, setDisableUser] =
  useState<User | null>(null);

  const [showEnableModal, setShowEnableModal] =
  useState(false);

  const [enableUser, setEnableUser] =
  useState<User | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<UserStatusHistory[]>([]);


  // HELPER
  const MAIN_SUPER_ADMIN_ID =
  import.meta.env.VITE_MAIN_SUPER_ADMIN_ID;

  const getDepartment = (user: User) => {
    // Founder
    if (
      user.role === "SUPER_ADMIN" &&
      user.user_id === MAIN_SUPER_ADMIN_ID
    ) {
      return "Org Owner";
    }

    // Other Super Admins
    if (user.role === "SUPER_ADMIN") {
      return "Umbrella Sys. Admin";
    }

    // Org Owner
    if (user.role === "ORG_OWNER") {
      return "Org Owner";
    }

    // Officer / Branch Admin
    return (
      user.officers?.department?.trim() ||
      "No Department"
    );
  };

  const getBadgeNumber = (user: User) => {
  if (
    user.role === "ORG_OWNER" ||
    user.role === "SUPER_ADMIN"
  ) {
    return "No Badge Number";
  }

  return (
    user.officers?.badge_number?.trim() ||
    "No Badge Number"
  );
};


  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  const refreshUsers = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoadingUsers(true);
      const res = await axios.get(`${API_URL}/user`, {
        withCredentials: true,
        params: {
          orgId: selectedOrgId ?? undefined,
          branchId: selectedBranchId ?? undefined,
          search: search.trim() || undefined,
        },
      });
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to refresh users", err);
    } finally {
      if (showLoading) setLoadingUsers(false);
    }
  }, [API_URL, search, selectedBranchId, selectedOrgId]);

  const refreshReferenceData = useCallback(async () => {
    try {
      const [orgsRes, branchesRes, camerasRes] = await Promise.all([
        axios.get(`${API_URL}/organization`, { withCredentials: true }),
        axios.get(`${API_URL}/branches`, { withCredentials: true }),
        axios.get(`${API_URL}/camera`, { withCredentials: true }),
      ]);

      setOrganizations(Array.isArray(orgsRes.data) ? orgsRes.data : []);
      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      setCameras(Array.isArray(camerasRes.data) ? camerasRes.data : []);
    } catch (err) {
      console.error("Failed to refresh user reference data", err);
    }
  }, [API_URL]);

const handleDeleteUser = async (user: User, reason: string) => {
  runAction(async () => {
  if (!reason.trim()) return;

  try {
    await axios.delete(
      `${API_URL}/user/${user.user_id}`,
      { 
        data: { reason }, // send reason in body
        withCredentials: true 
      }
    );

    setUsers((prev) =>
      prev.filter((u) => u.user_id !== user.user_id)
    );
    await refreshReferenceData();
    await refreshUsers(); // refresh to get updated list with deleted user
    setShowDeleteModal(false);
    setDeleteUser(null);
  } catch (err) {
    console.error("Failed to delete user", err);
  }
  },
  {});
};


  useEffect(() => {
    void refreshReferenceData();
  }, [refreshReferenceData]);

  useEffect(() => {

  const timer = setTimeout(async () => {
    await refreshUsers(true);
  }, 350);

  return () => clearTimeout(timer);
}, [refreshUsers]);

  // Orgs → Branches hierarchy
  const orgTree = useMemo(() => {
    return organizations.map((org) => ({
      ...org,
      branches: branches.filter((b) => b.org_id === org.org_id),
    }));
  }, [branches, organizations]);

  // FILTERING
  // Users (officers, branch admins, org owners) filtered by org / branch / search
  const filteredUsers = users;

  const getBranchName = (branchId: string) =>
    branches.find((b) => b.branch_id === branchId)?.name ?? "Not assigned";

  const getCameraForSelectedUser = () => {
    const officer = selectedUser?.officers;
    if (!officer) return [];

    return cameras.filter(
      (cam) => cam.assigned_to === officer.officer_id
    );
  };

  const getOrgNameByUser = (orgID: string) => organizations.find((o) => o.org_id === orgID)?.name ?? "Unknown organization"

  const getUserBranchName = (user: User) =>
    user.branch?.name ?? (user.branch_id ? getBranchName(user.branch_id) : "Not assigned");

  const getUserOrganizationName = (user: User) =>
    user.organization?.name ?? getOrgNameByUser(user.org_id);

  const getUserName = (u: User) =>
  `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "N/A";

  const selectedBranch = selectedBranchId
    ? branches.find((branch) => branch.branch_id === selectedBranchId) ?? null
    : null;

  const selectedBranchOrgName = selectedBranch
    ? getOrgNameByUser(selectedBranch.org_id)
    : "N/A";

  // UPDATE USER HELPER
  const handleUpdateUser = async (data: {
  userPayload: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    org_id: string;
    branch_id?: string | null;
    password?: string;
  };
  officerPayload: {
    badge_number: string;
    department: string;
    status: string;
  } | null;
}) => {
  if (!updateUser) return;

  try {
    const response = await axios.patch(
      `${API_URL}/user/${updateUser.user_id}`,
      {
        userPayload: data.userPayload,
        officerPayload: data.officerPayload,
      },
      { withCredentials: true }
    );

    const updatedUser = response.data;

    // Update local state immediately, then refresh relation/reference data in the background.
    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === updateUser.user_id ? updatedUser : u
      )
    );
    await refreshReferenceData();
    await refreshUsers(false);

    setShowUpdateUser(false);
    setUpdateUser(null);
  } catch (error) {
    console.error("Update user failed:", error);
    throw error;
  }
};


const officerData =
  updateUser?.officers
    ? {
        officer_id: updateUser.officers.officer_id,
        badge_number: updateUser.officers.badge_number ?? "",
        department: updateUser.officers.department ?? "",
        status: updateUser.officers.status ?? "ACTIVE",
      }
    : undefined;


  return (
    <div className="flex h-full w-full p-4 gap-4 bg-body-black text-white border border-gray-700">

      {/* LEFT: ORG / BRANCH */}
      <div className="w-1/4 border border-gray-700 overflow-y-auto">
        <h3 className="p-2 font-semibold border-b border-gray-700">
          Organizations
        </h3>
        
        {orgTree.map((org) => (
          <div key={org.org_id} className="border-b border-gray-800">
            <div
              onClick={ async () => {
                setSelectedOrgId(org.org_id);
                setSelectedBranchId(null);
                setSelectedUser(null);

                // Log the click
                try {
                  await axios.post(
                    `${API_URL}/organization/access/organization/click`,
                    {}, // no body needed for now
                    { withCredentials: true }
                  );
                } catch (err) {
                  console.error("Failed to log organization click", err);
                }
              }}
              className={`p-2 cursor-pointer hover:bg-gray-800 ${
                selectedOrgId === org.org_id ? "bg-gray-900" : ""
              }`}
            >
              {org.name}
            </div>

            {selectedOrgId === org.org_id &&
              org.branches.map((b) => (
                <div
                  key={b.branch_id}
                  onClick={async () => {
                    setSelectedBranchId(b.branch_id);
                    setSelectedUser(null);

                    // Log the branch click
                      try {
                        await axios.post(
                          `${API_URL}/branches/access/branch/click`,
                          {
                            branch_id: b.branch_id,
                          },
                          { withCredentials: true }
                        );
                      } catch (err) {
                        console.error("Failed to log branch click", err);
                      }
                  }}
                  className={`pl-6 p-2 cursor-pointer text-sm hover:bg-gray-800 ${
                    selectedBranchId === b.branch_id ? "bg-gray-900" : ""
                  }`}
                >
                  {b.name}
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* RIGHT: USERS */}
      <div className="flex-1 flex flex-col gap-3">

        <h2 className="text-xl font-bold flex items-center justify-between">
          Users
          <div className="flex items-center gap-3">
            {selectedBranch && (
              <button
                type="button"
                onClick={() => setShowAddUser(true)}
                className="bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500"
              >
                Add User
              </button>
            )}
            <button
              onClick={() => void refreshUsers()}
              disabled={loadingUsers}
              className="border border-white/10 px-3 py-1 text-xs font-normal text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </h2>

        {/* Search */}
        <input
          type="text"
          placeholder="Search name, badge, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="p-2 bg-gray-900 border border-gray-700 focus:ring-2 focus:ring-red-600"
        />

        {/* USERS TABLE */}
        <div className="relative max-h-72 overflow-y-auto border border-gray-700">
          {loadingUsers && (
            <div className="absolute inset-x-0 top-0 z-20 bg-gray-900/85 px-3 py-1 text-xs text-gray-400">
              Updating users...
            </div>
          )}
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900 sticky top-0">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Badge</th>
                <th className="p-2">Role</th>
                <th className="p-2">Branch</th>
                <th className="p-2">Organization</th>
                <th className="p-2">Status</th>
                <th className="p-2">Department</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>

            {/* Active Users */}
            <tbody>
              {filteredUsers
                .filter(u => !u.deleted_at)
                .map(u => {
                  const officer = u.officers;
                  return (
                    <tr
                      key={u.user_id}
                      className={`border-b border-gray-700 cursor-pointer hover:bg-gray-800 ${
                        selectedUser?.officers?.officer_id === officer?.officer_id
                          ? "bg-gray-900"
                          : ""
                      }`}
                      onClick={async () => {
                        setSelectedUser(u);
                        setShowUserModal(true);
                        try {
                          await axios.post(`${API_URL}/user/access/user/click`, { user_id: u.user_id }, { withCredentials: true });
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                    >
                      <td className="p-2">{getUserName(u)}</td>
                      <td className="p-2">{getBadgeNumber(u)}</td>
                      <td className="p-2">{u.role}</td>
                      <td className="p-2">{getUserBranchName(u)}</td>
                      <td className="p-2">{getUserOrganizationName(u)}</td>
                      <td className="p-2">
                        {u.active === true ? (
                          <span className="text-green-500">{OFFICER_STATUS.ACTIVE}</span>
                        ) : (
                          <span className="text-gray-300">{OFFICER_STATUS.INACTIVE}</span>
                        )}
                      </td>
                      <td className="p-2">{getDepartment(u)}</td>
                      <td className="p-2 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUpdateUser(u);
                            setShowUpdateUser(true);
                          }}
                          className="underline hover:no-underline"
                        >
                          Update
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteUser(u);
                            setShowDeleteModal(true);
                          }}
                          className="underline hover:no-underline"
                        >
                          Delete
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();

                            runAction(
                              async () => {
                                if (u.active) {
                                  setDisableUser(u);
                                  setShowDisableModal(true);
                                } else {
                                  setEnableUser(u);
                                  setShowEnableModal(true);
                                }
                              },
                              {}
                            );
                          }}
                          className="underline hover:no-underline"
                        >
                          {u.active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>

            {/* Deleted Users */}
            {filteredUsers.some(u => u.deleted_at) && (
              <>
                <tr className="bg-gray-900 text-gray-300">
                  <td colSpan={8} className="p-2 font-semibold">Deleted Users</td>
                </tr>
                <tbody>
                  {filteredUsers
                    .filter(u => u.deleted_at)
                    .map(u => {
                      const officer = u.officers;
                      return (
                        <tr
                          key={u.user_id}
                          className="border-b border-gray-700 cursor-pointer text-gray-400 hover:bg-gray-800"
                          onClick={() => setSelectedUser(u)}
                        >
                          <td className="p-2">{getUserName(u)}</td>
                          <td className="p-2">{officer?.badge_number ?? "N/A"}</td>
                          <td className="p-2">{u.role}</td>
                          <td className="p-2">{getUserBranchName(u)}</td>
                          <td className="p-2">{getUserOrganizationName(u)}</td>
                          <td className="p-2">
                            {officer?.status === "ACTIVE" ? (
                              <span className="text-green-500">{OFFICER_STATUS.ACTIVE}</span>
                            ) : (
                              <span className="text-gray-300">{OFFICER_STATUS.INACTIVE}</span>
                            )}
                          </td>
                          <td className="p-2">{officer?.department ?? "N/A"}</td>
                          <td className="p-2">—</td> {/* no actions for deleted */}
                        </tr>
                      );
                    })}
                </tbody>
              </>
            )}
          </table>
        </div>

        <div className="p-3 text-sm text-gray-400 text-center">
          {!showUserModal && (
            <p>Click a user row to view detailed authority and assignment information.</p>
          )}
        </div>
      </div>

      {showAddUser && selectedBranch && (
        <AddBranchUserModal
          branch={selectedBranch}
          organizationName={selectedBranchOrgName}
          onClose={() => setShowAddUser(false)}
          onCreated={async () => {
            await refreshReferenceData();
            await refreshUsers(false);
          }}
        />
      )}

      {showUserModal && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          cameras={cameras}
          getUserName={getUserName}
          getOrgNameByUser={getOrgNameByUser}
          getBranchName={getBranchName}
          onClose={() => setShowUserModal(false)}
          onLoadHistory={async () => {
            setShowHistoryModal(true);
            const res = await axios.get(
              `${API_URL}/user/${selectedUser.user_id}/status-history`,
              { withCredentials: true },
            );
            setHistory(res.data);
          }}
        />
      )}

      {showUserModal && selectedUser && false && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center">

          <div className="bg-gray-900 border border-gray-700 w-[40%] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">

            {/* HEADER */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
              <div className="text-left">
                <h2 className="text-lg font-semibold text-white">
                  User Details
                </h2>
                <p className="text-sm text-gray-400">
                  {getUserName(selectedUser!)}
                </p>
              </div>

              <button
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="flex flex-1 overflow-hidden">

              {/* LEFT: USER INFO */}
              <div className="w-full p-4 overflow-y-auto border-r border-gray-700 text-sm ">
                {(() => {
                  const officer = selectedUser!.officers;

                  return (
                    <>
                      <h3 className="font-semibold underline mb-2 text-left">User Details</h3>

                      <span className="text-left">
                        <p><strong>Name:</strong> {getUserName(selectedUser!)}</p>
                        <p><strong>Badge Number:</strong> {officer?.badge_number ?? "N/A"}</p>
                        <p><strong>User ID:</strong> {selectedUser!.user_id}</p>
                        <p><strong>User Email:</strong> {selectedUser!.email}</p>
                      </span>

                       <h3 className="font-semibold underline mt-2 text-left">Account Information</h3>
                        <span className="text-left">

                          <p>
                            <strong>User Disabled:</strong>{" "}
                            {selectedUser!.active === false
                              ? <span className="text-red-500">Yes</span>
                              : <span className="text-green-500">No</span>}
                          </p>

                          <p>
                            <strong>Deleted at:</strong>{" "}
                            {selectedUser!.deleted_at
                              ? `${new Date(selectedUser!.deleted_at as string).toDateString()}, ${new Date(selectedUser!.deleted_at as string).toLocaleTimeString()}`
                              : "Not deleted"}
                          </p>
                          <p><strong>Delete Reason:</strong> {selectedUser!.user_del_reason ?? 'User is Active'}</p>

                          <p><strong>Delete By:</strong> {selectedUser!.deleted_by ?? 'Still Active'}</p>

                          <button
                            onClick={async () => {
                              setShowHistoryModal(true);

                              const res = await axios.get(
                                `${API_URL}/user/${selectedUser!.user_id}/status-history`,
                                { withCredentials: true }
                              );

                              setHistory(res.data);
                            }}
                            className="mt-2 px-3 py-1 border text-sm underline hover:no-underline"
                          >
                            View Account Activation History
                          </button>
                        </span>

                      <h3 className="font-semibold underline mt-4 mb-2 text-left">
                        Organization & Branch Details
                      </h3>
                      <span className="text-left">
                        <p><strong>Organization:</strong> {getOrgNameByUser(selectedUser!.org_id)}</p>
                        <p><strong>Organization ID:</strong> {selectedUser!.org_id}</p>
                        <p><strong>Branch:</strong> {getBranchName(selectedUser!.branch_id || "N/A")}</p>
                        <p><strong>Branch ID:</strong> {selectedUser!.branch_id}</p>
                        <p>
                          <strong>Status:</strong>{" "}
                          {officer?.status === "ACTIVE"
                            ? <span className="text-green-500">{OFFICER_STATUS.ACTIVE}</span>
                            : <span className="text-red-500">{OFFICER_STATUS.INACTIVE}</span>}
                        </p>
                        <p><strong>Role:</strong> {selectedUser!.role}</p>
                      </span>

                      <h3 className="font-semibold underline mt-4 mb-2 text-left">Camera Details</h3>
                      <span className="text-left">
                        {getCameraForSelectedUser().length > 0 ? (
                        getCameraForSelectedUser().map((cam) => (
                          <div key={cam.camera_id} className="mb-2">
                            <p><strong>Camera ID:</strong> {cam.camera_id}</p>
                            <p><strong>Model:</strong> {cam.model}</p>
                            <p><strong>Status:</strong> {cam.status}</p>
                            <p><strong>Type:</strong> {cam.type}</p>
                          </div>
                        ))
                      ) : (
                        <p>User Does Not Have Any Cameras Assigned</p>
                      )}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE USER MODAL */}
      {showUpdateUser && (
        <UpdateUserModal 
          onClose={() => {
            setShowUpdateUser(false)
            setUpdateUser(null)
          }}
          onSubmit={handleUpdateUser} 
          user={{
            user_id: updateUser!.user_id,
            first_name: updateUser!.first_name,
            last_name: updateUser!.last_name,
            email: updateUser!.email,
            role: updateUser!.role,
            org_id: updateUser!.org_id,
            branch_id: updateUser?.branch_id,
            officer: officerData,
          }}        
        />
      )}



      {/* DISABLE USER MODAL */}
      {
        showDisableModal &&
        disableUser && (
          <DisableUserModal
            user={disableUser}
            onClose={() => {
              setShowDisableModal(false);
              setDisableUser(null);
            }}
            onSubmit={async (
              reason,
            ) => {
              await axios.patch(
                `${API_URL}/user/${disableUser.user_id}/disable`,
                {
                  reason,
                },
                {
                  withCredentials: true,
                }
              );

              await refreshUsers();

              setShowDisableModal(false);
              setDisableUser(null);
            }}
          />
        )
      }

      {/* DELETE USER MODAL */}
      {
        showDeleteModal &&
        deleteUser && (
          <DeleteUserModal
            user={deleteUser}
            onClose={() => {
              setShowDeleteModal(false);
              setDeleteUser(null);
            }}
            onSubmit={(reason) => void handleDeleteUser(deleteUser, reason)}
          />
        )
      }

      {/* ENABLE USER MODAL */}
      {
        showEnableModal &&
        enableUser && (
          <EnableUserModal
            user={enableUser}
            onClose={() => {
              setShowEnableModal(false);
              setEnableUser(null);
            }}
            onSubmit={async (reason) => {
              await axios.patch(
                `${API_URL}/user/${enableUser.user_id}/enable`,
                { reason },
                {
                  withCredentials: true,
                }
              );

              await refreshUsers();

              setShowEnableModal(false);
              setEnableUser(null);
            }}
          />
        )
      }

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

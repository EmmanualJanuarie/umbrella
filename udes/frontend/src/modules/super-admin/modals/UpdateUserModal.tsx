import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { OFFICER_STATUS, type OfficerStatus } from "../../../data/types";

interface UpdateUserModalProps {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    org_id: string;
    branch_id?: string;
    officer?: {
      officer_id?: string;
      badge_number: string;
      department: string;
      status: OfficerStatus;
    };
  };
  onClose: () => void;
  onSubmit?: (data: {
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
      status: OfficerStatus;
    } | null;
  }) => Promise<void> | void;
}

interface Organization {
  org_id: string;
  name: string;
  hasUsers: boolean;
  hasOrgOwner: boolean;
  isUmbrella: boolean;
}

interface Branch {
  branch_id: string;
  name: string;
  org_id: string;
}

export default function UpdateUserModal({ user, onClose, onSubmit }: UpdateUserModalProps) {
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [email, setEmail] = useState(user.email);
  const [badgeNumber, setBadgeNumber] = useState(user.officer?.badge_number ?? "");
  const [department, setDepartment] = useState(user.officer?.department ?? "");
  const [role, setRole] = useState(user.role);
  const [status] = useState<OfficerStatus>(user.officer?.status ?? OFFICER_STATUS.ACTIVE);
  const [orgId, setOrgId] = useState(user.org_id);
  const [branchId, setBranchId] = useState(user.branch_id ?? "");
  const [password, setPassword] = useState(""); // optional
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [departmentCustom, setDepartmentCustom] = useState("");
  const [hasBadge, setHasBadge] = useState(
    !!user.officer?.badge_number &&
    user.officer.badge_number !== "No Badge Number"
  );


  const departments = [
    "Patrol", "Traffic", "Criminal Investigations", "K9 Unit", "SWAT", "Internal Affairs",
    "Cyber Crime", "Narcotics", "Vice", "Bomb Squad", "Community Policing", "Border Patrol",
    "Marine Unit", "Air Support", "Forensics", "Intelligence", "Records", "Dispatch",
    "Training Academy", "Public Affairs", "Special Investigations", "Fraud", "Arson",
    "Drug Enforcement", "Special Operations", "Homicide", "VIP Protection", "Emergency Response",
    "Recruitment", "Branch Admin", "Other"
  ];
  

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  useEffect(() => {
    axios.get(`${API_URL}/organization`, { withCredentials: true })
      .then(res => setOrganizations(res.data))
      .catch(console.error);

    axios.get(`${API_URL}/branches`, { withCredentials: true })
      .then(res => setBranches(res.data))
      .catch(console.error);
  }, [API_URL]);

  const visibleOrganizations = useMemo(() => {
    if (!Array.isArray(organizations)) return [];
    if (role === "ORG_OWNER") {
      return organizations.filter(org => !org.hasUsers && !org.hasOrgOwner);
    }
    return organizations;
  }, [organizations, role]);

  const visibleBranches = useMemo(() => {
    if (!orgId) return [];
    return branches.filter(b => b.org_id === orgId);
  }, [branches, orgId]);

  const generateStrongPassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}<>?,.";
    let pw = "";
    for (let i = 0; i < 18; i++) {
      pw += charset[Math.floor(Math.random() * charset.length)];
    }
    setPassword(pw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const branchScopedRole = ["OFFICER", "BRANCH_ADMIN", "SUPER_ADMIN"].includes(role);

    const userPayload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      role,
      org_id: orgId,
      branch_id: branchScopedRole ? branchId || undefined : null,
      ...(password && { password }), // only include if user changed it
    };

    const officerPayload = (role === "OFFICER" || role === "BRANCH_ADMIN") ? {
      badge_number: hasBadge ? badgeNumber.trim() : "",
      department: department.trim() || "Not assigned",
      status,
    } : null;

    try {
      setSaving(true);
      setError(null);

      if (onSubmit) {
        await onSubmit({ userPayload, officerPayload });
      } else {
        await axios.patch(`${API_URL}/user/${user.user_id}`, { userPayload, officerPayload }, { withCredentials: true });
      }

      onClose();
    } catch (err: unknown) {
      console.error("User update failed", err);
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? err.response?.data?.error ?? "User update failed"
        : "User update failed";
      setError(Array.isArray(message) ? message.join(", ") : String(message));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "h-12 w-full border border-white/15 bg-black/40 px-4 text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20";
  const labelClass = "grid gap-2 text-sm font-semibold text-white/80";

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/35 px-6 py-5">
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.18em] text-red-300">Update User</p>
            <h2 className="mt-1 text-xl font-semibold">{user.first_name} {user.last_name}</h2>
            <p className="mt-1 text-sm text-white/55">{user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}
          <section className="border border-white/10 bg-white/[0.03] p-4">
            <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">
              Identity
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                First Name
                <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass} required />
              </label>
              <label className={labelClass}>
                Last Name
                <input type="text" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass} required />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Email Address
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value.toLowerCase())} className={inputClass} required />
              </label>
            </div>
          </section>

          {/* Badge + Department */}
          {(role === "OFFICER" || role === "BRANCH_ADMIN") && (
            <section className="mt-4 border border-white/10 bg-white/[0.03] p-4">
              <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">
                Officer Profile
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Officer ID
                <input type="text" value={user.officer?.officer_id ?? "Not assigned"} className={inputClass} readOnly />
              </label>
              {/* Badge Number Dropdown */}
              <label className={labelClass}>
                Badge Option
                <select
                  value={hasBadge ? "HAS_BADGE" : "NO_BADGE"}
                  onChange={(e) => {
                    if (e.target.value === "HAS_BADGE") {
                      setHasBadge(true);       // show input
                      setBadgeNumber("");      // reset input
                    } else {
                      setHasBadge(false);      // hide input
                      setBadgeNumber("No Badge Number"); // default value
                    }
                  }}
                  className={inputClass}
                >
                  <option value="NO_BADGE">No Badge Number</option>
                  <option value="HAS_BADGE">Badge Number</option>
                </select>
              </label>

              {/* Badge Number Input */}
              {hasBadge && (
                <label className={labelClass}>
                  Badge Number
                  <input
                    type="text"
                    placeholder="Enter Badge Number"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
              )}

              {/* Department Dropdown */}
              <label className={labelClass}>
                Department
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </label>

              {/* Custom Department Input if Other */}
              {department === "Other" && (
                <label className={labelClass}>
                  Custom Department
                  <input
                    type="text"
                    placeholder="Enter Department"
                    value={departmentCustom}
                    onChange={(e) => setDepartmentCustom(e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
              )}
              </div>
            </section>
          )}

          <section className="mt-4 border border-white/10 bg-white/[0.03] p-4">
            <h3 className="border-b border-white/10 pb-3 text-sm font-semibold uppercase text-white/60">
              Access & Assignment
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Role
            <select value={role} onChange={e => setRole(e.target.value)} className={inputClass} required>
              <option value="">Select Role</option>
              <option value="OFFICER">OFFICER</option>
              <option value="BRANCH_ADMIN">BRANCH ADMIN</option>
              <option value="ORG_OWNER">ORG OWNER</option>
              <option value="SUPER_ADMIN">SUPER ADMIN</option>
            </select>
          </label>

          <label className={labelClass}>
            Organization
            <select value={orgId} onChange={e => { setOrgId(e.target.value); setBranchId(""); }} className={inputClass} required>
              <option value="">Select Organization</option>
              {visibleOrganizations.map(org => <option key={org.org_id} value={org.org_id}>{org.name}</option>)}
            </select>
          </label>

          {role === "SUPER_ADMIN" && orgId && (
            <label className={labelClass}>
              Branch
              <select value={branchId} onChange={e => setBranchId(e.target.value)} className={inputClass}>
                <option value="">Select Branch</option>
                {visibleBranches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
              </select>
            </label>
          )}

          {/* Optional password */}
          <label className={`${labelClass} md:col-span-2`}>
            Password
            <div className="flex gap-2">
              <input type="text" placeholder="Password (leave blank to keep current)" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
              <button type="button" onClick={generateStrongPassword} className="border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Suggest</button>
            </div>
          </label>
            </div>
          </section>

          <div className="sticky bottom-0 mt-6 flex justify-end gap-3 border-t border-white/10 bg-gray-950/95 py-4">
            <button type="button" onClick={onClose} className="border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Cancel</button>
            <button type="submit" disabled={saving} className="bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Updating..." : "Update User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

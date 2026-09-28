import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import CollapsibleSidebarNav, { type SidebarMenuGroup } from "../../components/layout/CollapsibleSidebarNav";
import DashboardFooter from "../../components/layout/DashboardFooter";
import DashboardHeader from "../../components/layout/DashboardHeader";
import { useScreenSize } from "../../hooks/useScreensSize";
import type { Role } from "../../data/types";
import { useActionDialog } from "../../components/modals/ActionDialog";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import AuditReports from "../../modules/super-admin/AuditReports";
import RetentionSettings from "../../modules/main-super-admin/RetentionSettings";
import DashboardPlaceholder from "../../components/layout/DashboardPlaceholder";
import { useReportDownload } from "../../modules/shared/useReportDownload";
import { useUser } from "../../context/UserContext";
import { useRememberedDashboardPane } from "../../hooks/useRememberedDashboardPane";

const PLATFORM_OWNER_EMAIL = "emmanualjanuarie@umbrellasystems.co.za";

type UmbrellaBranch = {
  umbrella_branch_id: string;
  name: string;
  location?: string;
  active: boolean;
};

type UmbrellaUser = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Extract<Role, "MAIN_SUPER_ADMIN" | "SUPER_ADMIN">;
  active: boolean;
  created_at?: string;
  umbrellaBranch?: UmbrellaBranch | null;
};

type FormState = {
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: UmbrellaUser["role"];
  umbrella_branch_id: string;
  active: boolean;
};

type CompanyMonitoringRow = {
  org_id: string;
  name: string;
  active: boolean;
  branch_count: number;
  user_count: number;
  active_user_count: number;
  camera_count: number;
  active_camera_count: number;
  total_video_count: number;
  total_video_storage_bytes: number;
  monthly_video_count: number;
  monthly_video_storage_bytes: number;
  monthly_uploaded_video_count: number;
  monthly_s3_storage_bytes: number;
  pending_verification_count: number;
  failed_upload_count: number;
};

type EvidenceInvestigationReport = { investigation_report_id: string; title: string; status: string; created_at: string; incident_summary: string; video_id: string; creator?: { first_name: string; last_name: string } | null; video?: { session?: { organization?: { name: string } | null; branch?: { name: string } | null; officer?: { badge_number?: string | null; user?: { first_name: string; last_name: string } | null } | null } | null } | null };

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  role: "SUPER_ADMIN",
  umbrella_branch_id: "",
  active: true,
};

export default function PlatformOwnerDashboard() {
  const { screenState, screenMessage } = useScreenSize();
  const { user } = useUser();
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
  const [activeSection, setActiveSection] = useRememberedDashboardPane<
    "monitoring" | "auditReports" | "retention" | "admin"
  >("main-super-admin", user?.user_id);
  useDocumentTitle(activeSection, "Platform Owner");
  const [branches, setBranches] = useState<UmbrellaBranch[]>([]);
  const [users, setUsers] = useState<UmbrellaUser[]>([]);
  const [monitoring, setMonitoring] = useState<CompanyMonitoringRow[]>([]);
  const [evidenceReports] = useState<EvidenceInvestigationReport[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [branchName, setBranchName] = useState("");
  const [branchLocation, setBranchLocation] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<UmbrellaBranch | null>(null);
  const [branchSaving, setBranchSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dialogElement, confirmAction } = useActionDialog();
  const { dialogElement: reportDownloadDialog } = useReportDownload();
  const downloadEvidenceReport = (_reportId: string) => setActiveSection("auditReports");
  const platformMenuGroups: SidebarMenuGroup[] = [
    {
      key: "platform-overview",
      label: "Platform overview",
      items: [{ key: "monitoring", label: "Company monitoring" }],
    },
    {
      key: "evidence-governance",
      label: "Evidence and governance",
      items: [{ key: "auditReports", label: "Audit reports" }, { key: "retention", label: "Retention controls" }],
    },
    {
      key: "administration",
      label: "Administration",
      items: [{ key: "admin", label: "Internal users and branches" }],
    },
  ];

  const editing = Boolean(form.user_id);
  const canSave = Boolean(
    form.first_name.trim() &&
      form.last_name.trim() &&
      form.email.trim() &&
      (editing || form.password.length >= 8),
  );

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [users],
  );

  const isProtectedOwner = (user: UmbrellaUser) =>
    user.user_id === import.meta.env.VITE_MAIN_SUPER_ADMIN_ID ||
    user.email.toLowerCase() === PLATFORM_OWNER_EMAIL ||
    user.role === "MAIN_SUPER_ADMIN";

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 GB";
    const gb = bytes / 1024 / 1024 / 1024;
    return `${gb.toFixed(gb >= 10 ? 1 : 2)} GB`;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branchResponse, userResponse] = await Promise.all([
        axios.get<UmbrellaBranch[]>(`${API_URL}/platform-admin/umbrella-branches`, { withCredentials: true }),
        axios.get<UmbrellaUser[]>(`${API_URL}/platform-admin/umbrella-users`, { withCredentials: true }),
      ]);
      setBranches(branchResponse.data);
      setUsers(userResponse.data);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to load platform data"
        : "Failed to load platform data";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadMonitoring = useCallback(async () => {
    setError(null);
    try {
      const response = await axios.get<CompanyMonitoringRow[]>(
        `${API_URL}/platform-admin/company-monitoring`,
        { withCredentials: true },
      );
      setMonitoring(response.data);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to load company monitoring"
        : "Failed to load company monitoring";
      setError(Array.isArray(message) ? message.join(", ") : message);
    }
  }, [API_URL]);

  useEffect(() => {
    if (activeSection === "monitoring") void loadMonitoring();
  }, [activeSection, loadMonitoring]);

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        active: form.active,
        umbrella_branch_id: form.umbrella_branch_id || undefined,
        ...(form.password && { password: form.password }),
      };

      const response = editing
        ? await axios.patch<UmbrellaUser>(
            `${API_URL}/platform-admin/umbrella-users/${form.user_id}`,
            payload,
            { withCredentials: true },
          )
        : await axios.post<UmbrellaUser>(
            `${API_URL}/platform-admin/umbrella-users`,
            payload,
            { withCredentials: true },
          );

      setUsers((current) =>
        editing
          ? current.map((user) => (user.user_id === response.data.user_id ? response.data : user))
          : [response.data, ...current],
      );
      setForm(emptyForm);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to save user"
        : "Failed to save user";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user: UmbrellaUser) => {
    const confirmed = await confirmAction({
      title: "Delete Platform User",
      message: `Delete ${user.first_name} ${user.last_name}? This account will lose access immediately.`,
      confirmLabel: "Delete User",
      tone: "danger",
    });
    if (!confirmed) return;

    await axios.delete(`${API_URL}/platform-admin/umbrella-users/${user.user_id}`, {
      withCredentials: true,
    });
    setUsers((current) => current.filter((item) => item.user_id !== user.user_id));
  };

  const createBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branchName.trim()) return;

    setBranchSaving(true);
    setError(null);
    try {
      const payload = {
        name: branchName.trim(),
        location: branchLocation.trim() || undefined,
      };

      const response = selectedBranch
        ? await axios.patch<UmbrellaBranch>(
            `${API_URL}/platform-admin/umbrella-branches/${selectedBranch.umbrella_branch_id}`,
            payload,
            { withCredentials: true },
          )
        : await axios.post<UmbrellaBranch>(
            `${API_URL}/platform-admin/umbrella-branches`,
            payload,
            { withCredentials: true },
          );

      setBranches((current) =>
        selectedBranch
          ? current.map((branch) =>
              branch.umbrella_branch_id === response.data.umbrella_branch_id ? response.data : branch,
            )
          : [response.data, ...current],
      );
      setUsers((current) =>
        current.map((user) =>
          user.umbrellaBranch?.umbrella_branch_id === response.data.umbrella_branch_id
            ? { ...user, umbrellaBranch: response.data }
            : user,
        ),
      );
      setBranchName("");
      setBranchLocation("");
      setSelectedBranch(null);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to save branch"
        : "Failed to save branch";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setBranchSaving(false);
    }
  };

  const startBranchEdit = (branch: UmbrellaBranch) => {
    setSelectedBranch(branch);
    setBranchName(branch.name);
    setBranchLocation(branch.location ?? "");
  };

  const cancelBranchEdit = () => {
    setSelectedBranch(null);
    setBranchName("");
    setBranchLocation("");
  };

  const deleteBranch = async (branch: UmbrellaBranch) => {
    const confirmed = await confirmAction({
      title: "Delete Umbrella Branch",
      message: `Delete Umbrella branch "${branch.name}"? Users assigned to it will be unassigned.`,
      confirmLabel: "Delete Branch",
      tone: "danger",
    });
    if (!confirmed) return;

    setBranchSaving(true);
    setError(null);
    try {
      await axios.delete(`${API_URL}/platform-admin/umbrella-branches/${branch.umbrella_branch_id}`, {
        withCredentials: true,
      });
      setBranches((current) =>
        current.filter((item) => item.umbrella_branch_id !== branch.umbrella_branch_id),
      );
      setUsers((current) =>
        current.map((user) =>
          user.umbrellaBranch?.umbrella_branch_id === branch.umbrella_branch_id
            ? { ...user, umbrellaBranch: null }
            : user,
        ),
      );
      if (selectedBranch?.umbrella_branch_id === branch.umbrella_branch_id) {
        cancelBranchEdit();
      }
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to delete branch"
        : "Failed to delete branch";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setBranchSaving(false);
    }
  };

  if (screenState !== "desktop") {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-body-black text-color-white text-center p-4">
          <p className="text-lg font-bold">{screenMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      <DashboardHeader dash_identifier="Umbrella Platform Owner" isOfficer_dashboard={false} />

      <main className="flex-1 bg-body-black text-white px-6 py-5 overflow-hidden">
        <div className="h-full grid grid-cols-[320px_1fr] gap-4">
          <aside className="border border-white/10 bg-black/30 overflow-y-auto">
            <CollapsibleSidebarNav
              title="Umbrella"
              subtitle="Platform administration"
              groups={platformMenuGroups}
              activeView={activeSection}
              setActiveView={(view) => setActiveSection(view as "monitoring" | "auditReports" | "admin")}
              className="p-4 text-left"
            >

            {activeSection === "admin" && (
              <>
            <h2 className="text-base font-semibold">Umbrella Branches</h2>
            <form onSubmit={createBranch} className="mt-4 space-y-2">
              <input className="w-full p-2 bg-gray-900 border border-gray-700" placeholder="Branch name" value={branchName} onChange={(event) => setBranchName(event.target.value)} />
              <input className="w-full p-2 bg-gray-900 border border-gray-700" placeholder="Location" value={branchLocation} onChange={(event) => setBranchLocation(event.target.value)} />
              <button disabled={branchSaving || !branchName.trim()} className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700" type="submit">
                {selectedBranch ? "Update Branch" : "Create Branch"}
              </button>
              {selectedBranch && (
                <button type="button" onClick={cancelBranchEdit} className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700">
                  Cancel Edit
                </button>
              )}
            </form>
            <div className="mt-5 space-y-2">
              {branches.map((branch) => (
                <div
                  key={branch.umbrella_branch_id}
                  onClick={() => startBranchEdit(branch)}
                  className={`border p-3 cursor-pointer transition ${
                    selectedBranch?.umbrella_branch_id === branch.umbrella_branch_id
                      ? "border-red-500 bg-red-600/10"
                      : "border-gray-800 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{branch.name}</p>
                      <p className="text-sm text-gray-400">{branch.location || "No location"}</p>
                    </div>
                    <span className={`text-xs ${branch.active ? "text-green-300" : "text-gray-400"}`}>
                      {branch.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {selectedBranch?.umbrella_branch_id === branch.umbrella_branch_id && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startBranchEdit(branch);
                        }}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteBranch(branch);
                        }}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-sm text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
              </>
            )}
            </CollapsibleSidebarNav>
          </aside>

          <section className="autohide-scrollbar min-h-0 border border-white/10 bg-black/20 p-5 overflow-y-scroll overscroll-contain text-left [scrollbar-gutter:stable]">
            {!activeSection ? (
              <DashboardPlaceholder />
            ) : activeSection === "monitoring" ? (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-semibold">Company Monitoring</h1>
                    <p className="mt-1 text-sm text-white/60">
                      Storage, uploaded videos, cameras, and current-month cloud usage across all organizations.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadMonitoring()}
                    className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    Refresh
                  </button>
                </div>

                {error && <div className="mt-4 border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>}

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase text-white/45">Awaiting Verification</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-300">{monitoring.reduce((sum, item) => sum + item.pending_verification_count, 0)}</p>
                  </div>
                  <div className="border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase text-white/45">Companies</p>
                    <p className="mt-1 text-2xl font-semibold">{monitoring.length}</p>
                  </div>
                  <div className="border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase text-white/45">Total Videos</p>
                    <p className="mt-1 text-2xl font-semibold">{monitoring.reduce((sum, item) => sum + item.total_video_count, 0)}</p>
                  </div>
                  <div className="border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase text-white/45">Total Storage</p>
                    <p className="mt-1 text-2xl font-semibold">{formatBytes(monitoring.reduce((sum, item) => sum + item.total_video_storage_bytes, 0))}</p>
                  </div>
                  <div className="border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase text-white/45">This Month Storage</p>
                    <p className="mt-1 text-2xl font-semibold">{formatBytes(monitoring.reduce((sum, item) => sum + item.monthly_s3_storage_bytes, 0))}</p>
                  </div>
                </div>

                <div className="mt-5 overflow-auto border border-white/10">
                  <table className="w-full min-w-[1060px] text-sm">
                    <thead className="bg-gray-900 text-gray-300">
                      <tr>
                        <th className="p-3 text-left">Company</th>
                        <th className="p-3 text-right">Branches</th>
                        <th className="p-3 text-right">Users</th>
                        <th className="p-3 text-right">Cameras</th>
                        <th className="p-3 text-right">Videos</th>
                        <th className="p-3 text-right">Awaiting Verification</th>
                        <th className="p-3 text-right">Video Storage</th>
                        <th className="p-3 text-right">Uploaded This Month</th>
                        <th className="p-3 text-right">Storage This Month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoring.map((item) => (
                        <tr key={item.org_id} className="border-t border-gray-800">
                          <td className="p-3">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-xs text-white/45">{item.active ? "Active" : "Inactive"}</p>
                          </td>
                          <td className="p-3 text-right">{item.branch_count}</td>
                          <td className="p-3 text-right">{item.active_user_count}/{item.user_count}</td>
                          <td className="p-3 text-right">{item.active_camera_count}/{item.camera_count}</td>
                          <td className="p-3 text-right">{item.total_video_count}</td>
                          <td className="p-3 text-right">
                            <span className={item.pending_verification_count > 0 ? "text-amber-300" : "text-white/55"}>{item.pending_verification_count}</span>
                            {item.failed_upload_count > 0 && <span className="ml-2 text-xs text-red-300">{item.failed_upload_count} failed</span>}
                          </td>
                          <td className="p-3 text-right">{formatBytes(item.total_video_storage_bytes)}</td>
                          <td className="p-3 text-right">{item.monthly_uploaded_video_count}</td>
                          <td className="p-3 text-right">{formatBytes(item.monthly_s3_storage_bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : String(activeSection) === "evidenceReports" ? (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-semibold">Retired feature</h1>
                    <p className="mt-1 text-sm text-white/60">
                      Evidence-review and investigation reports are no longer available.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection("auditReports")}
                    className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    View evidence reports
                  </button>
                </div>

                {error && <div className="mt-4 border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>}

                <div className="mt-5 overflow-auto border border-white/10">
                  <table className="w-full min-w-[1100px] text-sm">
                    <thead className="bg-gray-900 text-gray-300">
                      <tr>
                        <th className="p-3 text-left">Report</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Organization</th>
                        <th className="p-3 text-left">Branch</th>
                        <th className="p-3 text-left">Officer</th>
                        <th className="p-3 text-left">Video ID</th>
                        <th className="p-3 text-left">Reviewer</th>
                        <th className="p-3 text-left">Created</th>
                        <th className="p-3 text-right">PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidenceReports.map((report) => {
                        const officerUser = report.video?.session?.officer?.user;
                        const reviewer = report.creator
                          ? `${report.creator.first_name} ${report.creator.last_name}`.trim()
                          : "Unavailable";
                        return (
                          <tr key={report.investigation_report_id} className="border-t border-gray-800 align-top">
                            <td className="p-3">
                              <p className="font-semibold">{report.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs text-white/45">{report.incident_summary}</p>
                            </td>
                            <td className="p-3">{report.status}</td>
                            <td className="p-3">{report.video?.session?.organization?.name ?? "Unavailable"}</td>
                            <td className="p-3">{report.video?.session?.branch?.name ?? "Unavailable"}</td>
                            <td className="p-3">
                              {officerUser ? `${officerUser.first_name} ${officerUser.last_name}` : "Unavailable"}
                              {report.video?.session?.officer?.badge_number && (
                                <p className="text-xs text-white/45">Badge {report.video.session.officer.badge_number}</p>
                              )}
                            </td>
                            <td className="p-3 font-mono text-xs">{report.video_id}</td>
                            <td className="p-3">{reviewer}</td>
                            <td className="p-3">{new Date(report.created_at).toLocaleString()}</td>
                            <td className="p-3 text-right">
                              <button type="button" onClick={() => void downloadEvidenceReport(report.investigation_report_id)} className="border border-white/10 px-3 py-1 text-xs hover:bg-white/10">PDF</button>
                            </td>
                          </tr>
                        );
                      })}
                      {evidenceReports.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-white/45">
                            This retired feature has no active reports.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeSection === "auditReports" ? (
              <AuditReports />
            ) : activeSection === "retention" ? (
              <RetentionSettings />
            ) : (
              <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">Internal User Management</h1>
                <p className="mt-1 text-sm text-white/60">Create and manage Umbrella Super Admin users.</p>
              </div>
              {loading && <span className="text-sm text-gray-400">Loading...</span>}
            </div>

            {error && <div className="mt-4 border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>}

            <form onSubmit={saveUser} className="mt-5 grid grid-cols-4 gap-3 border border-gray-800 bg-gray-950 p-4">
              <input className="p-2 bg-gray-900 border border-gray-700" placeholder="First Name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
              <input className="p-2 bg-gray-900 border border-gray-700" placeholder="Last Name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
              <input className="p-2 bg-gray-900 border border-gray-700" placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <input className="p-2 bg-gray-900 border border-gray-700" placeholder={editing ? "New password optional" : "Password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              <select className="p-2 bg-gray-900 border border-gray-700" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as FormState["role"] })}>
                <option value="SUPER_ADMIN">SUPER ADMIN</option>
              </select>
              <select className="p-2 bg-gray-900 border border-gray-700" value={form.umbrella_branch_id} onChange={(event) => setForm({ ...form, umbrella_branch_id: event.target.value })}>
                <option value="">Unassigned internal branch</option>
                {branches.map((branch) => <option key={branch.umbrella_branch_id} value={branch.umbrella_branch_id}>{branch.name}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                Active
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={!canSave || saving} className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700">{editing ? "Update" : "Create"}</button>
                {editing && <button type="button" onClick={() => setForm(emptyForm)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700">Cancel</button>}
              </div>
            </form>

            <div className="mt-5 border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-300">
                  <tr>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Role</th>
                    <th className="p-3 text-left">Internal Branch</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((user) => (
                    <tr key={user.user_id} className="border-t border-gray-800">
                      <td className="p-3">{user.first_name} {user.last_name}</td>
                      <td className="p-3 text-gray-300">{user.email}</td>
                      <td className="p-3">
                        {user.role}
                        {isProtectedOwner(user) && (
                          <span className="ml-2 text-xs text-red-300">Protected owner</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-300">{user.umbrellaBranch?.name ?? "Unassigned"}</td>
                      <td className="p-3">{user.active ? "Active" : "Inactive"}</td>
                      <td className="p-3 flex gap-2">
                        {isProtectedOwner(user) ? (
                          <span className="px-3 py-1 text-xs text-gray-400">Locked</span>
                        ) : (
                          <>
                            <button type="button" onClick={() => setForm({ user_id: user.user_id, first_name: user.first_name, last_name: user.last_name, email: user.email, password: "", role: user.role, umbrella_branch_id: user.umbrellaBranch?.umbrella_branch_id ?? "", active: user.active })} className="px-3 py-1 bg-gray-800 hover:bg-gray-700">Edit</button>
                            <button type="button" onClick={() => void deleteUser(user)} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-red-300">Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </>
            )}
          </section>
        </div>
      </main>

      <DashboardFooter />
      {dialogElement}
      {reportDownloadDialog}
    </div>
  );
}

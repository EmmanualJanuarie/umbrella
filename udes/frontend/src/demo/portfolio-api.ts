import type { AxiosAdapter, AxiosInstance, AxiosResponse, AxiosStatic, InternalAxiosRequestConfig } from "axios";

// All records below are synthetic. They exist only in memory so the existing
// dashboards remain presentable when a public portfolio deployment has no API.
const organization = {
  org_id: "demo-organisation",
  name: "Northstar Security (Demo)",
  active: true,
  created_at: "2026-08-01T08:00:00.000Z",
};

const branch = {
  branch_id: "demo-branch",
  name: "Cape Town Operations (Demo)",
  location: "Cape Town",
  org_id: organization.org_id,
  created_at: "2026-08-01T08:00:00.000Z",
};

const users = [
  { user_id: "demo-main-super-admin", first_name: "Jordan", last_name: "Naidoo", email: "platform@udes.demo", role: "MAIN_SUPER_ADMIN", org_id: "umbrella-systems", branch_id: "umbrella-systems-hq", active: true },
  { user_id: "demo-super-admin", first_name: "Avery", last_name: "Peters", email: "superadmin@udes.demo", role: "SUPER_ADMIN", org_id: "umbrella-systems", branch_id: "umbrella-systems-hq", active: true },
  { user_id: "demo-org-owner", first_name: "Sam", last_name: "Nkosi", email: "owner@udes.demo", role: "ORG_OWNER", org_id: organization.org_id, branch_id: branch.branch_id, active: true },
  { user_id: "demo-branch-admin", first_name: "Casey", last_name: "Williams", email: "branch@udes.demo", role: "BRANCH_ADMIN", org_id: organization.org_id, branch_id: branch.branch_id, active: true },
  { user_id: "demo-officer", first_name: "Alex", last_name: "Mokoena", email: "officer@udes.demo", role: "OFFICER", org_id: organization.org_id, branch_id: branch.branch_id, active: true, officer_id: "demo-officer-record" },
];

const officer = {
  officer_id: "demo-officer-record",
  badge_number: "UDES-214",
  department: "Field Operations",
  status: "ACTIVE",
  created_at: "2026-08-01T08:00:00.000Z",
  user: { ...users[4], organization, branch },
};

const camera = {
  camera_id: "demo-camera",
  serial_number: "DEMO-BC-047",
  model: "Body Camera 4K",
  type: "UMBRELLA",
  status: "ACTIVE",
  branch_id: branch.branch_id,
  org_id: organization.org_id,
  assigned_to: officer.officer_id,
  created_at: "2026-08-01T08:00:00.000Z",
  officer,
  branch,
  organization,
};

const session = {
  session_id: "demo-session",
  officer_id: officer.officer_id,
  user_id: users[4].user_id,
  camera_id: camera.camera_id,
  shift_id: "demo-shift",
  branch_id: branch.branch_id,
  start_time: "2026-08-18T06:00:00.000Z",
  end_time: "2026-08-18T14:00:00.000Z",
  status: "COMPLETED",
  hash: "demo-integrity-hash",
  officer,
  camera,
  branch,
  organization,
};

const videos = [
  {
    video_id: "demo-video-001",
    session_id: session.session_id,
    user_id: users[4].user_id,
    file_name: "Patrol_2026-08-18_1422.mp4",
    file_path: "redacted in portfolio demo",
    format: "MP4",
    resolution: "1920x1080",
    duration: 615,
    uploaded: true,
    tamper_flag: false,
    active: true,
    storage_state: "NORMAL",
    created_at: "2026-08-18T14:24:00.000Z",
    start_timestamp: "2026-08-18T14:22:00.000Z",
    end_timestamp: "2026-08-18T14:32:15.000Z",
    start_lat: -33.9249,
    start_lon: 18.4241,
    end_lat: -33.9249,
    end_lon: 18.4241,
    storage_tier: "TEMPORARY",
    retention_status: "ACTIVE",
    retention_until: "2026-09-17T23:59:59.000Z",
    storage_provider: "DEMO_SERVICE_UNAVAILABLE",
    storage_object_exists: false,
    legal_hold: false,
    session,
    user: users[4],
  },
  {
    video_id: "demo-video-002",
    session_id: session.session_id,
    user_id: users[4].user_id,
    file_name: "Incident_2026-08-10_2014.mp4",
    file_path: "redacted in portfolio demo",
    format: "MP4",
    resolution: "1920x1080",
    duration: 980,
    uploaded: true,
    tamper_flag: false,
    active: true,
    storage_state: "CASE_NEEDED",
    created_at: "2026-08-10T20:16:00.000Z",
    start_timestamp: "2026-08-10T20:14:00.000Z",
    end_timestamp: "2026-08-10T20:30:20.000Z",
    storage_tier: "ARCHIVE",
    retention_status: "ARCHIVED",
    archive_until: "2033-08-10T23:59:59.000Z",
    storage_provider: "DEMO_SERVICE_UNAVAILABLE",
    storage_object_exists: false,
    legal_hold: true,
    legal_hold_reason: "Demonstration legal hold",
    session,
    user: users[4],
  },
];

const shifts = [{
  shift_id: "demo-shift",
  officer_id: officer.officer_id,
  camera_id: camera.camera_id,
  branch_id: branch.branch_id,
  org_id: organization.org_id,
  start_time: "2026-08-18T06:00:00.000Z",
  end_time: "2026-08-18T14:00:00.000Z",
  status: "COMPLETED",
  off_days: [],
  deleted: false,
  officer,
  camera,
}];

const audit = [
  { audit_log_id: "demo-audit-1", entity_type: "VIDEO", entity_id: "demo-video-001", action: "CREATE", performed_by: users[4].user_id, timestamp: "2026-08-18T14:24:00.000Z", dashboard_type: "OFFICER", performer: users[4], details: { description: "Synthetic portfolio upload record" } },
  { audit_log_id: "demo-audit-2", entity_type: "VIDEO", entity_id: "demo-video-001", action: "ACCESS", performed_by: users[1].user_id, timestamp: "2026-08-18T14:26:00.000Z", dashboard_type: "UMBRELLA", performer: users[1], details: { description: "Synthetic integrity verification record" } },
];

function pathFrom(config: InternalAxiosRequestConfig) {
  const raw = config.url ?? "";
  try {
    const pathname = new URL(raw, "https://portfolio.local").pathname;
    return pathname.replace(/^\/api/, "");
  } catch {
    return raw.replace(/^\/api/, "");
  }
}

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): Promise<AxiosResponse> {
  return Promise.resolve({ data, status, statusText: status === 200 ? "OK" : "Service unavailable", headers: {}, config });
}

const portfolioAdapter: AxiosAdapter = async (config) => {
  const path = pathFrom(config);
  const method = (config.method ?? "get").toLowerCase();

  if (path === "/auth/csrf") return response(config, { csrfToken: "portfolio-demo" });
  if (path === "/auth/mfa/status") return response(config, { enabled: false, confirmed_at: null });
  if (path === "/auth/mfa/setup") return response(config, { secret: "portfolio-demo", otpauth_uri: "Unavailable in portfolio demo" });
  if (path === "/video") return response(config, videos);
  if (path.startsWith("/stream-video/")) return response(config, { unavailable: true, message: "Evidence object storage service is unavailable in this portfolio demo." }, 503);
  if (path === "/camera") return response(config, [camera]);
  if (path.startsWith("/camera/")) return response(config, { ...camera, sessions: [{ ...session, videos }] });
  if (path === "/officer") return response(config, [officer]);
  if (path.startsWith("/officer/")) return response(config, { ...officer, sessions: [session], shifts });
  if (path === "/shift") return response(config, shifts);
  if (path === "/shift/officer/upload-handover-guidance") return response(config, { has_camera_handover: false, grace_minutes: 30, reminder_due: false });
  if (path === "/session") return response(config, [session]);
  if (path === "/organization") return response(config, [organization]);
  if (path === "/branches") return response(config, [branch]);
  if (path === "/user") return response(config, users);
  if (path === "/audit-log") return response(config, audit);
  if (path.startsWith("/notifications")) return response(config, []);
  if (path.includes("billing") || path.includes("usage")) return response(config, { items: [], total_storage_bytes: 0, portfolio_demo: true });
  if (path.includes("report")) return response(config, { items: [], reports: [], portfolio_demo: true });
  if (path.includes("request")) return response(config, []);
  if (path.includes("retention")) return response(config, { temporary_retention_days: 30, archive_retention_years: 7, automatic_deletion_enabled: false, portfolio_demo: true });
  if (method === "get") return response(config, []);
  return response(config, { success: true, portfolio_demo: true, message: "Action recorded locally for portfolio demonstration." });
};

export function installPortfolioDemoAdapter(api: AxiosInstance, axios: AxiosStatic) {
  api.defaults.adapter = portfolioAdapter;
  axios.defaults.adapter = portfolioAdapter;
}

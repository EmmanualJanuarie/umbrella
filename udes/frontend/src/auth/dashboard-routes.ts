export type DashboardRole =
  | "MAIN_SUPER_ADMIN"
  | "SUPER_ADMIN"
  | "OFFICER"
  | "BRANCH_ADMIN"
  | "ORG_OWNER";

const DASHBOARD_ROUTES: Record<DashboardRole, string> = {
  MAIN_SUPER_ADMIN: "/dashboard/platform",
  OFFICER: "/dashboard/officer",
  BRANCH_ADMIN: "/dashboard/branch",
  ORG_OWNER: "/dashboard/org-owner",
  SUPER_ADMIN: "/dashboard/super",
};

export function dashboardRouteForRole(role?: string | null) {
  if (!role) return null;
  return DASHBOARD_ROUTES[role as DashboardRole] ?? null;
}

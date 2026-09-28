import CollapsibleSidebarNav, { type SidebarMenuGroup } from "../CollapsibleSidebarNav";

type SidebarProps = {
  activeView: string;
  setActiveView: (view: string) => void;
};

const menuGroups: SidebarMenuGroup[] = [
  { key: "evidence", label: "Evidence", items: [{ key: "videos", label: "Evidence videos" }, { key: "video-uploads", label: "Video upload status" }, { key: "requests", label: "Video download requests" }] },
  { key: "operations", label: "Operations", items: [{ key: "sessions", label: "Duty sessions" }, { key: "shifts", label: "Shift schedules" }, { key: "cameras", label: "Cameras" }, { key: "camera-reassignments", label: "Camera assignments" }] },
  { key: "organization", label: "Organization", items: [{ key: "branches", label: "Branches" }, { key: "users", label: "Users" }] },
  { key: "records", label: "Records", items: [{ key: "reports", label: "Evidence reports" }, { key: "billing", label: "Billing centre" }, { key: "audit", label: "Activity log" }] },
];

export default function OrgOwnerDashboardSidebar({
  activeView,
  setActiveView,
}: SidebarProps) {
  return <CollapsibleSidebarNav title="Organization" subtitle="Owner workspace" groups={menuGroups} activeView={activeView} setActiveView={setActiveView} />;
}

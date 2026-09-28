import CollapsibleSidebarNav, { type SidebarMenuGroup } from "../CollapsibleSidebarNav";

type SidebarProps = {
  activeView: string;
  setActiveView: (view: string) => void;
};

const menuGroups: SidebarMenuGroup[] = [
  { key: "evidence-control", label: "Evidence control", items: [{ key: "video-uploads", label: "Video upload status" }, { key: "requests-video", label: "Video download activity" }] },
  { key: "operations", label: "Operations", items: [{ key: "sessions", label: "Duty sessions" }, { key: "cameras", label: "Cameras" }, { key: "camera-reassignments", label: "Camera assignments" }, { key: "camera-device-scan", label: "Scan connected cameras" }] },
  { key: "administration", label: "Administration", items: [{ key: "organizations", label: "Organizations" }, { key: "users", label: "Users" }, { key: "requests-password-change", label: "Password change requests" }, { key: "billing", label: "Organization billing" }] },
  { key: "records", label: "Records", items: [{ key: "audit-reports", label: "Evidence reports" }, { key: "audit", label: "Activity log" }] },
];

export default function UmbrellaDashboardSidebar({
  activeView,
  setActiveView,
}: SidebarProps) {
  return <CollapsibleSidebarNav title="Umbrella" subtitle="Platform controls" groups={menuGroups} activeView={activeView} setActiveView={setActiveView} />;
}

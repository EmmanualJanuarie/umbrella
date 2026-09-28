import CollapsibleSidebarNav, { type SidebarMenuGroup } from "../CollapsibleSidebarNav";

type SidebarProps = {
  activeView: string;
  setActiveView: (view: string) => void;
};

const menuGroups: SidebarMenuGroup[] = [
  { key: "daily-operations", label: "Daily operations", items: [{ key: "sessions", label: "Duty sessions" }, { key: "shifts", label: "Shift schedules" }, { key: "officers", label: "Officers" }] },
  { key: "evidence", label: "Evidence", items: [{ key: "videos", label: "Evidence videos" }, { key: "requests", label: "Video download requests" }] },
  { key: "equipment", label: "Equipment", items: [{ key: "cameras", label: "Cameras" }, { key: "camera-reassignments", label: "Camera assignments" }] },
  { key: "records", label: "Records", items: [{ key: "reports", label: "Evidence reports" }] },
];

export default function BranchDashboardSidebar({
  activeView,
  setActiveView,
}: SidebarProps) {
  return <CollapsibleSidebarNav title="Branch" subtitle="Operations workspace" groups={menuGroups} activeView={activeView} setActiveView={setActiveView} />;
}

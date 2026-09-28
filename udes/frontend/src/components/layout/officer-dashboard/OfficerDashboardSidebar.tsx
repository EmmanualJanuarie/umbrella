import CollapsibleSidebarNav, { type SidebarMenuGroup } from "../CollapsibleSidebarNav";

type SidebarProps = {
  activeView: string;
  setActiveView: (view: string) => void;
};

const menuGroups: SidebarMenuGroup[] = [
  { key: "my-duty", label: "My duty", items: [{ key: "shifts", label: "My shifts" }, { key: "sessions", label: "My duty sessions" }, { key: "cameras", label: "My body camera" }] },
  { key: "evidence", label: "Evidence", items: [{ key: "evidence-upload", label: "Upload camera videos" }, { key: "videos", label: "My evidence videos" }] },
];

export default function OfficerDashboardSidebar({
  activeView,
  setActiveView,
}: SidebarProps) {
  return <CollapsibleSidebarNav title="Officer" subtitle="Field workspace" groups={menuGroups} activeView={activeView} setActiveView={setActiveView} />;
}

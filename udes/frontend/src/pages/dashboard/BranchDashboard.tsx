import DashboardShell from "../../components/layout/DashboardShell";
import BranchDashboardSidebar from "../../components/layout/branch-dashboard/BranchDashboardSIdebar";
import BranchDashboardContent from "../../components/layout/branch-dashboard/BranchDashboardContent";
import { useScreenSize } from "../../hooks/useScreensSize";
import { useUser } from "../../context/UserContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useRememberedDashboardPane } from "../../hooks/useRememberedDashboardPane";

export default function BranchAdminDashboard() {
  const { screenState, screenMessage } = useScreenSize();
  const { user } = useUser();
  const [activeView, setActiveView] = useRememberedDashboardPane(
    "branch-admin",
    user?.user_id,
  );
  useDocumentTitle(activeView, user?.branch?.name ?? "Branch");

  return (
    <DashboardShell
      title={user?.branch?.name || "Branch Admin Dashboard"}
      screenState={screenState}
      screenMessage={screenMessage}
      sidebar={
        <BranchDashboardSidebar
          activeView={activeView}
          setActiveView={setActiveView}
        />
      }
    >
      <BranchDashboardContent activeView={activeView} />
    </DashboardShell>
  );
}

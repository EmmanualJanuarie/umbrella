import DashboardShell from "../../components/layout/DashboardShell";
import OfficerDashboardSidebar from "../../components/layout/officer-dashboard/OfficerDashboardSidebar";
import OfficerDashboardContent from "../../components/layout/officer-dashboard/OfficerDashboardContent";
import { useScreenSize } from "../../hooks/useScreensSize";
import { useUser } from "../../context/UserContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useRememberedDashboardPane } from "../../hooks/useRememberedDashboardPane";

export default function OfficerDashboard() {
  const { screenState, screenMessage } = useScreenSize();
  const { user } = useUser();
  const [activeView, setActiveView] = useRememberedDashboardPane(
    "officer",
    user?.user_id,
  );
  useDocumentTitle(activeView, user?.branch?.name ?? "Officer Workspace");

  return (
    <DashboardShell
      title={user?.branch?.name || "Officer Dashboard"}
      isOfficerDashboard
      screenState={screenState}
      screenMessage={screenMessage}
      sidebar={
        <OfficerDashboardSidebar
          activeView={activeView}
          setActiveView={setActiveView}
        />
      }
    >
      <OfficerDashboardContent activeView={activeView} />
    </DashboardShell>
  );
}

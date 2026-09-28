import UmbrellaDashboardContent from "../../components/layout/umbrella-dashboard/UmbrellaDashboardContent";
import DashboardShell from "../../components/layout/DashboardShell";
import UmbrellaDashboardSidebar from "../../components/layout/umbrella-dashboard/UmbrellaDashboardSidebar";
import { useScreenSize } from "../../hooks/useScreensSize";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useUser } from "../../context/UserContext";
import { useRememberedDashboardPane } from "../../hooks/useRememberedDashboardPane";

export default function UmbrellaAdminDashboard() {
  const { screenState, screenMessage } = useScreenSize();
  const { user } = useUser();
  const [activeView, setActiveView] = useRememberedDashboardPane(
    "super-admin",
    user?.user_id,
  );
  useDocumentTitle(activeView, "Umbrella Platform");

  return (
    <DashboardShell
      title="Umbrella Systems Dashboard"
      screenState={screenState}
      screenMessage={screenMessage}
      sidebar={
        <UmbrellaDashboardSidebar
          activeView={activeView}
          setActiveView={setActiveView}
        />
      }
    >
      <UmbrellaDashboardContent activeView={activeView} />
    </DashboardShell>
  );
}

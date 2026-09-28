import DashboardShell from "../../components/layout/DashboardShell";
import OrgOwnerDashboardSidebar from "../../components/layout/org-owner-dashboard/OrgOwnerDashboardSidebar";
import OrgOwnerDashboardContent from "../../components/layout/org-owner-dashboard/OrgOwnerDashboardContent";
import { useScreenSize } from "../../hooks/useScreensSize";
import { useUser } from "../../context/UserContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useRememberedDashboardPane } from "../../hooks/useRememberedDashboardPane";

export default function OrgOwnerDashboard() {
  const { screenState, screenMessage } = useScreenSize();
  const { user } = useUser();
  const [activeView, setActiveView] = useRememberedDashboardPane(
    "org-owner",
    user?.user_id,
  );
  useDocumentTitle(activeView, user?.organization?.name ?? "Organization");

  return (
    <DashboardShell
      title={user?.organization?.name || "Organization Owner Dashboard"}
      screenState={screenState}
      screenMessage={screenMessage}
      sidebar={
        <OrgOwnerDashboardSidebar
          activeView={activeView}
          setActiveView={setActiveView}
        />
      }
    >
      <OrgOwnerDashboardContent activeView={activeView} />
    </DashboardShell>
  );
}

import DashboardPlaceholder from "../DashboardPlaceholder";
import AuditLogs from "../../../modules/super-admin/AuditLogs";
import AuditReports from "../../../modules/super-admin/AuditReports";
import CameraDeviceScan from "../../../modules/super-admin/CameraDeviceScan";
import CameraInventory from "../../../modules/super-admin/CameraInventory";
import CameraReassignments from "../../../modules/shared/CameraReassignments";
import Organizations from "../../../modules/super-admin/Organizations";
import PasswordChangeRequests from "../../../modules/super-admin/PasswordChangeRequest";
import Sessions from "../../../modules/super-admin/Sessions";
import Users from "../../../modules/super-admin/Users";
import VideoRequests from "../../../modules/super-admin/VideoRequests";
import BillingCentre from "../../../modules/super-admin/UsageTracker";
import VideoUploadActivity from "../../../modules/shared/VideoUploadActivity";

type ContentProps = {
  activeView: string;
};

export default function UmbrellaDashboardContent({ activeView }: ContentProps) {
  return (
    <main className="platform-control-pane box-border h-full min-h-0 flex-1 overflow-y-auto p-6">

      {!activeView && <DashboardPlaceholder />}
            
      {activeView === "cameras" && <CameraInventory />}
      {activeView === "camera-reassignments" && <CameraReassignments scope="platform" />}
      {activeView === "camera-device-scan" && <CameraDeviceScan />}
      {activeView === "organizations" && <Organizations />}
      {activeView === "sessions" && <Sessions />}
      {activeView === "audit" && <AuditLogs />}
      {activeView === "audit-reports" && <AuditReports />}
      {activeView === "billing" && <BillingCentre scope="platform" />}
      {activeView === "requests-video" && <VideoRequests />}
      {activeView === "video-uploads" && (
        <VideoUploadActivity scopeLabel="Platform" showCompletedTab />
      )}
      {activeView === "requests-password-change" && <PasswordChangeRequests />}
      {activeView === "users" && <Users />}
      

    </main>
  );
}

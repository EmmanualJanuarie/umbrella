import DashboardPlaceholder from "../DashboardPlaceholder";
import AuditLogs from "../../../modules/org-owner/AuditLogs";
import Branches from "../../../modules/org-owner/Branches";
import Cameras from "../../../modules/org-owner/Cameras";
import Sessions from "../../../modules/org-owner/Sessions";
import Shifts from "../../../modules/org-owner/Shifts";
import Users from "../../../modules/org-owner/Users";
import VideoRequests from "../../../modules/org-owner/VideoRequests";
import Videos from "../../../modules/org-owner/Videos";
import Reports from "../../../modules/org-owner/Reports";
import CameraReassignments from "../../../modules/shared/CameraReassignments";
import VideoUploadActivity from "../../../modules/shared/VideoUploadActivity";
import BillingCentre from "../../../modules/super-admin/UsageTracker";

type ContentProps = {
  activeView: string;
};

export default function OrgOwnerDashboardContent({ activeView }: ContentProps) {
  return (
    <main className="h-full min-h-0 overflow-auto p-3 sm:p-6">

      {!activeView && <DashboardPlaceholder />}

      {activeView === "cameras" && <Cameras />}
      {activeView === "camera-reassignments" && <CameraReassignments scope="organization" />}
      {activeView === "branches" && <Branches />}
      {activeView === "sessions" && <Sessions />}
      {activeView === "audit" && <AuditLogs />}
      {activeView === "billing" && <BillingCentre scope="organization" />}
      {activeView === "shifts" && <Shifts />}
      {activeView === "videos" && <Videos />}
      {activeView === "video-uploads" && <VideoUploadActivity scopeLabel="Organization" />}
      {activeView === "reports" && (
        <div className="h-full min-h-0 overflow-y-scroll pr-2 pb-8">
          <Reports />
        </div>
      )}
      {activeView === "requests" && <VideoRequests />}
      {activeView === "users" && <Users />}
      

    </main>
  );
}

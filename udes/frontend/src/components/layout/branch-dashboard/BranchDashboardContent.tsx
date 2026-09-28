import DashboardPlaceholder from "../DashboardPlaceholder";
import Cameras from "../../../modules/branch-admin/Cameras";
import Sessions from "../../../modules/branch-admin/Sessions";
import Shifts from "../../../modules/branch-admin/Shifts";
import Officers from "../../../modules/branch-admin/Officers";
import VideoRequests from "../../../modules/branch-admin/VideoRequest";
import Videos from "../../../modules/branch-admin/Videos";
import Reports from "../../../modules/branch-admin/Reports";
import CameraReassignments from "../../../modules/shared/CameraReassignments";

type ContentProps = {
  activeView: string;
};

export default function BranchDashboardContent({ activeView }: ContentProps) {
  return (
    <main className="h-full min-h-0 overflow-auto p-3 sm:p-6">

      {!activeView && <DashboardPlaceholder />}

      {activeView === "cameras" && <Cameras />}
      {activeView === "camera-reassignments" && <CameraReassignments scope="branch" />}
      {activeView === "sessions" && <Sessions />}
      {activeView === "videos" && <Videos />}
      {activeView === "shifts" && <Shifts />}
      {activeView === "reports" && (
        <div className="h-full min-h-0 overflow-y-scroll pr-2 pb-8">
          <Reports />
        </div>
      )}
      {activeView === "requests" && <VideoRequests />}
      {activeView === "officers" && <Officers />}
      

    </main>
  );
}

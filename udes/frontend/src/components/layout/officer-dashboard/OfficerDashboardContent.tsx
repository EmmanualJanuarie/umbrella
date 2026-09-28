import DashboardPlaceholder from "../DashboardPlaceholder";
import Camera from "../../../modules/officer/Camera";
import Shifts from "../../../modules/officer/Shifts";
import Sessions from "../../../modules/officer/Sessions";
import Videos from "../../../modules/officer/Videos";
import EvidenceIngest from "../../../modules/branch-admin/EvidenceIngest";

type ContentProps = {
  activeView: string;
};



export default function OfficerDashboardContent({ activeView }: ContentProps) {
  return (
    <main className="h-full min-h-0 flex-1 overflow-auto p-3 sm:p-6">

      {!activeView && <DashboardPlaceholder />}
      
      {activeView === "evidence-upload" && <EvidenceIngest />}
      {activeView === "shifts" && <Shifts />}
      {activeView === "cameras" && <Camera />}
      {activeView === "sessions" && <Sessions />}
      {activeView === "videos" && <Videos />}
      

    </main>
  );
}

import { useEffect, useState } from "react";
import { useUser } from "../../context/UserContext";

export default function DashboardFooter() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user } = useUser();

  useEffect(()=>{
    const timer = setInterval(()=>{
        setCurrentTime(new Date());
    }, 1000); //updates every second

    return () => clearInterval(timer);
  }, []);

  //format time and timezone
  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'});
  const organizationName =
    user?.organization?.name ??
    (user?.org_id === "umbrella-systems" ? "Umbrella Systems" : user?.org_id);
  const branchName =
    user?.umbrellaBranch?.name ??
    user?.branch?.name ??
    user?.umbrella_branch_id ??
    user?.branch_id;

  return (
    <footer className="border-t-color-gray p-4 bg-body-black text-color-white flex flex-wrap justify-around items-center text-sm">
      {/* Online status */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
        <span>Online</span>
      </div>

      {/* User Email */}
      <div className="min-w-[150px]">
        <span className="font-semibold">Email:</span>{" "}
        <span>{user?.email || "Loading..."}</span>
      </div>

      {/* User Role */}
      <div className="min-w-[120px]">
        <span className="font-semibold">Role:</span>{" "}
        <span>{user?.role?.replaceAll("_", " ") || "Loading..."}</span>
      </div>

      {/* User Branch */}

      <div className="min-w-[120px]">
        <span className="font-semibold">Branch:</span>{" "}
        <span>{branchName || "Not assigned"}</span>
      </div>

      {/* User ORG */}
      <div className="min-w-[150px]">
        <span className="font-semibold">Organization:</span>{" "}
        <span>{organizationName || "Not assigned"}</span>
      </div>

      {/* TimeZone */}
      <div className="min-w-[120px]">
        <span className="font-semibold">Time:</span>{" "}
        <span>{timeString}</span>
      </div>

      {/* User Branch */}
      <div className="min-w-[120px]">
        <span className="font-semibold">Version:</span>{" "}
        <span>1.0.0 (BETA)</span>
      </div>
    </footer>
  );
}

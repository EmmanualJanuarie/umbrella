import { useState, useEffect } from "react";
import Logo from "../../common/Logo";
import DashboardDropdownMenu from "../modals/DashboardDropdown";
import AlertsDropdown from "../modals/AlertsDropdown";


type dashboardHeaderProps = {
  dash_identifier?: string;
  isOfficer_dashboard: boolean;
};

export default function UmbrellaDashboardHeader({
  dash_identifier,
}: dashboardHeaderProps) {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkScreen = () => setIsDesktop(window.innerWidth >= 1024);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);


  if (!isDesktop) return null;

  return (
    <header className="bg-header-black border-b-4 border-red-600">
      <nav className="mx-auto flex max-w-7x1 items-center gap-20 p-6 lg:px-8 text-color-white">
        {/* LEFT */}
        <div className="flex flex-1 items-center gap-20">
          <div className="flex items-center">
            <Logo set_classname="logo-rem-3" />
            <div className="flex flex-col ml-2">
              <span className="font-extrabold text-2xl">Umbrella</span>
              <span className="text-sm">Systems</span>
            </div>
          </div>

          <div className="flex gap-4 md:gap-6 lg:gap-12 xl:gap-20 2xl:gap-[30rem]">
            <span className="font-bold text-lg md:text-xl lg:text-2xl">
              Digital Evidence System
            </span>
            <span className="font-bold text-lg md:text-xl lg:text-2xl">
              {dash_identifier}
            </span>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-8">
          <AlertsDropdown />
          <DashboardDropdownMenu
            defaultIcon="/white_hamburger.png"
            hoverIcon="/red_hamburger.png"
          />
        </div>
      </nav>
    </header>
  );
}

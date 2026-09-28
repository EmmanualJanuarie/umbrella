import { useState, useEffect } from "react";
import Logo from "../../common/Logo";
import DropdownMenu from "../modals/LoginDropdown";

export default function Header() {
  const [isDesktop, setIsDesktop] = useState(true);
  const [isTooWide, setIsTooWide] = useState(false); // NEW

  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      setIsDesktop(width >= 1024); // Tailwind 'lg' breakpoint
      setIsTooWide(width > 1920); // NEW: hide header on super-wide screens
    };

    checkScreen(); // initial check
    window.addEventListener("resize", checkScreen);

    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // hide header on mobile or super-wide screens
  if (!isDesktop || isTooWide) return null;

  return (
    <header className="bg-header-black border-b-4 border-red-600">
      <nav className="mx-auto flex max-w-7x1 items-center gap-20 p-6 lg:px-8 text-color-white">

        {/* GROUP SECTION */}
        <div className="flex flex-1 items-center gap-20">
          {/* FIRST NAVBAR SECTION */}
          <div className="flex items-center">
            <div>
              <Logo set_classname="logo-rem-3"/>
            </div>

            <div className="flex flex-col ml-2">
              <span className="font-extrabold text-2xl">Umbrella</span>
              <span className="text-sm">Systems</span>
            </div>
          </div>

          {/* SECOND NAVBAR SECTION */}
          <div className="flex justify-">
            <span className="font-bold text-2xl">Digital Evidence System</span>
          </div>
        </div>

        {/* THIRD NAVBAR SECTION */}
        <div className="flex flex-row center">
          <div>
            <DropdownMenu 
              defaultIcon={`${import.meta.env.BASE_URL}white_hamburger.png`} 
              hoverIcon={`${import.meta.env.BASE_URL}red_hamburger.png`}
            />
          </div>
        </div>

      </nav>
    </header>
  );
}

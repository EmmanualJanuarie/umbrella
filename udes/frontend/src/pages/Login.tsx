import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardRouteForRole } from "../auth/dashboard-routes";
import { useUser } from "../context/UserContext";

import Header from "../components/layout/Header";
import LoginForm from "../components/layout/LoginForm";
import LoadingScreen from "../components/layout/LoadingScreen";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function Login() {
  useDocumentTitle("Sign In");
  const [isDesktop, setIsDesktop] = useState(true);
  const [isTooWide, setIsTooWide] = useState(false); // NEW
  const navigate = useNavigate();
  const { user, loading: checkingSession } = useUser();

  // Redirect authenticated users without making a second session request.
  useEffect(() => {
    if (!user) return;

    const route = dashboardRouteForRole(user.role);
    if (route) navigate(route, { replace: true });
  }, [navigate, user]);

  // Check screen size
  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      setIsDesktop(width >= 1024); // Tailwind 'lg'
      setIsTooWide(width > 1920); // NEW: wide-screen warning
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      {/* HEADER COMPONENT */}
      <Header />

      {/* PAGE CONTENT */}
      <div className="flex-1 flex items-center justify-center bg-body-black px-4 text-color-white text-center">
        {checkingSession ? (
          <LoadingScreen />
        ) : isTooWide ? (
          <p className="text-lg font-bold">
            Your screen is too wide for the Digital Evidence System portal.
            <br />
            Please reduce the width to an appropriate size.
          </p>
        ) : isDesktop ? (
          <LoginForm />
        ) : (
          <p className="text-lg font-bold">
            Sorry, the Digital Evidence System portal is only available on laptops and desktops.
            <br />
            Please access it from a larger screen.
          </p>
        )}
      </div>
    </div>
  );
}

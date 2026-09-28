import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import LoadingScreen from "../layout/LoadingScreen";
import type { DashboardRole } from "../../auth/dashboard-routes";
import { useUser } from "../../context/UserContext";
import { isPortfolioDemo } from "../../config/runtime";

const PLATFORM_OWNER_EMAIL = "emmanualjanuarie@umbrellasystems.co.za";

interface PrivateRouteProps {
  children: ReactNode;
  requiredRole?: DashboardRole;
}

export default function PrivateRoute({ children, requiredRole }: PrivateRouteProps) {
  const { user, loading, sessionError } = useUser();

  // While checking session, show loading
  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-body-black text-center text-white">
        <LoadingScreen />
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!user && sessionError) {
    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-body-black text-center text-white">
        <LoadingScreen />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Logged in but role does not match → redirect to login or unauthorized page
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/login" replace />;

  if (
    !isPortfolioDemo &&
    requiredRole === "MAIN_SUPER_ADMIN" &&
    user.user_id !== import.meta.env.VITE_MAIN_SUPER_ADMIN_ID &&
    user.email?.toLowerCase() !== PLATFORM_OWNER_EMAIL
  ) {
    return <Navigate to="/login" replace />;
  }

  // User is allowed → render children
  return <>{children}</>;
}

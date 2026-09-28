import { lazy, Suspense } from "react";
import { createBrowserRouter, createHashRouter, Navigate } from "react-router-dom";
import App from "./App";
import PrivateRoute from "../components/routing/PrivateRoute";
import LoadingScreen from "../components/layout/LoadingScreen";
import { isPortfolioDemo } from "../config/runtime";

const Login = lazy(() => import("../pages/Login"));
const NotFound = lazy(() => import("../pages/NotFound"));
const OfficerDashboard = lazy(() => import("../pages/dashboard/OfficerDashboard"));
const BranchDashboard = lazy(() => import("../pages/dashboard/BranchDashboard"));
const UmbrellaAdminDashboard = lazy(
  () => import("../pages/dashboard/UmbrellaAdminDashboard")
);
const PlatformOwnerDashboard = lazy(
  () => import("../pages/dashboard/PlatformOwnerDashboard")
);
const OrgOwnerDashboard = lazy(() => import("../pages/dashboard/OrgOwnerDashboard"));
const HelpPage = lazy(() => import("../pages/dashboard/Help"));
const VideoAccessDenied = lazy(() => import("../pages/VideoAccessDenied"));

function RouteLoader() {
  return <LoadingScreen />;
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteLoader />}>{element}</Suspense>;
}

const createUdesRouter = isPortfolioDemo ? createHashRouter : createBrowserRouter;

export const router = createUdesRouter([
  {
    path: "/",
    element: <App />,
    children: [

      { 
        index: true, 
        element: <Navigate to="login" replace /> 
      },


      // =========================
      // Authentication
      // =========================
      { 
        path: "login", 
        element: withSuspense(<Login />) 
      },


      // =========================
      // Public Error Pages
      // =========================
      {
        path: "video-access-denied",
        element: withSuspense(<VideoAccessDenied />),
      },


      // =========================
      // Officer Dashboard
      // =========================
      {
        path: "dashboard/officer",
        element: withSuspense(
          <PrivateRoute requiredRole="OFFICER">
            <OfficerDashboard />
          </PrivateRoute>
        ),
      },


      // =========================
      // Branch Dashboard
      // =========================
      {
        path: "dashboard/branch",
        element: withSuspense(
          <PrivateRoute requiredRole="BRANCH_ADMIN">
            <BranchDashboard />
          </PrivateRoute>
        ),
      },


      // =========================
      // Organization Owner
      // =========================
      {
        path: "dashboard/org-owner",
        element: withSuspense(
          <PrivateRoute requiredRole="ORG_OWNER">
            <OrgOwnerDashboard />
          </PrivateRoute>
        ),
      },


      // =========================
      // Umbrella Admin
      // =========================
      {
        path: "dashboard/super",
        element: withSuspense(
          <PrivateRoute requiredRole="SUPER_ADMIN">
            <UmbrellaAdminDashboard />
          </PrivateRoute>
        ),
      },


      // =========================
      // Platform Owner
      // =========================
      {
        path: "dashboard/platform",
        element: withSuspense(
          <PrivateRoute requiredRole="MAIN_SUPER_ADMIN">
            <PlatformOwnerDashboard />
          </PrivateRoute>
        ),
      },



      // =========================
      // Help Page
      // =========================
      {
        path: "help",
        element: withSuspense(<HelpPage />),
      },

    ],
  },


  // =========================
  // 404
  // =========================
  { 
    path: "*", 
    element: withSuspense(<NotFound />) 
  },

]);

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "./index.css";
import { UserProvider } from "./context/UserContext";
import { installCsrfProtection } from "./api/csrf";
import { isPortfolioDemo } from "./config/runtime";

if (!isPortfolioDemo) {
  installCsrfProtection();
}

const application = <RouterProvider router={router} />;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UserProvider>{application}</UserProvider>
  </React.StrictMode>
);

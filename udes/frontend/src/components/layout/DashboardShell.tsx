import type { ReactNode } from "react";
import DashboardFooter from "./DashboardFooter";
import DashboardHeader from "./DashboardHeader";
import { isPortfolioDemo } from "../../config/runtime";

type DashboardShellProps = {
  title: string;
  isOfficerDashboard?: boolean;
  screenState: string;
  screenMessage: string;
  sidebar: ReactNode;
  children: ReactNode;
};

export default function DashboardShell({
  title,
  isOfficerDashboard = false,
  screenState,
  screenMessage,
  sidebar,
  children,
}: DashboardShellProps) {
  if (screenState !== "desktop") {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-body-black text-color-white text-center p-4">
          <p className="text-lg font-bold">{screenMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-body-black text-color-white">
      <DashboardHeader
        dash_identifier={title}
        isOfficer_dashboard={isOfficerDashboard}
      />

      <div className="flex-1 min-h-0 bg-body-black px-4 py-4 text-white">
        {isPortfolioDemo && (
          <div className="mb-3 border border-amber-300/30 bg-amber-300/[0.08] px-4 py-2 text-xs leading-5 text-amber-50">
            <span className="font-semibold">Portfolio demo:</span> all displayed records are synthetic. Cloud video storage, managed database, maps and workers are unavailable in this build; their production purpose remains represented in the interface.
          </div>
        )}
        <div className="h-full min-h-0 grid grid-cols-[260px_minmax(0,1fr)] gap-4">
          <aside className="min-h-0 overflow-y-auto border border-red-900/70 bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            {sidebar}
          </aside>

          <section className="min-h-0 overflow-hidden border border-white/10 bg-black/25 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            {children}
          </section>
        </div>
      </div>

      <DashboardFooter />
    </div>
  );
}

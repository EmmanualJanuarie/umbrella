import { useState } from "react";
import { useUser } from "../../context/UserContext";
import MonthlyReportLibrary from "../shared/MonthlyReportLibrary";
import ImmediateEvidenceReport from "../shared/ImmediateEvidenceReport";

export default function AuditReports() {
  const { user } = useUser();
  const isMainSuperAdmin = user?.role === "MAIN_SUPER_ADMIN";
  const [tab, setTab] = useState<"GOVERNANCE" | "REPORTS">(
    isMainSuperAdmin ? "GOVERNANCE" : "REPORTS",
  );

  return (
    <div className="autohide-scrollbar flex h-full min-h-0 max-h-full flex-col gap-4 overflow-x-hidden overflow-y-scroll overscroll-contain bg-body-black p-5 pr-3 text-white [scrollbar-gutter:stable]">
      <header className="border border-white/10 bg-gradient-to-r from-red-950/35 via-black/30 to-black/15 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
          {isMainSuperAdmin ? "Platform report governance" : "Umbrella branch oversight"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Audit reports</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
          Monthly audit and custody records are closed automatically by the
          backend. The archive is read-only, tenant-scoped, and every report
          disclosure requires an audited reason.
        </p>
      </header>

      {isMainSuperAdmin && (
        <nav
          className="grid grid-cols-2 border border-white/10 bg-black/30 p-1"
          aria-label="Main Super Admin audit report tabs"
        >
          {[
            ["GOVERNANCE", "Governance"],
            ["REPORTS", "Generated Reports"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as "GOVERNANCE" | "REPORTS")}
              className={`px-4 py-3 text-sm font-semibold transition ${
                tab === key
                  ? "bg-red-600 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      {isMainSuperAdmin && tab === "GOVERNANCE" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {[
            {
              eyebrow: "Calendar close",
              title: "Automatic month-end generation",
              body: "The reporting month ends at 23:59:59.999 Africa/Johannesburg time. The worker creates the closed-month archive shortly after midnight and catches up safely after an outage.",
            },
            {
              eyebrow: "Coverage",
              title: "Organization and branch visibility",
              body: "Use the Generated Reports tab to filter by year, month, organization, and branch. Main Super Admin access covers every authorized automatically generated report.",
            },
            {
              eyebrow: "Disclosure control",
              title: "Mandatory download justification",
              body: "The backend refuses report downloads without a meaningful reason. Successful disclosures record the person, report, reason, timestamp, scope, and network context.",
            },
            {
              eyebrow: "Evidence accountability",
              title: "Scoped chain of custody",
              body: "Branch and organization reports remain tenant-bound. Super Admin custody reports disclose only Umbrella Systems involvement with videos belonging to the selected client organization.",
            },
          ].map((card) => (
            <article
              key={card.title}
              className="border border-white/10 bg-black/25 p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">
                {card.eyebrow}
              </p>
              <h2 className="mt-2 text-lg font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">{card.body}</p>
            </article>
          ))}
          <div className="border border-amber-500/25 bg-amber-500/[0.06] p-5 lg:col-span-2">
            <p className="font-semibold text-amber-100">Historical access control</p>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Reports from a previous year require the signed-in user&apos;s
              authenticator code. Sensitive audit exports continue to use the
              dedicated sensitive-export authenticator and remain separate from
              standard redacted archive reports.
            </p>
          </div>
        </section>
      ) : (
        <div className="autohide-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
          <ImmediateEvidenceReport />
          <MonthlyReportLibrary />
        </div>
      )}
    </div>
  );
}

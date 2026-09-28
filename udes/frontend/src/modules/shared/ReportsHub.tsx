import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { api } from "../../api/axios";
import MonthlyReportLibrary from "./MonthlyReportLibrary";
import { useReportDownload } from "./useReportDownload";
import ImmediateEvidenceReport from "./ImmediateEvidenceReport";

type SessionReportRow = {
  session_id: string;
  start_time: string;
  status: string;
  officer?: { user?: { first_name?: string; last_name?: string } };
};

type ReportsHubProps = {
  scopeLabel: "Organization" | "Branch";
};

export default function ReportsHub({ scopeLabel }: ReportsHubProps) {
  const [tab, setTab] = useState<"MONTHLY" | "OPERATIONAL">("MONTHLY");
  const [sessions, setSessions] = useState<SessionReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { requestDownload, dialogElement } = useReportDownload();

  const loadOperationalReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sessionResponse = await api.get<SessionReportRow[]>("/session");
      setSessions(Array.isArray(sessionResponse.data) ? sessionResponse.data : []);
    } catch (loadError) {
      const message = axios.isAxiosError(loadError)
        ? loadError.response?.data?.message
        : null;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message ?? "Operational reports could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "OPERATIONAL") void loadOperationalReports();
  }, [loadOperationalReports, tab]);

  return (
    <div className="min-h-full space-y-4 pb-8 text-white">
      <header className="border border-white/10 bg-gradient-to-r from-red-950/30 via-black/30 to-black/20 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
          {scopeLabel} reporting workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Reports and disclosures</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
          Monthly governance reports are produced automatically from
          server-controlled records. Operational reports remain available for
          individual sessions.
        </p>
      </header>

      <nav
        className="grid grid-cols-2 border border-white/10 bg-black/30 p-1"
        aria-label="Report workspace tabs"
      >
        {[
          ["MONTHLY", "Automatic Monthly Reports"],
          ["OPERATIONAL", "Session Reports"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as "MONTHLY" | "OPERATIONAL")}
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

      {tab === "MONTHLY" ? (
        <>
          <ImmediateEvidenceReport />
          <MonthlyReportLibrary />
        </>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between border border-white/10 bg-black/25 p-4">
            <div>
              <h2 className="font-semibold">Operational report register</h2>
              <p className="mt-1 text-sm text-white/45">
                PDF downloads are recorded automatically in the audit trail.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadOperationalReports()}
              disabled={loading}
              className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error && (
            <div className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <ReportTable
              title="Session Reports"
              empty="No session reports are available."
              rows={sessions.map((session) => ({
                id: session.session_id,
                primary: new Date(session.start_time).toLocaleString(),
                secondary: session.officer?.user
                  ? `${session.officer.user.first_name ?? ""} ${session.officer.user.last_name ?? ""}`.trim()
                  : "Officer unavailable",
                status: session.status,
                onDownload: () =>
                  requestDownload({
                    url: `/session/pdf/${session.session_id}`,
                    fileName: `session-${session.session_id}.pdf`,
                    title: "Download Session Report",
                  }),
              }))}
            />
          </div>
        </section>
      )}
      {dialogElement}
    </div>
  );
}

function ReportTable({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{
    id: string;
    primary: string;
    secondary: string;
    status: string;
    onDownload: () => void;
  }>;
}) {
  return (
    <section className="overflow-hidden border border-white/10 bg-black/25">
      <h3 className="border-b border-white/10 p-4 font-semibold">{title}</h3>
      <div className="max-h-96 overflow-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="sticky top-0 bg-gray-950 text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="p-3">Record</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="p-3">
                  <p className="font-semibold">{row.primary}</p>
                  <p className="mt-1 text-xs text-white/40">{row.secondary}</p>
                </td>
                <td className="p-3">{row.status}</td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={row.onDownload}
                    className="border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-white/40">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

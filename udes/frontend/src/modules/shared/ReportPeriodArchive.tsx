import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api } from "../../api/axios";

export type ReportPeriodSelection = {
  year: number;
  month: number;
  label: string;
  periodStart: string;
  periodEnd: string;
  requiresMfa: boolean;
};

type StoredAuditReport = {
  report_id: string;
  generated_at: string;
  entry_count: number;
};

type StoredCustodyReport = {
  report_id: string;
  video_id?: string | null;
  generated_at: string;
  case_reference?: string | null;
  purpose?: string | null;
  verification_status: string;
};

type CalendarMonth = {
  month: number;
  label: string;
  period_start: string;
  period_end: string;
  requires_mfa: boolean;
  audit_reports: StoredAuditReport[];
  chain_of_custody_reports: StoredCustodyReport[];
};

type CalendarYear = {
  year: number;
  requires_mfa: boolean;
  months: CalendarMonth[];
};

type ReportCalendar = {
  current_year: number;
  earliest_year: number;
  mfa: { enabled: boolean; confirmed_at?: string | null };
  years: CalendarYear[];
};

type Props = {
  scope: "BRANCH" | "ORG";
  scopeId?: string;
  onPeriodChange: (selection: ReportPeriodSelection) => void;
  mfaCode: string;
  onMfaCodeChange: (code: string) => void;
  refreshKey?: number;
  compact?: boolean;
};

export default function ReportPeriodArchive({
  scope,
  scopeId,
  onPeriodChange,
  mfaCode,
  onMfaCodeChange,
  refreshKey = 0,
  compact = false,
}: Props) {
  const [calendar, setCalendar] = useState<ReportCalendar | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [setupUri, setSetupUri] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    if (!scopeId) return;
    setLoading(true);
    setError("");
    api
      .get<ReportCalendar>("/audit-report/calendar", {
        params: { scope, scope_id: scopeId },
      })
      .then(({ data }) => {
        setCalendar(data);
        const year =
          data.years.find((entry) => entry.year === selectedYear) ??
          data.years[0];
        if (!year) return;
        const month =
          year.months.find((entry) => entry.month === selectedMonth) ??
          year.months[0];
        setSelectedYear(year.year);
        if (month) setSelectedMonth(month.month);
      })
      .catch((loadError) => {
        const message = axios.isAxiosError(loadError)
          ? loadError.response?.data?.message
          : null;
        setError(
          Array.isArray(message)
            ? message.join(", ")
            : message ?? "The report month archive could not be loaded.",
        );
      })
      .finally(() => setLoading(false));
  }, [scope, scopeId, refreshKey]);

  const year = useMemo(
    () => calendar?.years.find((entry) => entry.year === selectedYear),
    [calendar, selectedYear],
  );
  const month = useMemo(
    () => year?.months.find((entry) => entry.month === selectedMonth),
    [year, selectedMonth],
  );

  useEffect(() => {
    if (!month) return;
    onPeriodChange({
      year: selectedYear,
      month: selectedMonth,
      label: `${month.label} ${selectedYear}`,
      periodStart: month.period_start,
      periodEnd: month.period_end,
      requiresMfa: month.requires_mfa,
    });
  }, [month, onPeriodChange, selectedMonth, selectedYear]);

  const startMfaSetup = async () => {
    setSetupLoading(true);
    setError("");
    try {
      const { data } = await api.post<{ secret: string; otpauth_uri: string }>(
        "/auth/mfa/setup",
        {},
      );
      setSetupSecret(data.secret);
      setSetupUri(data.otpauth_uri);
      onMfaCodeChange("");
    } catch (setupError) {
      const message = axios.isAxiosError(setupError)
        ? setupError.response?.data?.message
        : null;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message ?? "Authenticator setup could not be started.",
      );
    } finally {
      setSetupLoading(false);
    }
  };

  const enableMfa = async () => {
    if (mfaCode.length !== 6) return;
    setSetupLoading(true);
    setError("");
    try {
      await api.post("/auth/mfa/enable", { code: mfaCode });
      setCalendar((current) =>
        current ? { ...current, mfa: { ...current.mfa, enabled: true } } : current,
      );
      setSetupSecret("");
      setSetupUri("");
      onMfaCodeChange("");
    } catch (setupError) {
      const message = axios.isAxiosError(setupError)
        ? setupError.response?.data?.message
        : null;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message ?? "The authenticator code is incorrect or expired.",
      );
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <section className="border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">
            Database report calendar
          </p>
          <h3 className="mt-1 font-semibold">Select reporting year and month</h3>
          <p className="mt-1 text-sm text-white/50">
            Stored audit and evidence-chain reports are correlated to their reporting period.
          </p>
        </div>
        <label className="block min-w-40">
          <span className="mb-1 block text-xs uppercase tracking-wide text-white/40">
            Reporting year
          </span>
          <select
            value={selectedYear}
            onChange={(event) => {
              const nextYear = Number(event.target.value);
              const nextMonths =
                calendar?.years.find((entry) => entry.year === nextYear)?.months ?? [];
              setSelectedYear(nextYear);
              setSelectedMonth(nextMonths[0]?.month ?? 1);
              onMfaCodeChange("");
            }}
            disabled={loading || !calendar}
            className="w-full border border-white/15 bg-[#111214] px-3 py-2 text-sm text-white outline-none focus:border-red-500/60"
          >
            {(calendar?.years ?? []).map((entry) => (
              <option key={entry.year} value={entry.year}>
                {entry.year}{entry.requires_mfa ? " - MFA protected" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mt-3 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className={`mt-4 grid gap-2 ${compact ? "sm:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"}`}>
        {(year?.months ?? []).map((entry) => {
          const selected = entry.month === selectedMonth;
          return (
            <button
              key={entry.month}
              type="button"
              onClick={() => {
                setSelectedMonth(entry.month);
                onMfaCodeChange("");
              }}
              className={`min-h-24 border p-3 text-left transition ${
                selected
                  ? "border-red-500/60 bg-red-500/10"
                  : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]"
              }`}
            >
              <span className="font-semibold">{entry.label}</span>
              <span className="mt-1 block text-[11px] text-white/40">
                {new Date(entry.period_start).toLocaleDateString()} –{" "}
                {new Date(entry.period_end).toLocaleDateString()}
              </span>
              <span className="mt-2 block text-xs text-white/60">
                Audit {entry.audit_reports.length} · Custody{" "}
                {entry.chain_of_custody_reports.length}
              </span>
              {entry.requires_mfa && (
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  MFA protected
                </span>
              )}
            </button>
          );
        })}
      </div>

      {month && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{month.label} {selectedYear}</p>
              <p className="mt-1 text-xs text-white/45">
                {month.audit_reports.length} generated audit report(s) and{" "}
                {month.chain_of_custody_reports.length} generated chain-of-custody report(s).
              </p>
            </div>
            {month.requires_mfa && calendar?.mfa.enabled && (
              <label className="block min-w-64">
                <span className="mb-1 block text-xs uppercase tracking-wide text-amber-300">
                  Your six-digit authenticator code
                </span>
                <input
                  value={mfaCode}
                  onChange={(event) =>
                    onMfaCodeChange(
                      event.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full border border-amber-500/35 bg-black/35 px-3 py-2 text-center font-mono tracking-[0.35em] text-white outline-none focus:border-amber-400"
                />
              </label>
            )}
          </div>

          {month.requires_mfa && !calendar?.mfa.enabled && (
            <div className="mt-3 border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="font-semibold text-amber-100">Authenticator MFA setup required</p>
              <p className="mt-1 text-sm text-white/55">
                Previous-year reports require the MFA authenticator owned by this signed-in user.
              </p>
              {!setupSecret ? (
                <button
                  type="button"
                  onClick={() => void startMfaSetup()}
                  disabled={setupLoading}
                  className="mt-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  {setupLoading ? "Preparing..." : "Set up authenticator MFA"}
                </button>
              ) : (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="border border-white/10 bg-black/25 p-3">
                    <p className="text-xs text-white/50">
                      Add this private secret to Microsoft Authenticator, Google Authenticator, 1Password, or another TOTP app.
                    </p>
                    <p className="mt-2 break-all font-mono text-sm text-white/85">{setupSecret}</p>
                    <details className="mt-2 text-xs text-white/45">
                      <summary className="cursor-pointer">Authenticator URI</summary>
                      <p className="mt-2 break-all font-mono">{setupUri}</p>
                    </details>
                  </div>
                  <div>
                    <input
                      value={mfaCode}
                      onChange={(event) =>
                        onMfaCodeChange(
                          event.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Six-digit code"
                      className="w-full border border-white/15 bg-black/35 px-3 py-3 text-center font-mono tracking-[0.35em] text-white outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => void enableMfa()}
                      disabled={setupLoading || mfaCode.length !== 6}
                      className="mt-2 w-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                    >
                      {setupLoading ? "Verifying..." : "Enable MFA"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(month.audit_reports.length > 0 ||
            month.chain_of_custody_reports.length > 0) && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {month.audit_reports.slice(0, 4).map((report) => (
                <div key={report.report_id} className="border border-white/10 bg-white/[0.025] p-3 text-xs">
                  <p className="font-semibold text-white/75">Audit · {report.entry_count} entries</p>
                  <p className="mt-1 text-white/40">Generated {new Date(report.generated_at).toLocaleString()}</p>
                  <p className="mt-1 truncate font-mono text-white/35">{report.report_id}</p>
                </div>
              ))}
              {month.chain_of_custody_reports.slice(0, 4).map((report) => (
                <div key={report.report_id} className="border border-white/10 bg-white/[0.025] p-3 text-xs">
                  <p className="font-semibold text-white/75">
                    Chain of custody · {report.verification_status}
                  </p>
                  <p className="mt-1 text-white/40">Generated {new Date(report.generated_at).toLocaleString()}</p>
                  <p className="mt-1 truncate font-mono text-white/35">
                    {report.case_reference || report.purpose || report.video_id || report.report_id}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

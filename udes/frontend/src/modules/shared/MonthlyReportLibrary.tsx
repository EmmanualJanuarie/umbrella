import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api } from "../../api/axios";
import { useUser } from "../../context/UserContext";
import { useReportDownload } from "./useReportDownload";

type Artifact = {
  artifact_id: string;
  report_type: "AUDIT_LOG" | "CHAIN_OF_CUSTODY" | "VIDEO_EXPORT";
  scope: "ORG" | "BRANCH";
  scope_id: string;
  organization_id?: string | null;
  branch_id?: string | null;
  organization_name: string;
  branch_name?: string | null;
  period_start: string;
  period_end: string;
  generated_at: string;
  reporting_month: string;
  status: string;
  entry_count: number;
  download_count: number;
  failure_reason?: string | null;
  pdf_available: boolean;
  source_report_id?: string | null;
};

type ScopeData = {
  organizations: Array<{ org_id: string; name: string }>;
  branches: Array<{ branch_id: string; org_id: string; name: string }>;
};

const reportLabels: Record<Artifact["report_type"], string> = {
  AUDIT_LOG: "Audit Log Report",
  CHAIN_OF_CUSTODY: "Chain of Custody Report",
  VIDEO_EXPORT: "Monthly Video Export Report",
};

function reportingMonthParts(artifact: Artifact) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(
    artifact.reporting_month ?? "",
  );
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]) };
  }

  // Compatibility for an older API response. Report periods close in
  // Africa/Johannesburg (UTC+2), so their UTC start is on the prior date.
  const localPeriodStart = new Date(
    new Date(artifact.period_start).getTime() + 120 * 60_000,
  );
  return {
    year: localPeriodStart.getUTCFullYear(),
    month: localPeriodStart.getUTCMonth() + 1,
  };
}

function reportingMonthLabel(artifact: Artifact) {
  const { year, month } = reportingMonthParts(artifact);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function reportingMonthKey(artifact: Artifact) {
  const { year, month } = reportingMonthParts(artifact);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function MonthlyReportLibrary() {
  const { user } = useUser();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [scopes, setScopes] = useState<ScopeData>({
    organizations: [],
    branches: [],
  });
  const [year, setYear] = useState("ALL");
  const [month, setMonth] = useState("ALL");
  const [organizationId, setOrganizationId] = useState("ALL");
  const [branchId, setBranchId] = useState("ALL");
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sensitiveMfaEnabled, setSensitiveMfaEnabled] = useState(false);
  const [sensitiveMfaCode, setSensitiveMfaCode] = useState("");
  const [sensitiveSetupSecret, setSensitiveSetupSecret] = useState("");
  const [sensitiveSetupUri, setSensitiveSetupUri] = useState("");
  const [sensitiveSetupLoading, setSensitiveSetupLoading] = useState(false);
  const { requestDownload, dialogElement } = useReportDownload();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [scopeResponse, archiveResponse, sensitiveMfaResponse] = await Promise.all([
        api.get<ScopeData>("/audit-report/archive/scopes"),
        api.get<Artifact[]>("/audit-report/archive"),
        user?.role === "MAIN_SUPER_ADMIN"
          ? api.get<{ enabled: boolean }>("/audit-report/sensitive-mfa/status")
          : Promise.resolve({ data: { enabled: false } }),
      ]);
      setScopes(scopeResponse.data);
      setArtifacts(Array.isArray(archiveResponse.data) ? archiveResponse.data : []);
      setSensitiveMfaEnabled(Boolean(sensitiveMfaResponse.data.enabled));
    } catch (loadError) {
      const message = axios.isAxiosError(loadError)
        ? loadError.response?.data?.message
        : null;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message ?? "The automatic report archive could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  const years = useMemo(
    () =>
      [...new Set(artifacts.map((item) => reportingMonthParts(item).year))]
        .sort((left, right) => right - left),
    [artifacts],
  );
  const branches = useMemo(
    () =>
      scopes.branches.filter(
        (branch) => organizationId === "ALL" || branch.org_id === organizationId,
      ),
    [organizationId, scopes.branches],
  );
  const filtered = useMemo(
    () =>
      artifacts.filter((item) => {
        const reportingMonth = reportingMonthParts(item);
        return (
          (year === "ALL" || reportingMonth.year === Number(year)) &&
          (month === "ALL" || reportingMonth.month === Number(month)) &&
          (organizationId === "ALL" || item.organization_id === organizationId) &&
          (branchId === "ALL" || item.branch_id === branchId)
        );
      }),
    [artifacts, branchId, month, organizationId, year],
  );
  const previousYearSelected =
    year !== "ALL" && Number(year) < new Date().getUTCFullYear();

  const startDownload = (artifact: Artifact) => {
    const params = new URLSearchParams();
    if (previousYearSelected && mfaCode.length === 6) {
      params.set("mfa_code", mfaCode);
    }
    requestDownload({
      url: `/audit-report/archive/${artifact.artifact_id}/pdf${
        params.size ? `?${params.toString()}` : ""
      }`,
      fileName: `${artifact.report_type.toLowerCase()}-${reportingMonthKey(artifact)}.pdf`,
      title: `Download ${reportLabels[artifact.report_type]}`,
    });
  };

  const startSensitiveMfaSetup = async () => {
    setSensitiveSetupLoading(true);
    setError("");
    try {
      const response = await api.post<{ secret: string; otpauth_uri: string }>(
        "/audit-report/sensitive-mfa/setup",
        {},
      );
      setSensitiveSetupSecret(response.data.secret);
      setSensitiveSetupUri(response.data.otpauth_uri);
      setSensitiveMfaCode("");
      setSensitiveMfaEnabled(false);
    } catch (setupError) {
      const message = axios.isAxiosError(setupError)
        ? setupError.response?.data?.message
        : null;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message ?? "Sensitive-export authenticator setup could not be started.",
      );
    } finally {
      setSensitiveSetupLoading(false);
    }
  };

  const enableSensitiveMfa = async () => {
    if (sensitiveMfaCode.length !== 6) return;
    setSensitiveSetupLoading(true);
    setError("");
    try {
      await api.post("/audit-report/sensitive-mfa/enable", {
        code: sensitiveMfaCode,
      });
      setSensitiveMfaEnabled(true);
      setSensitiveSetupSecret("");
      setSensitiveSetupUri("");
      setSensitiveMfaCode("");
    } catch (setupError) {
      const message = axios.isAxiosError(setupError)
        ? setupError.response?.data?.message
        : null;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message ?? "The sensitive-export authenticator code was rejected.",
      );
    } finally {
      setSensitiveSetupLoading(false);
    }
  };

  const startSensitiveDownload = (artifact: Artifact) => {
    if (!artifact.source_report_id || sensitiveMfaCode.length !== 6) return;
    requestDownload({
      url: `/audit-report/pdf/${artifact.source_report_id}/sensitive`,
      method: "POST",
      body: { code: sensitiveMfaCode },
      fileName: `sensitive-audit-report-${reportingMonthKey(artifact)}.pdf`,
      title: "Download Sensitive Audit Report",
    });
  };

  return (
    <section className="flex min-h-0 flex-col overflow-hidden border border-white/10 bg-black/25">
      <header className="border-b border-white/10 bg-gradient-to-r from-red-950/35 via-black/30 to-black/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              Automatic monthly archive
            </p>
            <h2 className="mt-1 text-xl font-semibold">Generated Reports</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
              Each month is closed by the backend at 23:59:59.999. Reports are
              generated once, stored against the database reporting calendar,
              and protected by role and tenant scope.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh archive"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs uppercase tracking-wide text-white/40">
              Year
            </span>
            <select
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                setMfaCode("");
              }}
              className="w-full border border-white/15 bg-[#111214] px-3 py-2 text-sm"
            >
              <option value="ALL">All years</option>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs uppercase tracking-wide text-white/40">
              Month
            </span>
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-full border border-white/15 bg-[#111214] px-3 py-2 text-sm"
            >
              <option value="ALL">All months</option>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {new Date(Date.UTC(2026, index, 1)).toLocaleString(undefined, {
                    month: "long",
                    timeZone: "UTC",
                  })}
                </option>
              ))}
            </select>
          </label>
          {(user?.role === "MAIN_SUPER_ADMIN" ||
            user?.role === "SUPER_ADMIN") && (
            <label>
              <span className="mb-1 block text-xs uppercase tracking-wide text-white/40">
                Organization
              </span>
              <select
                value={organizationId}
                onChange={(event) => {
                  setOrganizationId(event.target.value);
                  setBranchId("ALL");
                }}
                className="w-full border border-white/15 bg-[#111214] px-3 py-2 text-sm"
              >
                <option value="ALL">All authorized organizations</option>
                {scopes.organizations.map((organization) => (
                  <option key={organization.org_id} value={organization.org_id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(user?.role === "MAIN_SUPER_ADMIN" ||
            user?.role === "ORG_OWNER") && (
            <label>
              <span className="mb-1 block text-xs uppercase tracking-wide text-white/40">
                Branch
              </span>
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="w-full border border-white/15 bg-[#111214] px-3 py-2 text-sm"
              >
                <option value="ALL">All authorized branches</option>
                {branches.map((branch) => (
                  <option key={branch.branch_id} value={branch.branch_id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {user?.role === "SUPER_ADMIN" && (
          <p className="mt-3 border-l-2 border-red-500/60 pl-3 text-xs leading-5 text-white/45">
            Select an organization before downloading its chain-of-custody
            report. The Super Admin version contains only Umbrella Systems
            administrative involvement with that organization&apos;s videos.
          </p>
        )}
        {previousYearSelected && (
          <label className="mt-4 block max-w-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-300">
              Previous-year MFA access code
            </span>
            <input
              value={mfaCode}
              onChange={(event) =>
                setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Six-digit code"
              className="w-full border border-amber-500/35 bg-black/35 px-3 py-2 text-center font-mono tracking-[0.35em]"
            />
          </label>
        )}
        {user?.role === "MAIN_SUPER_ADMIN" && (
          <details className="mt-4 border border-amber-500/25 bg-amber-500/[0.06] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-amber-100">
              Sensitive audit export controls
            </summary>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-white/50">
              Sensitive audit PDFs use the dedicated sensitive-export
              authenticator. The MFA result and download event are recorded
              separately from standard archive downloads.
            </p>
            {!sensitiveMfaEnabled && !sensitiveSetupSecret && (
              <button
                type="button"
                onClick={() => void startSensitiveMfaSetup()}
                disabled={sensitiveSetupLoading}
                className="mt-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {sensitiveSetupLoading
                  ? "Preparing authenticator..."
                  : "Set up sensitive-export authenticator"}
              </button>
            )}
            {sensitiveSetupSecret && (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="border border-white/10 bg-black/25 p-3">
                  <p className="text-xs text-white/45">
                    Add this private secret to your authenticator application.
                  </p>
                  <p className="mt-2 break-all font-mono text-sm">
                    {sensitiveSetupSecret}
                  </p>
                  <details className="mt-2 text-xs text-white/40">
                    <summary className="cursor-pointer">Authenticator URI</summary>
                    <p className="mt-2 break-all font-mono">{sensitiveSetupUri}</p>
                  </details>
                </div>
                <div>
                  <input
                    value={sensitiveMfaCode}
                    onChange={(event) =>
                      setSensitiveMfaCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Six-digit setup code"
                    className="w-full border border-amber-500/35 bg-black/35 px-3 py-3 text-center font-mono tracking-[0.35em]"
                  />
                  <button
                    type="button"
                    onClick={() => void enableSensitiveMfa()}
                    disabled={
                      sensitiveSetupLoading || sensitiveMfaCode.length !== 6
                    }
                    className="mt-2 w-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                  >
                    Enable authenticator
                  </button>
                </div>
              </div>
            )}
            {sensitiveMfaEnabled && (
              <label className="mt-3 block max-w-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-amber-200">
                  Sensitive-export MFA code
                </span>
                <input
                  value={sensitiveMfaCode}
                  onChange={(event) =>
                    setSensitiveMfaCode(
                      event.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Required for sensitive PDF"
                  className="w-full border border-amber-500/35 bg-black/35 px-3 py-2 text-center font-mono tracking-[0.35em]"
                />
              </label>
            )}
          </details>
        )}
      </header>

      {error && (
        <div className="m-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="autohide-scrollbar min-h-[18rem] max-h-[calc(100vh-22rem)] overflow-x-auto overflow-y-scroll overscroll-contain [scrollbar-gutter:stable]">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 bg-gray-950 text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="p-3">Report</th>
              <th className="p-3">Reporting month</th>
              <th className="p-3">Organization</th>
              <th className="p-3">Branch</th>
              <th className="p-3">Generated</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Download</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((artifact) => (
              <tr key={artifact.artifact_id} className="border-t border-white/10">
                <td className="p-3">
                  <p className="font-semibold">{reportLabels[artifact.report_type]}</p>
                  <p className="mt-1 font-mono text-[11px] text-white/35">
                    {artifact.artifact_id}
                  </p>
                </td>
                <td className="p-3">
                  {reportingMonthLabel(artifact)}
                </td>
                <td className="p-3">{artifact.organization_name}</td>
                <td className="p-3">{artifact.branch_name ?? "All branches"}</td>
                <td className="p-3 text-white/60">
                  {new Date(artifact.generated_at).toLocaleString()}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 text-xs font-semibold ${
                      artifact.status === "READY"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : artifact.status === "FAILED"
                          ? "bg-red-500/15 text-red-200"
                          : "bg-amber-500/15 text-amber-200"
                    }`}
                  >
                    {artifact.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => startDownload(artifact)}
                    disabled={
                      artifact.status !== "READY" ||
                      (previousYearSelected && mfaCode.length !== 6) ||
                      (user?.role === "SUPER_ADMIN" &&
                        artifact.report_type === "CHAIN_OF_CUSTODY" &&
                        organizationId === "ALL")
                    }
                    className="border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-40"
                  >
                    Download PDF
                  </button>
                  {user?.role === "MAIN_SUPER_ADMIN" &&
                    artifact.report_type === "AUDIT_LOG" && (
                      <button
                        type="button"
                        onClick={() => startSensitiveDownload(artifact)}
                        disabled={
                          !sensitiveMfaEnabled ||
                          sensitiveMfaCode.length !== 6 ||
                          !artifact.source_report_id
                        }
                        className="ml-2 border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
                      >
                        Sensitive PDF
                      </button>
                    )}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-white/40">
                  No automatically generated reports match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {dialogElement}
    </section>
  );
}

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useBackgroundRefresh } from "../../hooks/useBackgroundRefresh";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

type UploadActivityRow = {
  upload_id: string;
  video_id: string | null;
  file_name: string;
  status: string;
  processed: boolean;
  uploaded_at: string;
  size_bytes: number;
  mime_type: string;
  hash_reference: string;
  file_hash?: string;
  organization_name: string;
  branch_name: string;
  officer_name: string;
  officer_email: string | null;
  uploader_name: string;
  uploader_email: string | null;
  uploader_role: string | null;
  camera_serial_number: string;
  camera_model: string | null;
  camera_manufacturer: string | null;
  duration: number | null;
  resolution: string | null;
  verification_status:
    | "PENDING"
    | "AWAITING_ACKNOWLEDGEMENT"
    | "VERIFIED"
    | "ACKNOWLEDGED"
    | "FAILED";
  verification_checked_at: string | null;
  verification_checked_by: string | null;
  verification_acknowledged_at: string | null;
  verification_acknowledged_by: string | null;
  verification_failure_reason: string | null;
  verification_cloud_metadata_hash: string | null;
  verification_calculated_cloud_hash: string | null;
  finalization_status: string | null;
};

type Props = {
  scopeLabel: string;
  showCompletedTab?: boolean;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "Unavailable";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export default function VideoUploadActivity({
  scopeLabel,
  showCompletedTab = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "received" | "completed" | "failed"
  >("received");
  const [rows, setRows] = useState<UploadActivityRow[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchUploads = useCallback(async () => {
    try {
      setError("");
      const response = await axios.get<UploadActivityRow[]>(`${API_URL}/sync/upload/activity`, {
        withCredentials: true,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      console.error("Failed to load upload activity:", err);
      setError("Video upload activity could not be loaded.");
      throw err;
    }
  }, []);

  const {
    data,
    loading,
    refreshing,
    refresh: loadUploads,
  } = useBackgroundRefresh({
    fetcher: fetchUploads,
  });

  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [
        row.organization_name,
        row.branch_name,
        row.officer_name,
        row.file_name,
        row.camera_serial_number,
        row.uploader_name,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [rows, search]);

  const failedRows = useMemo(
    () =>
      filteredRows.filter(
        (row) =>
          row.verification_status === "FAILED" ||
          row.status === "FAILED" ||
          row.finalization_status === "FAILED"
      ),
    [filteredRows]
  );

  const failedRowsGrouped = useMemo(() => {
    const orgMap = new Map<string, Map<string, UploadActivityRow[]>>();

    for (const row of failedRows) {
      if (!orgMap.has(row.organization_name)) {
        orgMap.set(row.organization_name, new Map());
      }

      const branchMap = orgMap.get(row.organization_name)!;
      if (!branchMap.has(row.branch_name)) {
        branchMap.set(row.branch_name, []);
      }

      branchMap.get(row.branch_name)!.push(row);
    }

    return Array.from(orgMap.entries());
  }, [failedRows]);

  const failedRowsOrdered = useMemo(
    () =>
      failedRowsGrouped.flatMap(([organizationName, branches]) =>
        Array.from(branches.entries()).flatMap(([branchName, uploads]) =>
          uploads.map((upload) => ({
            organizationName,
            branchName,
            upload,
          }))
        )
      ),
    [failedRowsGrouped]
  );

  const nonFailedRows = useMemo(
    () => filteredRows.filter((row) => !failedRows.includes(row)),
    [failedRows, filteredRows]
  );

  const completedRows = useMemo(
    () =>
      nonFailedRows.filter(
        (row) =>
          ["VERIFIED", "ACKNOWLEDGED"].includes(row.verification_status) &&
          row.status === "COMPLETED" &&
          row.processed
      ),
    [nonFailedRows]
  );

  const receivedRows = useMemo(
    () =>
      showCompletedTab
        ? nonFailedRows.filter((row) => !completedRows.includes(row))
        : nonFailedRows,
    [completedRows, nonFailedRows, showCompletedTab]
  );

  const visibleRows =
    activeTab === "completed" ? completedRows : receivedRows;

  const grouped = useMemo(() => {
    const orgMap = new Map<string, Map<string, Map<string, UploadActivityRow[]>>>();

    for (const row of visibleRows) {
      if (!orgMap.has(row.organization_name)) {
        orgMap.set(row.organization_name, new Map());
      }

      const branchMap = orgMap.get(row.organization_name)!;
      if (!branchMap.has(row.branch_name)) {
        branchMap.set(row.branch_name, new Map());
      }

      const officerMap = branchMap.get(row.branch_name)!;
      if (!officerMap.has(row.officer_name)) {
        officerMap.set(row.officer_name, []);
      }

      officerMap.get(row.officer_name)!.push(row);
    }

    return Array.from(orgMap.entries());
  }, [visibleRows]);

  const totalBytes = filteredRows.reduce((sum, row) => sum + row.size_bytes, 0);
  const completed = completedRows.length;
  const waitingForVerification = filteredRows.filter(
    (row) =>
      row.verification_status === "PENDING" ||
      row.verification_status === "AWAITING_ACKNOWLEDGEMENT" ||
      (["VERIFIED", "ACKNOWLEDGED"].includes(row.verification_status) &&
        (row.status !== "COMPLETED" || !row.processed)),
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-body-black p-4 text-white">
      <div className="border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              Cloud uploads
            </p>
            <h2 className="mt-1 text-xl font-bold">{scopeLabel} video upload activity</h2>
            <p className="mt-1 text-sm text-white/55">
              Uploaded evidence grouped by organization, branch, and officer.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadUploads(true)}
            disabled={refreshing}
            className="border border-red-500/50 bg-red-600/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Waiting for verification</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{waitingForVerification}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Videos</p>
            <p className="mt-1 text-2xl font-bold">{filteredRows.length}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Completed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{completed}</p>
          </div>
          <div className="border border-red-500/20 bg-red-500/[0.04] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Failed logs</p>
            <p className="mt-1 text-2xl font-bold text-red-300">{failedRows.length}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Storage</p>
            <p className="mt-1 text-2xl font-bold">{formatBytes(totalBytes)}</p>
          </div>
        </div>
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search organization, branch, officer, camera, or file..."
        className="w-full border border-white/10 bg-gray-950 p-3 text-sm text-white outline-none focus:ring-2 focus:ring-red-600"
      />

      <div className="flex border-b border-white/10 bg-black/20 px-2 pt-2">
        <button
          type="button"
          onClick={() => setActiveTab("received")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "received"
              ? "border-red-500 bg-red-500/[0.08] text-white"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          Received uploads
          <span className="ml-2 bg-white/10 px-2 py-0.5 text-xs">
            {receivedRows.length}
          </span>
        </button>
        {showCompletedTab && (
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "completed"
                ? "border-emerald-500 bg-emerald-500/[0.08] text-emerald-100"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            Completed / verified
            <span className="ml-2 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">
              {completedRows.length}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("failed")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "failed"
              ? "border-red-500 bg-red-500/[0.08] text-red-100"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          Failed logs
          <span className="ml-2 bg-red-500/15 px-2 py-0.5 text-xs text-red-200">
            {failedRows.length}
          </span>
        </button>
      </div>

      {error && (
        <div className="border border-red-700 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {activeTab === "failed" && (
        <section className="border border-red-500/30 bg-red-950/15">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-red-500/20 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
                Failed logs
              </p>
              <h3 className="mt-1 text-lg font-semibold">Verification exceptions</h3>
              <p className="mt-1 text-sm text-white/50">
                Integrity mismatches and processing failures requiring administrator review.
              </p>
            </div>
            <span className="border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
              {failedRows.length} failed
            </span>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="sticky top-0 bg-gray-950 text-xs uppercase text-white/45">
                <tr>
                  <th className="p-3">Evidence</th>
                  <th className="p-3">Client context</th>
                  <th className="p-3">Checked</th>
                  <th className="p-3">Failure reason</th>
                  <th className="p-3">Hash comparison</th>
                  <th className="p-3">Disposition</th>
                </tr>
              </thead>
              <tbody>
                {failedRowsOrdered.map(
                  ({ organizationName, branchName, upload }, index) => (
                  <Fragment key={`failed-grouped-${upload.upload_id}`}>
                    {(index === 0 ||
                      failedRowsOrdered[index - 1].organizationName !==
                        organizationName) && (
                      <tr className="border-t border-red-500/25 bg-red-500/[0.08]">
                        <td colSpan={6} className="px-3 py-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                            Organization
                          </span>
                          <span className="ml-3 font-semibold text-white">
                            {organizationName}
                          </span>
                        </td>
                      </tr>
                    )}
                    {(index === 0 ||
                      failedRowsOrdered[index - 1].organizationName !==
                        organizationName ||
                      failedRowsOrdered[index - 1].branchName !== branchName) && (
                      <tr className="border-t border-red-500/15 bg-black/35">
                        <td colSpan={6} className="px-3 py-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
                            Branch
                          </span>
                          <span className="ml-3 text-sm font-semibold text-red-200">
                            {branchName}
                          </span>
                        </td>
                      </tr>
                    )}
                  <tr key={`failed-${upload.upload_id}`} className="border-t border-red-500/15">
                    <td className="p-3">
                      <p className="max-w-[220px] truncate font-medium">{upload.file_name}</p>
                      <p className="mt-1 font-mono text-xs text-white/40">{upload.upload_id}</p>
                    </td>
                    <td className="p-3">
                      <p>{upload.organization_name}</p>
                      <p className="text-xs text-white/45">
                        {upload.branch_name} · {upload.officer_name}
                      </p>
                    </td>
                    <td className="p-3">
                      {upload.verification_checked_at
                        ? new Date(upload.verification_checked_at).toLocaleString()
                        : "Processing failure"}
                    </td>
                    <td className="max-w-[300px] p-3 text-red-100">
                      {upload.verification_failure_reason ??
                        "Evidence finalization failed. Review the backend worker log."}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      <p>DB: {upload.hash_reference}</p>
                      <p className="mt-1 text-white/45">
                        Cloud:{" "}
                        {upload.verification_calculated_cloud_hash?.slice(0, 12) ??
                          "Unavailable"}
                      </p>
                    </td>
                    <td className="p-3">
                      <span className="inline-block border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
                        Retry disabled
                      </span>
                      <p className="mt-2 max-w-[180px] text-xs leading-5 text-white/40">
                        Failed evidence cannot be re-run or re-verified.
                      </p>
                    </td>
                  </tr>
                  </Fragment>
                ))}
                {failedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-white/40">
                      No failed upload or verification records were found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(activeTab === "received" || activeTab === "completed") && (
      <div className="min-h-0 flex-1 overflow-y-auto pr-2">
        {loading ? (
          <div className="border border-white/10 bg-black/30 p-6 text-center text-white/55">
            Loading upload activity...
          </div>
        ) : grouped.length === 0 ? (
          <div className="border border-white/10 bg-black/30 p-6 text-center text-white/55">
            {activeTab === "completed"
              ? "No completed and verified video uploads found."
              : "No received video uploads are awaiting completion."}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([organizationName, branches]) => (
              <section key={organizationName} className="border border-white/10 bg-black/30">
                <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                    Organization
                  </p>
                  <h3 className="mt-1 font-semibold">{organizationName}</h3>
                </div>

                {Array.from(branches.entries()).map(([branchName, officers]) => (
                  <div key={`${organizationName}-${branchName}`} className="border-b border-white/10 p-4 last:border-b-0">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                      Branch
                    </p>
                    <p className="mt-1 text-sm font-semibold text-red-200">{branchName}</p>

                    <div className="mt-3 space-y-3">
                      {Array.from(officers.entries()).map(([officerName, uploads]) => (
                        <div key={`${branchName}-${officerName}`} className="border border-white/10 bg-body-black/70">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                            <div>
                              <p className="font-semibold">{officerName}</p>
                              <p className="text-xs text-white/45">
                                {uploads.length} video(s) | {formatBytes(uploads.reduce((sum, item) => sum + item.size_bytes, 0))}
                              </p>
                            </div>
                            <span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                              Cloud stored
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[920px] text-left text-sm">
                              <thead className="bg-gray-950 text-xs uppercase text-white/45">
                                <tr>
                                  <th className="p-2">Video</th>
                                  <th className="p-2">Uploaded</th>
                                  <th className="p-2">Uploaded by</th>
                                  <th className="p-2">Camera</th>
                                  <th className="p-2">Size</th>
                                  <th className="p-2">Duration</th>
                                  <th className="p-2">Integrity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {uploads.map((upload) => (
                                  <tr key={upload.upload_id} className="border-t border-white/10 hover:bg-white/[0.04]">
                                    <td className="p-2">
                                      <p className="max-w-[240px] truncate font-medium">{upload.file_name}</p>
                                      <p className="text-xs text-white/40">{upload.resolution ?? "Unknown resolution"}</p>
                                    </td>
                                    <td className="p-2">{new Date(upload.uploaded_at).toLocaleString()}</td>
                                    <td className="p-2">
                                      <p className="font-medium">{upload.uploader_name}</p>
                                      <p className="text-xs text-white/40">
                                        {upload.uploader_role === "BRANCH_ADMIN" ? "Branch administrator" : upload.uploader_email ?? "Upload source"}
                                      </p>
                                    </td>
                                    <td className="p-2">
                                      <p>{upload.camera_serial_number}</p>
                                      <p className="text-xs text-white/40">
                                        {[upload.camera_manufacturer, upload.camera_model].filter(Boolean).join(" ") || "Unknown camera"}
                                      </p>
                                    </td>
                                    <td className="p-2">{formatBytes(upload.size_bytes)}</td>
                                    <td className="p-2">{formatDuration(upload.duration)}</td>
                                    <td className="p-2">
                                      <div className="flex flex-col gap-2">
                                        <span className={`w-fit border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${["VERIFIED", "ACKNOWLEDGED"].includes(upload.verification_status) && upload.status === "COMPLETED" && upload.processed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : upload.verification_status === "AWAITING_ACKNOWLEDGEMENT" ? "border-sky-500/30 bg-sky-500/10 text-sky-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                                          {["VERIFIED", "ACKNOWLEDGED"].includes(upload.verification_status) && upload.status === "COMPLETED" && upload.processed
                                            ? upload.verification_status === "VERIFIED" ? "System verified" : "Verified"
                                            : upload.verification_status === "AWAITING_ACKNOWLEDGEMENT"
                                              ? "Awaiting acknowledgement"
                                              : upload.verification_status === "ACKNOWLEDGED"
                                                ? "Finalizing"
                                                : "Waiting for verification"}
                                        </span>
                                        <span className="font-mono text-xs text-white/65">
                                          {upload.hash_reference}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

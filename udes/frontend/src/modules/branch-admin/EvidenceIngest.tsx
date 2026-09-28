import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { api } from "../../api/axios";
import { hashFileSha256 } from "../../utils/sha256";

type Camera = {
  camera_id: string;
  serial_number: string;
  manufacturer?: string | null;
  model: string;
  assigned_to?: string | null;
  officer?: { user?: { first_name?: string; last_name?: string } } | null;
};

type FileSystemFileHandleLike = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

type FileSystemDirectoryHandleLike = {
  kind: "directory";
  name: string;
  values: () => AsyncIterableIterator<FileSystemFileHandleLike | FileSystemDirectoryHandleLike>;
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandleLike>;
};

type IngestState = "READY" | "HASHING" | "CHECKING_DUPLICATE" | "UPLOADING" | "WAITING_FOR_VERIFICATION" | "VERIFIED" | "DUPLICATE" | "SOURCE_DELETED" | "FAILED";

type EvidenceFile = {
  id: string;
  path: string;
  file: File;
  parentDirectory: FileSystemDirectoryHandleLike;
  entryName: string;
  selected: boolean;
  state: IngestState;
  progress: number;
  processedBytes?: number;
  processingBytesPerSecond?: number;
  processingEtaSeconds?: number;
  uploadedBytes?: number;
  uploadBytesPerSecond?: number;
  etaSeconds?: number;
  uploadRetries?: number;
  hash?: string;
  uploadId?: string;
  cameraId?: string;
  deletionRequested?: boolean;
  sourceDeletionReason?: SourceDeletionReason;
  verificationDetail?: string;
  error?: string;
};

type SourceDeletionReason = "DUPLICATE_CONFIRMED" | "VERIFIED_UPLOAD";
type SourceDeletionPrompt = {
  requestId: string;
  itemId: string;
  fileName: string;
  fileHash: string;
  reason: SourceDeletionReason;
  uploadId?: string;
  parentDirectory: FileSystemDirectoryHandleLike;
  entryName: string;
};

type UploadPart = { part_number: number; url: string };
type InitResponse = {
  upload_id: string;
  key: string;
  part_size: number;
  parts: UploadPart[];
  sync_session_id: string;
  video_id: string;
  upload_token: string;
};

const SUPPORTED_EXTENSION = /\.mp4$/i;
const MAX_FILES = 500;
// VideoUpload.size_bytes is currently a PostgreSQL 32-bit integer.
const MAX_FILE_SIZE = 2_000_000_000;
// A single active reader avoids competing reads on slower removable dashcam media.
const MULTIPART_CONCURRENCY = 1;
const UPLOAD_PART_TIMEOUT_MS = 15 * 60 * 1000;
const UPLOAD_PART_STALL_MS = 45_000;
const UPLOAD_PART_MAX_ATTEMPTS = 3;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "Calculating...";
  const rounded = Math.max(0, Math.ceil(seconds));
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function extractS3Error(responseText: string) {
  return responseText.match(/<Message>([^<]+)<\/Message>/)?.[1];
}

function readVideoMetadata(file: File) {
  return new Promise<{ duration: number; resolution: string }>((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const finish = (metadata: { duration: number; resolution: string }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(metadata);
    };
    const timeout = window.setTimeout(
      () => finish({ duration: 0, resolution: "UNKNOWN" }),
      10_000,
    );
    video.preload = "metadata";
    video.onloadedmetadata = () => finish({
      duration: Number.isFinite(video.duration) ? Math.round(video.duration) : 0,
      resolution:
        video.videoWidth > 0 && video.videoHeight > 0
          ? `${video.videoWidth}x${video.videoHeight}`
          : "UNKNOWN",
    });
    video.onerror = () => finish({ duration: 0, resolution: "UNKNOWN" });
    video.src = objectUrl;
  });
}

function uploadPart(
  url: string,
  body: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;
    let stalled = false;
    let stallTimer: number | undefined;

    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      if (stallTimer !== undefined) window.clearTimeout(stallTimer);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => request.abort();
    const armStallTimer = () => {
      if (stallTimer !== undefined) window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(() => {
        stalled = true;
        request.abort();
      }, UPLOAD_PART_STALL_MS);
    };

    request.open("PUT", url);
    request.timeout = UPLOAD_PART_TIMEOUT_MS;
    request.upload.onprogress = (event) => {
      armStallTimer();
      onProgress(event.loaded);
    };
    request.onload = () => finish(() => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(extractS3Error(request.responseText) ?? `Cloud upload failed (${request.status})`));
        return;
      }
      const etag = request.getResponseHeader("etag");
      if (!etag) {
        reject(new Error("Cloudflare R2 did not expose the ETag header. Add ETag to the bucket CORS ExposeHeaders setting."));
        return;
      }
      resolve(etag);
    });
    request.onerror = () => finish(() => reject(new Error("The cloud upload connection failed")));
    request.ontimeout = () =>
      finish(() => reject(new Error("The cloud upload part stalled and timed out")));
    request.onabort = () =>
      finish(() =>
        reject(
          stalled
            ? new Error("The cloud upload part stopped making progress")
            : new DOMException("Upload cancelled", "AbortError"),
        ),
      );
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    armStallTimer();
    request.send(body);
  });
}

async function uploadPartWithRetry(
  url: string,
  body: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
  onRetry: () => void,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= UPLOAD_PART_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await uploadPart(
        url,
        body,
        signal,
        onProgress,
      );
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        throw error;
      }
      lastError = error;
      if (attempt === UPLOAD_PART_MAX_ATTEMPTS) break;
      onProgress(0);
      onRetry();
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, attempt * 1500),
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The cloud upload part failed after retrying");
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return data?.message ?? data?.error?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Evidence ingestion failed";
}

function isDuplicateUploadError(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const data = error.response?.data as
    | { code?: string; message?: string; error?: { code?: string; message?: string } }
    | undefined;
  const message = data?.message ?? data?.error?.message ?? "";
  return (
    data?.code === "UPLOAD_DUPLICATE_VIDEO" ||
    data?.error?.code === "UPLOAD_DUPLICATE_VIDEO" ||
    (error.response?.status === 409 &&
      /already (been )?uploaded|duplicate/i.test(message))
  );
}

async function collectVideoFiles(
  directory: FileSystemDirectoryHandleLike,
  prefix = "",
  results: Array<{
    path: string;
    file: File;
    parentDirectory: FileSystemDirectoryHandleLike;
    entryName: string;
  }> = [],
) {
  for await (const handle of directory.values()) {
    if (results.length >= MAX_FILES) break;
    const path = prefix ? `${prefix}/${handle.name}` : handle.name;
    if (handle.kind === "directory") {
      await collectVideoFiles(handle, path, results);
    } else if (SUPPORTED_EXTENSION.test(handle.name)) {
      const file = await handle.getFile();
      if (file.size > 0 && file.size <= MAX_FILE_SIZE) {
        results.push({
          path,
          file,
          parentDirectory: directory,
          entryName: handle.name,
        });
      }
    }
  }
  return results;
}

function updateRow(
  rows: EvidenceFile[],
  id: string,
  patch: Partial<EvidenceFile>,
) {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

function evidenceFileId(path: string, file: File) {
  return `${path}:${file.size}:${file.lastModified}`;
}

function processingRecord(item: EvidenceFile) {
  const cloudUploaded = [
    "WAITING_FOR_VERIFICATION",
    "VERIFIED",
    "SOURCE_DELETED",
  ].includes(item.state);
  const serverVerified =
    item.state === "VERIFIED" ||
    (item.state === "SOURCE_DELETED" &&
      item.sourceDeletionReason === "VERIFIED_UPLOAD");
  return [
    { label: "Discovered on camera", done: true },
    { label: "SHA-256 calculated", done: Boolean(item.hash) },
    {
      label: item.state === "CHECKING_DUPLICATE"
        ? "Checking the evidence database for a matching SHA-256"
        : "Duplicate database check",
      done: Boolean(item.hash) && !["HASHING", "CHECKING_DUPLICATE"].includes(item.state),
      active: item.state === "CHECKING_DUPLICATE",
    },
    {
      label:
        item.state === "DUPLICATE" ||
        item.sourceDeletionReason === "DUPLICATE_CONFIRMED"
          ? "Cloud upload skipped - duplicate"
          : "Uploaded to protected cloud storage",
      done:
        item.state === "DUPLICATE" ||
        item.sourceDeletionReason === "DUPLICATE_CONFIRMED" ||
        cloudUploaded,
    },
    {
      label:
        item.state === "DUPLICATE" ||
        item.sourceDeletionReason === "DUPLICATE_CONFIRMED"
          ? "Existing cloud evidence verified"
          : "Independent server verification",
      done:
        serverVerified ||
        item.state === "DUPLICATE" ||
        item.sourceDeletionReason === "DUPLICATE_CONFIRMED",
    },
  ];
}

export default function EvidenceIngest() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [loadingCameras, setLoadingCameras] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [refreshingStatuses, setRefreshingStatuses] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [deletionPrompts, setDeletionPrompts] = useState<SourceDeletionPrompt[]>([]);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandleLike | null>(null);
  const verificationControllersRef = useRef(
    new Map<string, AbortController>(),
  );

  const pickerSupported = typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
  const selectedFiles = useMemo(
    () =>
      files.filter(
        (item) =>
          item.selected &&
          item.state !== "FAILED" &&
          item.state !== "DUPLICATE" &&
          item.state !== "VERIFIED" &&
          item.state !== "SOURCE_DELETED",
      ),
    [files],
  );
  const totalSelectedBytes = useMemo(
    () => selectedFiles.reduce((total, item) => total + item.file.size, 0),
    [selectedFiles],
  );

  useEffect(() => {
    let mounted = true;
    const verificationControllers = verificationControllersRef.current;
    api.get<Camera[]>("/camera", { params: { type: "ASSIGNED" } })
      .then((response) => {
        if (!mounted) return;
        const assigned = response.data.filter((camera) => camera.assigned_to);
        setCameras(assigned);
        if (assigned.length === 1) setCameraId(assigned[0]?.camera_id ?? "");
      })
      .catch((error) => {
        if (mounted) setNotice(errorMessage(error));
      })
      .finally(() => {
        if (mounted) setLoadingCameras(false);
      });
    return () => {
      mounted = false;
      abortRef.current?.abort();
      for (const controller of verificationControllers.values()) {
        controller.abort();
      }
      verificationControllers.clear();
    };
  }, []);

  const chooseCameraStorage = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      setNotice("Camera storage selection requires the current desktop version of Microsoft Edge or Google Chrome over HTTPS.");
      return;
    }

    setScanning(true);
    setNotice(null);
    try {
      const directory = await picker({ mode: "readwrite" });
      const discovered = await collectVideoFiles(directory);
      directoryHandleRef.current = directory;
      setSourceName(directory.name);
      setDeletionPrompts([]);
      setFiles(discovered.map(({ path, file, parentDirectory, entryName }) => ({
        id: evidenceFileId(path, file),
        path,
        file,
        parentDirectory,
        entryName,
        selected: true,
        state: "READY",
        progress: 0,
      })));
      if (discovered.length === 0) {
        setNotice("No supported MP4 recordings were found in the selected camera storage folder.");
      } else if (discovered.length === MAX_FILES) {
        setNotice(`The scan was limited to the first ${MAX_FILES} MP4 recordings. Choose a more specific recording folder if necessary.`);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setNotice(errorMessage(error));
      }
    } finally {
      setScanning(false);
      setConsentOpen(false);
    }
  };

  const rescanEvidenceTable = async () => {
    const directory = directoryHandleRef.current;
    if (!directory || running || scanning) return;

    setScanning(true);
    try {
      const discovered = await collectVideoFiles(directory);
      setFiles((currentRows) => {
        const existingById = new Map(
          currentRows.map((row) => [row.id, row]),
        );
        return discovered.map(({ path, file, parentDirectory, entryName }) => {
          const id = evidenceFileId(path, file);
          const existing = existingById.get(id);
          return existing
            ? { ...existing, path, file, parentDirectory, entryName }
            : {
                id,
                path,
                file,
                parentDirectory,
                entryName,
                selected: true,
                state: "READY" as const,
                progress: 0,
              };
        });
      });
      if (discovered.length === 0) {
        setNotice(
          "No supported MP4 recordings were found in the selected camera storage folder.",
        );
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setScanning(false);
    }
  };

  const pollVerification = async (
    uploadId: string,
    itemId: string,
    signal: AbortSignal,
  ) => {
    let attempt = 0;
    while (!signal.aborted) {
      if (signal.aborted) throw new DOMException("Upload cancelled", "AbortError");
      let response;
      try {
        response = await api.get(`/sync/upload/browser/status/${uploadId}`);
      } catch {
        if (signal.aborted) {
          throw new DOMException("Upload cancelled", "AbortError");
        }
        const delayMs = Math.min(10000 + attempt * 2000, 30000);
        attempt += 1;
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, delayMs),
        );
        continue;
      }
      const status = response.data?.integrity?.status as string | undefined;
      if (status === "VERIFIED") return;
      if (status === "AWAITING_ACKNOWLEDGEMENT") {
        setFiles((rows) =>
          updateRow(rows, itemId, {
            verificationDetail:
              "Integrity check passed · Awaiting Super Admin acknowledgement.",
          }),
        );
      } else if (status === "FINALIZING") {
        setFiles((rows) =>
          updateRow(rows, itemId, {
            verificationDetail:
              "Verification acknowledged · Secure evidence finalization is running.",
          }),
        );
      }
      if (status === "MISMATCH" || response.data?.upload?.status === "FAILED") {
        throw new Error(response.data?.finalization?.last_error ?? "Server integrity verification failed");
      }
      const delayMs = Math.min(10000 + attempt * 2000, 30000);
      attempt += 1;
      await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
    }
    throw new DOMException("Upload cancelled", "AbortError");
  };

  useEffect(() => {
    if (running) return;

    for (const item of files) {
      if (
        item.state !== "WAITING_FOR_VERIFICATION" ||
        !item.uploadId ||
        verificationControllersRef.current.has(item.uploadId)
      ) {
        continue;
      }

      const verificationController = new AbortController();
      verificationControllersRef.current.set(
        item.uploadId,
        verificationController,
      );

      void pollVerification(
        item.uploadId,
        item.id,
        verificationController.signal,
      )
        .then(() =>
          setFiles((rows) =>
            updateRow(rows, item.id, {
              state: "VERIFIED",
              progress: 1,
              verificationDetail:
                "Independently verified by the secure server · Evidence processing completed.",
              error: undefined,
            }),
          ),
        )
        .catch((verificationError) => {
          if (
            verificationError instanceof DOMException &&
            verificationError.name === "AbortError"
          ) {
            return;
          }
          setFiles((rows) =>
            updateRow(rows, item.id, {
              state: "WAITING_FOR_VERIFICATION",
              error: errorMessage(verificationError),
            }),
          );
        })
        .finally(() => {
          verificationControllersRef.current.delete(item.uploadId!);
        });
    }
  }, [files, running]);

  useEffect(() => {
    if (running) return;

    for (const item of files) {
      const reason: SourceDeletionReason | null =
        item.state === "DUPLICATE"
          ? "DUPLICATE_CONFIRMED"
          : item.state === "VERIFIED"
            ? "VERIFIED_UPLOAD"
            : null;
      if (
        !reason ||
        !item.hash ||
        !item.cameraId ||
        item.deletionRequested
      ) {
        continue;
      }

      setFiles((rows) =>
        updateRow(rows, item.id, { deletionRequested: true }),
      );
      void api
        .post<{ request_id: string }>(
          "/sync/upload/browser/source-deletion/request",
          {
            camera_id: item.cameraId,
            file_hash: item.hash,
            file_name: item.file.name,
            reason,
            upload_id: item.uploadId,
          },
        )
        .then((response) => {
          setDeletionPrompts((prompts) => {
            if (
              prompts.some(
                (prompt) => prompt.requestId === response.data.request_id,
              )
            ) {
              return prompts;
            }
            return [
              ...prompts,
              {
                requestId: response.data.request_id,
                itemId: item.id,
                fileName: item.file.name,
                fileHash: item.hash!,
                reason,
                uploadId: item.uploadId,
                parentDirectory: item.parentDirectory,
                entryName: item.entryName,
              },
            ];
          });
        })
        .catch((requestError) => {
          setFiles((rows) =>
            updateRow(rows, item.id, {
              error: `${item.error ? `${item.error} ` : ""}Camera deletion was not offered: ${errorMessage(requestError)}`,
            }),
          );
        });
    }
  }, [files, running]);

  const refreshVerificationStatuses = async () => {
    if (refreshingStatuses) return;
    const uploadedFiles = files.filter(
      (item) =>
        Boolean(item.uploadId) &&
        item.state !== "SOURCE_DELETED" &&
        item.state !== "DUPLICATE",
    );
    if (uploadedFiles.length === 0) return;

    setRefreshingStatuses(true);
    try {
      await Promise.all(
        uploadedFiles.map(async (item) => {
          try {
            const response = await api.get(
              `/sync/upload/browser/status/${item.uploadId}`,
            );
            const status = response.data?.integrity?.status as
              | string
              | undefined;
            if (status === "VERIFIED") {
              setFiles((rows) =>
                updateRow(rows, item.id, {
                  state: "VERIFIED",
                  progress: 1,
                  verificationDetail:
                    "Verification acknowledged · Evidence processing completed.",
                  error: undefined,
                }),
              );
            } else if (status === "AWAITING_ACKNOWLEDGEMENT") {
              setFiles((rows) =>
                updateRow(rows, item.id, {
                  verificationDetail:
                    "Integrity check passed · Awaiting Super Admin acknowledgement.",
                  error: undefined,
                }),
              );
            } else if (status === "FINALIZING") {
              setFiles((rows) =>
                updateRow(rows, item.id, {
                  verificationDetail:
                    "Verification acknowledged · Secure evidence finalization is running.",
                  error: undefined,
                }),
              );
            } else if (
              status === "MISMATCH" ||
              response.data?.upload?.status === "FAILED"
            ) {
              setFiles((rows) =>
                updateRow(rows, item.id, {
                  state: "FAILED",
                  selected: false,
                  error:
                    response.data?.finalization?.last_error ??
                    "Server integrity verification failed",
                }),
              );
            }
          } catch (error) {
            setFiles((rows) =>
              updateRow(rows, item.id, { error: errorMessage(error) }),
            );
          }
        }),
      );
    } finally {
      setRefreshingStatuses(false);
    }
  };

  const refreshEvidenceTable = async () => {
    setNotice(null);
    const tasks: Promise<void>[] = [refreshVerificationStatuses()];
    if (directoryHandleRef.current && !running && !scanning) {
      tasks.push(rescanEvidenceTable());
    }
    await Promise.all(tasks);
    if (files.length === 0 && !directoryHandleRef.current) {
      setNotice(
        "Choose camera storage first. After upload, this button refreshes every recording status from the backend.",
      );
    }
  };

  const ingestFile = async (item: EvidenceFile, signal: AbortSignal) => {
    let init: InitResponse | null = null;
    const metadata = await readVideoMetadata(item.file);
    const basePayload = {
      camera_id: cameraId,
      file_name: item.file.name,
      file_hash: "",
      size_bytes: item.file.size,
      mime_type: item.file.type || "video/mp4",
      duration: metadata.duration,
      resolution: metadata.resolution,
      start_timestamp: new Date(item.file.lastModified).toISOString(),
      end_timestamp: new Date(item.file.lastModified + metadata.duration * 1000).toISOString(),
    };

    try {
      const hashingStartedAt = performance.now();
      setFiles((rows) => updateRow(rows, item.id, {
        state: "HASHING",
        progress: 0,
        processedBytes: 0,
        processingBytesPerSecond: undefined,
        processingEtaSeconds: undefined,
        error: undefined,
      }));
      const hash = await hashFileSha256(
        item.file,
        (progress) => {
          const processedBytes = Math.min(progress * item.file.size, item.file.size);
          const elapsedSeconds = Math.max((performance.now() - hashingStartedAt) / 1000, 0.25);
          const bytesPerSecond = processedBytes / elapsedSeconds;
          const etaSeconds = bytesPerSecond > 0
            ? Math.max((item.file.size - processedBytes) / bytesPerSecond, 0)
            : undefined;
          setFiles((rows) => updateRow(rows, item.id, {
            progress,
            processedBytes,
            processingBytesPerSecond: bytesPerSecond,
            processingEtaSeconds: etaSeconds,
          }));
        },
        signal,
      );
      setFiles((rows) => updateRow(rows, item.id, {
        hash,
        cameraId,
        state: "CHECKING_DUPLICATE",
        progress: 1,
        processedBytes: item.file.size,
        processingBytesPerSecond: undefined,
        processingEtaSeconds: undefined,
      }));
      const duplicateResponse = await api.post<{ duplicate: boolean; message: string }>(
        "/sync/upload/browser/check-duplicate",
        { file_hash: hash },
      );
      if (duplicateResponse.data.duplicate) {
        setFiles((rows) => updateRow(rows, item.id, {
          hash,
          cameraId,
          state: "DUPLICATE",
          selected: false,
          progress: 1,
          error: duplicateResponse.data.message,
        }));
        return;
      }
      setFiles((rows) => updateRow(rows, item.id, {
        hash,
        cameraId,
        state: "UPLOADING",
        progress: 0,
        uploadedBytes: 0,
        uploadBytesPerSecond: undefined,
        etaSeconds: undefined,
        uploadRetries: 0,
      }));

      const initResponse = await api.post<InitResponse>("/sync/upload/browser/init", {
        ...basePayload,
        file_hash: hash,
      });
      const activeUpload = initResponse.data;
      init = activeUpload;

      const completedParts: Array<
        { part_number: number; etag: string } | undefined
      > = new Array(activeUpload.parts.length);
      const uploadStartedAt = performance.now();
      const uploadedBytesByPart = new Map<number, number>();
      let nextPartIndex = 0;

      const reportUploadProgress = (partNumber: number, loaded: number) => {
        uploadedBytesByPart.set(partNumber, loaded);
        const uploadedBytes = Math.min(
          Array.from(uploadedBytesByPart.values()).reduce(
            (total, partBytes) => total + partBytes,
            0,
          ),
          item.file.size,
        );
        const elapsedSeconds = Math.max(
          (performance.now() - uploadStartedAt) / 1000,
          0.25,
        );
        const bytesPerSecond = uploadedBytes / elapsedSeconds;
        const etaSeconds =
          bytesPerSecond > 0
            ? Math.max((item.file.size - uploadedBytes) / bytesPerSecond, 0)
            : undefined;
        setFiles((rows) =>
          updateRow(rows, item.id, {
            uploadedBytes,
            uploadBytesPerSecond: bytesPerSecond,
            etaSeconds,
            progress: uploadedBytes / item.file.size,
          }),
        );
      };

      const uploadNextPart = async () => {
        while (true) {
          const index = nextPartIndex;
          nextPartIndex += 1;
          if (index >= activeUpload.parts.length) return;

          const part = activeUpload.parts[index];
          if (!part) continue;
          const start = (part.part_number - 1) * activeUpload.part_size;
          const body = item.file.slice(
            start,
            Math.min(start + activeUpload.part_size, item.file.size),
          );
          const etag = await uploadPartWithRetry(
            part.url,
            body,
            signal,
            (partLoaded) => reportUploadProgress(part.part_number, partLoaded),
            () =>
              setFiles((rows) =>
                updateRow(rows, item.id, {
                  uploadRetries:
                    (rows.find((row) => row.id === item.id)?.uploadRetries ??
                      0) + 1,
                }),
              ),
          );
          uploadedBytesByPart.set(part.part_number, body.size);
          completedParts[index] = {
            part_number: part.part_number,
            etag,
          };
        }
      };

      await Promise.all(
        Array.from(
          {
            length: Math.min(
              MULTIPART_CONCURRENCY,
              activeUpload.parts.length,
            ),
          },
          () => uploadNextPart(),
        ),
      );

      const orderedCompletedParts = completedParts.filter(
        (
          part,
        ): part is {
          part_number: number;
          etag: string;
        } => Boolean(part),
      );

      const completeResponse = await api.post("/sync/upload/browser/complete", {
        ...basePayload,
        file_hash: hash,
        sync_session_id: activeUpload.sync_session_id,
        video_id: activeUpload.video_id,
        upload_id: activeUpload.upload_id,
        key: activeUpload.key,
        parts: orderedCompletedParts,
        upload_token: activeUpload.upload_token,
      });
      const evidenceUploadId = completeResponse.data?.upload?.upload_id as string;
      setFiles((rows) => updateRow(rows, item.id, {
        uploadId: evidenceUploadId,
        cameraId,
        state: "WAITING_FOR_VERIFICATION",
        progress: 1,
        uploadedBytes: item.file.size,
        etaSeconds: 0,
      }));
    } catch (error) {
      if (init) {
        await api.post("/sync/upload/browser/abort", {
          sync_session_id: init.sync_session_id,
          camera_id: cameraId,
          upload_id: init.upload_id,
          key: init.key,
          upload_token: init.upload_token,
        }).catch(() => undefined);
      }
      if (isDuplicateUploadError(error)) {
        setFiles((rows) => updateRow(rows, item.id, {
          state: "DUPLICATE",
          selected: false,
          progress: 1,
          error: "Duplicate evidence skipped. This recording already exists in the evidence database.",
        }));
        return;
      }
      setFiles((rows) => updateRow(rows, item.id, {
        state: "FAILED",
        selected: false,
        error: errorMessage(error),
      }));
    }
  };

  const startIngest = async () => {
    if (!cameraId || selectedFiles.length === 0 || running) return;
    for (const verificationController of verificationControllersRef.current.values()) {
      verificationController.abort();
    }
    verificationControllersRef.current.clear();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setNotice(null);
    try {
      for (const item of selectedFiles) {
        if (controller.signal.aborted) break;
        await ingestFile(item, controller.signal);
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  const activeDeletionPrompt = running ? undefined : deletionPrompts[0];

  const dismissActiveDeletionPrompt = () => {
    setDeletionPrompts((prompts) => prompts.slice(1));
  };

  const decideSourceDeletion = async (decision: "APPROVE" | "REJECT") => {
    const prompt = activeDeletionPrompt;
    if (!prompt || deletionBusy) return;

    setDeletionBusy(true);
    setNotice(null);
    try {
      const decisionResponse = await api.post<{
        authorization_token?: string;
      }>(
        `/sync/upload/browser/source-deletion/${prompt.requestId}/decision`,
        { decision },
      );
      if (decision === "REJECT") {
        setFiles((rows) =>
          updateRow(rows, prompt.itemId, {
            error:
              prompt.reason === "DUPLICATE_CONFIRMED"
                ? "Duplicate confirmed. Source recording retained on the camera by officer decision."
                : "Verified upload retained on the camera by officer decision.",
          }),
        );
        dismissActiveDeletionPrompt();
        return;
      }

      const authorizationToken = decisionResponse.data.authorization_token;
      if (!authorizationToken) {
        throw new Error(
          "The backend did not return a source deletion authorization",
        );
      }

      try {
        await prompt.parentDirectory.removeEntry(prompt.entryName);
      } catch (deleteError) {
        const failureReason = errorMessage(deleteError);
        await api
          .post(
            `/sync/upload/browser/source-deletion/${prompt.requestId}/fail`,
            {
              authorization_token: authorizationToken,
              failure_reason: failureReason,
            },
          )
          .catch(() => undefined);
        setFiles((rows) =>
          updateRow(rows, prompt.itemId, {
            error: `Camera deletion failed and was recorded by the backend: ${failureReason}`,
          }),
        );
        dismissActiveDeletionPrompt();
        throw new Error(
          `The browser could not delete the exact camera file: ${failureReason}`,
        );
      }

      let completionError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await api.post(
            `/sync/upload/browser/source-deletion/${prompt.requestId}/complete`,
            { authorization_token: authorizationToken },
          );
          completionError = undefined;
          break;
        } catch (error) {
          completionError = error;
          if (attempt < 3) {
            await new Promise<void>((resolve) =>
              window.setTimeout(resolve, attempt * 1000),
            );
          }
        }
      }

      setFiles((rows) =>
        updateRow(rows, prompt.itemId, {
          state: "SOURCE_DELETED",
          selected: false,
          sourceDeletionReason: prompt.reason,
          error: completionError
            ? `The source file was deleted, but the backend audit confirmation failed: ${errorMessage(completionError)}`
            : "The exact source recording was deleted from the camera after officer approval.",
        }),
      );
      dismissActiveDeletionPrompt();
      if (completionError) {
        setNotice(
          "The camera file was deleted, but its backend completion receipt could not be confirmed after three attempts. Contact a system administrator with the filename.",
        );
      }
    } catch (decisionError) {
      setNotice(errorMessage(decisionError));
    } finally {
      setDeletionBusy(false);
    }
  };

  const completedCount = files.filter(
    (file) =>
      file.state === "VERIFIED" ||
      (file.state === "SOURCE_DELETED" &&
        file.sourceDeletionReason === "VERIFIED_UPLOAD"),
  ).length;
  const waitingCount = files.filter((file) => file.state === "WAITING_FOR_VERIFICATION").length;

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-2 pb-8 text-white">
      <header className="border border-white/10 bg-gradient-to-r from-red-950/45 via-[#151619] to-[#111214] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Branch evidence operations</p>
        <h1 className="mt-2 text-2xl font-bold">Camera Evidence Ingest</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
          Select the mounted camera storage yourself. Umbrella calculates a SHA-256 fingerprint before transfer, uploads directly to protected cloud storage, and independently verifies the stored object before marking it complete.
        </p>
      </header>

      {!pickerSupported && (
        <div className="mt-4 border border-amber-500/40 bg-amber-950/25 p-4 text-sm text-amber-100">
          This browser cannot open a storage folder securely. Use the current desktop version of Microsoft Edge or Google Chrome and access the application over HTTPS.
        </div>
      )}
      {notice && <div className="mt-4 border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-100">{notice}</div>}

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border border-white/10 bg-white/[0.025] p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Registered camera</span>
              <select
                value={cameraId}
                onChange={(event) => setCameraId(event.target.value)}
                disabled={running || loadingCameras}
                className="mt-2 w-full border border-white/15 bg-[#111214] px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
              >
                <option value="">{loadingCameras ? "Loading assigned cameras..." : "Select the camera being ingested"}</option>
                {cameras.map((camera) => {
                  const officer = [camera.officer?.user?.first_name, camera.officer?.user?.last_name].filter(Boolean).join(" ");
                  return <option key={camera.camera_id} value={camera.camera_id}>{camera.serial_number} | {camera.manufacturer ?? "Unknown"} {camera.model}{officer ? ` | ${officer}` : ""}</option>;
                })}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setConsentOpen(true)}
              disabled={!pickerSupported || running || scanning}
              className="bg-red-600 px-5 py-2.5 text-sm font-semibold hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {scanning ? "Scanning..." : sourceName ? "Choose Different Storage" : "Choose Camera Storage"}
            </button>
          </div>

          <div className="mt-5 overflow-hidden border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/25 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{sourceName ?? "No storage selected"}</p>
                <p className="mt-1 text-xs text-white/45">{files.length} recording(s) found · {selectedFiles.length} selected · {formatBytes(totalSelectedBytes)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void refreshEvidenceTable()}
                  disabled={
                    refreshingStatuses
                  }
                  className="border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {refreshingStatuses
                    ? "Checking statuses..."
                    : scanning
                      ? "Refresh verification status"
                      : "Refresh table status"}
                </button>
                {files.length > 0 && !running && (
                  <button type="button" onClick={() => setFiles((rows) => rows.map((row) => ({ ...row, selected: selectedFiles.length !== files.length })))} className="text-xs font-semibold text-red-300 hover:text-red-200">
                    {selectedFiles.length === files.length ? "Clear selection" : "Select all"}
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[48vh] overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 bg-[#17181b] text-xs uppercase text-white/45">
                  <tr><th className="p-3">Use</th><th className="p-3">Recording</th><th className="p-3">Size</th><th className="p-3">SHA-256</th><th className="p-3">Integrity state</th></tr>
                </thead>
                <tbody>
                  {files.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-white/40">Choose the mounted camera drive or recording folder to discover MP4 evidence.</td></tr>
                  ) : files.map((item) => (
                    <tr key={item.id} className={`border-t align-top ${item.state === "DUPLICATE" ? "border-amber-400/35 bg-amber-500/10" : item.state === "SOURCE_DELETED" ? "border-sky-400/25 bg-sky-500/[0.07]" : "border-white/5 hover:bg-white/[0.025]"}`}>
                      <td className="p-3"><input type="checkbox" checked={item.selected} disabled={running || item.state === "VERIFIED" || item.state === "DUPLICATE" || item.state === "SOURCE_DELETED" || item.state === "FAILED"} onChange={(event) => setFiles((rows) => updateRow(rows, item.id, { selected: event.target.checked }))} className="accent-red-600" /></td>
                      <td className="p-3"><p className="font-medium">{item.file.name}</p><p className="mt-1 text-xs text-red-200/55">Device path: REDACTED</p></td>
                      <td className="p-3 text-white/65">{formatBytes(item.file.size)}</td>
                      <td className="p-3 font-mono text-xs text-white/60">{item.hash ? `${item.hash.slice(0, 16)}…` : "Not calculated"}</td>
                      <td className="p-3">
                        <p className={item.state === "VERIFIED" ? "font-semibold text-emerald-300" : item.state === "DUPLICATE" ? "font-semibold text-amber-300" : item.state === "SOURCE_DELETED" ? "font-semibold text-sky-300" : item.state === "FAILED" ? "font-semibold text-red-300" : "font-semibold text-white/70"}>{item.state === "DUPLICATE" ? "DUPLICATE VIDEO" : item.state === "SOURCE_DELETED" ? "SOURCE DELETED" : item.state.replaceAll("_", " ")}</p>
                        <div className="mt-2 min-w-[250px] space-y-1 border-l border-white/10 pl-3">
                          {processingRecord(item).map((stage) => (
                            <p key={stage.label} className={`text-[11px] leading-4 ${stage.done ? "text-emerald-200/70" : stage.active ? "text-amber-200" : "text-white/30"}`}>
                              <span className="mr-1.5 font-semibold">{stage.done ? "DONE" : stage.active ? "CHECKING" : "NEXT"}</span>
                              {stage.label}
                            </p>
                          ))}
                        </div>
                        {(item.state === "HASHING" || item.state === "CHECKING_DUPLICATE" || item.state === "UPLOADING" || item.state === "WAITING_FOR_VERIFICATION") && <div className="mt-2 h-1.5 w-36 overflow-hidden bg-white/10"><div className={`h-full transition-all ${item.state === "CHECKING_DUPLICATE" ? "w-full animate-pulse bg-amber-400" : "bg-red-500"}`} style={item.state === "CHECKING_DUPLICATE" ? undefined : { width: `${Math.round(item.progress * 100)}%` }} /></div>}
                        {item.state === "UPLOADING" && (
                          <div className="mt-2 space-y-1 text-xs text-white/55">
                            <p>{Math.round(((item.uploadedBytes ?? 0) / item.file.size) * 100)}% uploaded · {formatBytes(item.uploadedBytes ?? 0)} of {formatBytes(item.file.size)}</p>
                            <p>
                              {item.uploadBytesPerSecond
                                ? `${formatBytes(item.uploadBytesPerSecond)}/s · About ${formatDuration(item.etaSeconds ?? -1)} remaining`
                                : "Calculating upload speed and estimated time..."}
                            </p>
                            {(item.uploadRetries ?? 0) > 0 && (
                              <p className="text-amber-200/80">
                                Recovered {item.uploadRetries} stalled upload part{item.uploadRetries === 1 ? "" : "s"}.
                              </p>
                            )}
                          </div>
                        )}
                        {item.state === "HASHING" && (
                          <div className="mt-2 space-y-1 text-xs text-white/55">
                            <p>{Math.round(item.progress * 100)}% read · {formatBytes(item.processedBytes ?? 0)} of {formatBytes(item.file.size)}</p>
                            <p>
                              {item.processingBytesPerSecond
                                ? `${formatBytes(item.processingBytesPerSecond)}/s from camera · About ${formatDuration(item.processingEtaSeconds ?? -1)} remaining`
                                : "Reading camera storage and calculating evidence fingerprints..."}
                            </p>
                          </div>
                        )}
                        {item.state === "CHECKING_DUPLICATE" && (
                          <p className="mt-2 text-xs text-amber-100/75">
                            SHA-256 is ready. Checking the evidence database before any cloud upload begins.
                          </p>
                        )}
                        {item.state === "WAITING_FOR_VERIFICATION" && (
                          <p className="mt-2 text-xs text-amber-200/80">
                            {item.verificationDetail ??
                              "Upload complete · Waiting for independent server verification."}
                          </p>
                        )}
                        {item.error && <p className={`mt-1 max-w-xs text-xs leading-5 ${item.state === "DUPLICATE" ? "text-amber-100/75" : item.state === "SOURCE_DELETED" ? "text-sky-100/75" : "text-red-200/80"}`}>{item.error}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="border border-white/10 bg-black/20 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Integrity controls</h2>
          <ol className="mt-4 space-y-4 text-sm text-white/60">
            <li><strong className="block text-white">1. Local fingerprint</strong>SHA-256 is calculated from the exact file bytes before transfer.</li>
            <li><strong className="block text-white">2. Direct protected upload</strong>The video goes directly to private Cloudflare R2 storage through short-lived upload URLs.</li>
            <li><strong className="block text-white">3. Independent verification</strong>The backend streams the stored object and recalculates SHA-256.</li>
            <li><strong className="block text-white">4. Evidentiary audit trail</strong>The officer, camera, branch, upload times, and hashes are recorded.</li>
          </ol>
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-xs uppercase text-white/40">Verified this batch</p>
            <p className="mt-1 text-3xl font-semibold">{completedCount}<span className="text-base text-white/35"> / {selectedFiles.length || files.length}</span></p>
            <p className="mt-2 text-xs text-amber-200/70">{waitingCount} waiting for verification</p>
          </div>
          {!running ? (
            <button type="button" onClick={() => void startIngest()} disabled={!cameraId || selectedFiles.length === 0} className="mt-6 w-full bg-red-600 px-4 py-3 text-sm font-semibold hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">Check, Hash, Upload and Verify</button>
          ) : (
            <button type="button" onClick={() => abortRef.current?.abort()} className="mt-6 w-full border border-red-500/60 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-100 hover:bg-red-950/50">Stop after current request</button>
          )}
          <p className="mt-3 text-xs leading-5 text-white/35">Keep the camera connected until every upload reaches “Waiting for verification.” Verification then continues securely on the server.</p>
        </aside>
      </section>

      {consentOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setConsentOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="evidence-storage-consent" className="w-full max-w-xl border border-white/15 bg-[#111214] shadow-2xl">
            <header className="border-b border-white/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Permission required</p><h2 id="evidence-storage-consent" className="mt-2 text-xl font-semibold">Allow access to camera storage?</h2></header>
            <div className="space-y-4 p-5 text-sm leading-6 text-white/65">
              <p>After you continue, your browser will open its secure folder picker. Select only the connected camera drive or its recordings folder.</p>
              <div className="grid gap-3 sm:grid-cols-2"><div className="border border-white/10 p-4"><strong className="text-white">Umbrella will read</strong><p className="mt-1">MP4 filenames, sizes, modification times, and exact file bytes needed for hashing and upload.</p></div><div className="border border-white/10 p-4"><strong className="text-white">Umbrella may delete only with approval</strong><p className="mt-1">A source recording can be removed only after backend verification and a separate approve action in the deletion prompt.</p></div></div>
              <p className="text-xs text-white/40">Read and write folder access requires explicit browser permission. Umbrella cannot inspect or change another drive, and access ends when browser permission is removed.</p>
            </div>
            <footer className="flex justify-end gap-2 border-t border-white/10 p-5"><button type="button" onClick={() => setConsentOpen(false)} className="border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 hover:text-white">Cancel</button><button type="button" onClick={() => void chooseCameraStorage()} className="bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500">Continue to Folder Picker</button></footer>
          </section>
        </div>
      )}

      {activeDeletionPrompt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="evidence-source-deletion-title" className="w-full max-w-xl border border-amber-400/30 bg-[#111214] shadow-2xl">
            <header className="border-b border-white/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Source recording decision</p>
              <h2 id="evidence-source-deletion-title" className="mt-2 text-xl font-semibold">Delete this video from the dashcam?</h2>
            </header>
            <div className="space-y-4 p-5 text-sm leading-6 text-white/65">
              <p>
                Umbrella Systems is requesting permission to permanently delete <strong className="break-all text-white">{activeDeletionPrompt.fileName}</strong> from the selected dashcam storage.
              </p>
              <div className="border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Verified reason</p>
                <p className="mt-2 text-white/80">
                  {activeDeletionPrompt.reason === "DUPLICATE_CONFIRMED"
                    ? "An identical SHA-256 recording already exists and has passed server integrity verification."
                    : "This upload has completed and the stored cloud object has passed independent server integrity verification."}
                </p>
              </div>
              <p>
                The backend validated this request and will audit your decision. If you approve, the browser will remove only this exact filename from its scanned parent folder. This action cannot be undone.
              </p>
              {deletionPrompts.length > 1 && (
                <p className="text-xs text-amber-200/70">
                  {deletionPrompts.length - 1} additional source deletion decision{deletionPrompts.length === 2 ? "" : "s"} will be shown afterward.
                </p>
              )}
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 p-5">
              <button type="button" onClick={() => void decideSourceDeletion("REJECT")} disabled={deletionBusy} className="border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 hover:text-white disabled:opacity-45">
                {deletionBusy ? "Recording decision..." : "Reject and keep video"}
              </button>
              <button type="button" onClick={() => void decideSourceDeletion("APPROVE")} disabled={deletionBusy} className="bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-45">
                {deletionBusy ? "Processing securely..." : "Approve permanent deletion"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

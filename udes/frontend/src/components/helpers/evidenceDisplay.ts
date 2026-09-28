export const REDACTED_EVIDENCE_PATH = "REDACTED";

type VideoFile = {
  file_name?: string | null;
  file_path?: string | null;
  video_id?: string | null;
  format?: string | null;
};

export function evidenceFileName(video?: VideoFile | null): string {
  const provided = video?.file_name?.trim();
  if (provided) return provided;

  const path = video?.file_path?.trim();
  if (path && path.toUpperCase() !== REDACTED_EVIDENCE_PATH) {
    const withoutQuery = path.split(/[?#]/, 1)[0] ?? path;
    const candidate = withoutQuery.replace(/\\/g, "/").split("/").filter(Boolean).at(-1);
    if (candidate) {
      try {
        return decodeURIComponent(candidate);
      } catch {
        return candidate;
      }
    }
  }

  const extension = video?.format?.replace(/^\./, "").toLowerCase() || "mp4";
  return video?.video_id ? `evidence-${video.video_id}.${extension}` : "Evidence video";
}

export function humanizeEvidenceValue(value?: string | null): string {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export function formatEvidenceDate(value?: string | null, fallback = "Not available"): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

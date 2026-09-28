import { useEffect } from "react";

const VIEW_LABELS: Record<string, string> = {
  admin: "Platform Administration",
  assigned: "Assigned Reviews",
  audit: "Audit Logs",
  "audit-reports": "Reports",
  branches: "Branches",
  cameras: "Camera Inventory",
  "camera-device-scan": "Camera Device Scan",
  "camera-reassignments": "Camera Reassignments",
  evidenceReports: "Evidence Reports",
  monitoring: "Platform Monitoring",
  officers: "Officers",
  organizations: "Organizations",
  queue: "Review Queue",
  reports: "Reports",
  requests: "Requests",
  "requests-password-change": "Password Change Requests",
  "requests-video": "Video Requests",
  sessions: "Sessions",
  shifts: "Shifts",
  billing: "Billing Centre",
  users: "Users",
  videos: "Videos",
  "video-uploads": "Video Uploads",
  "evidence-ingest": "Evidence Ingest",
  violations: "Violations",
};

function readableLabel(value: string) {
  return VIEW_LABELS[value]
    ?? value
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function useDocumentTitle(view: string, workspace?: string | null) {
  useEffect(() => {
    const parts = [readableLabel(view), workspace?.trim(), "UDES"].filter(Boolean);
    document.title = parts.join(" | ");
  }, [view, workspace]);
}

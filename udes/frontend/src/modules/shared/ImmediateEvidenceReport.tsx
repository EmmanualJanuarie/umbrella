import { useUser } from "../../context/UserContext";
import { useReportDownload } from "./useReportDownload";

export default function ImmediateEvidenceReport() {
  const { user } = useUser();
  const { requestDownload, dialogElement } = useReportDownload();
  const roleLabel = user?.role === "OFFICER" ? "your own activity" : "your authorized evidence scope";

  return (
    <section className="border border-amber-500/25 bg-amber-500/[0.06] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Current month</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Immediate evidence report</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
            Create a secure report from the first day of this month up to the current time for {roleLabel}. It does not replace the closed month-end report.
          </p>
        </div>
        <button
          type="button"
          onClick={() => requestDownload({ url: "/audit-report/immediate/pdf", method: "POST", fileName: "immediate-evidence-report.pdf", title: "Download Immediate Evidence Report" })}
          className="bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-300"
        >
          Generate and download
        </button>
      </div>
      {dialogElement}
    </section>
  );
}

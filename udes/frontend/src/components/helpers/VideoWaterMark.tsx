// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function VideoWatermark({ video, time }: any) {
  const officer = video?.session?.officer;
  const officerUser = officer?.user;
  const officerName =
    [officerUser?.first_name, officerUser?.last_name]
      .filter(Boolean)
      .join(" ") || "UNAVAILABLE";
  const officerId =
    officer?.officer_id ?? officer?.badge_number ?? officerUser?.user_id;
  const organizationName =
    video?.session?.organization?.name ??
    officerUser?.organization?.name ??
    video?.organization?.name;
  const branchName =
    video?.session?.branch?.name ??
    officerUser?.branch?.name ??
    video?.branch?.name;
  const watermarkClass =
    "pointer-events-none absolute z-10 bg-black/55 p-2 font-mono text-[10px] leading-4 text-white/80 shadow-lg";

  return (
    <>
      <div className={`${watermarkClass} left-5 top-5`}>
        <p className="text-left">OFFICER: {officerName}</p>
        <p className="text-left">OFFICER ID: {officerId ?? "UNAVAILABLE"}</p>
        <p className="text-left">
          BADGE: {officer?.badge_number ?? "UNAVAILABLE"}
        </p>
      </div>

      <div className={`${watermarkClass} right-5 top-5`}>
        <p className="text-right">
          SESSION: {video?.session?.session_id ?? "UNAVAILABLE"}
        </p>
        <p className="text-right">
          CAMERA: {video?.session?.camera?.serial_number ?? "UNAVAILABLE"}
        </p>
      </div>

      <div className={`${watermarkClass} bottom-12 left-5`}>
        <p className="text-left">
          ORGANIZATION: {organizationName ?? "UNAVAILABLE"}
        </p>
        <p className="text-left">
          BRANCH: {branchName ?? "UNAVAILABLE"}
        </p>
      </div>

      <div className={`${watermarkClass} bottom-12 right-5`}>
        <p className="text-right">{time.toLocaleString()}</p>
        <p className="text-right">
          VIDEO ID: {video?.video_id ?? "UNAVAILABLE"}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-0 z-[9] flex items-center justify-center overflow-hidden">
        <p className="-rotate-12 select-none font-mono text-lg font-bold tracking-[0.35em] text-white/[0.08]">
          UMBRELLA SYSTEMS PROTECTED EVIDENCE
        </p>
      </div>
    </>
  );
}

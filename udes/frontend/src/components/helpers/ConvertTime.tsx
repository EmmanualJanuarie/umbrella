interface ConvertTimeProps {
  seconds?: number | null;
}

export const ConvertTime = ({ seconds }: ConvertTimeProps) => {
  if (!seconds || seconds <= 0) return <span className="text-white/40">Unavailable</span>;

  const total = Math.floor(seconds);

  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const formatted = [
    hrs > 0 ? String(hrs).padStart(2, "0") : null,
    String(mins).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ]
    .filter(Boolean)
    .join(":");

  return <span>{formatted}</span>;
};

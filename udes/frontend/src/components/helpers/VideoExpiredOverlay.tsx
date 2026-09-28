type Props = {
  logo?: string; // optional base64 or URL
};

export default function VideoExpiredOverlay({ logo }: Props) {
  return (
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
      
      <div className="text-center text-white space-y-4">

        {/* LOGO */}
        {logo ? (
          <img
            src={logo}
            alt="Company Logo"
            className="w-20 h-20 mx-auto object-contain opacity-80"
          />
        ) : (
          <div className="w-16 h-16 mx-auto bg-gray-700 rounded-full" />
        )}

        {/* TEXT */}
        <h2 className="text-lg font-semibold">
          Video Unavailable
        </h2>

        <p className="text-sm text-gray-400 max-w-xs">
          This video session has expired or is no longer accessible.
        </p>
      </div>
    </div>
  );
}
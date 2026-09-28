import { useEffect, useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Page Not Found");
  const [isDesktop, setIsDesktop] = useState(true);
  const [isTooWide, setIsTooWide] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      setIsDesktop(width >= 1024);
      setIsTooWide(width > 1920);
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);

    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-body-black text-white p-6">
      {isTooWide ? (
        <p className="text-lg font-bold text-center">
          Your screen is too wide for the Digital Evidence System portal.
          <br />
          Please reduce the width to an appropriate size.
        </p>
      ) : !isDesktop ? (
        <p className="text-lg font-bold text-center">
          Sorry, the Digital Evidence System portal is only available on laptops and desktops.
          <br />
          Please access it from a larger screen.
        </p>
      ) : (
        <div className="flex flex-col items-center text-center max-w-md">
          {/* Icon */}
          <div className="mb-6 text-red-500 text-6xl"></div>

          {/* Title */}
          <h1 className="text-4xl font-extrabold tracking-widest text-red-500">
            ACCESS DENIED
          </h1>

          {/* Subtitle */}
          <p className="mt-4 text-gray-400 text-lg">
            The requested resource could not be found or you do not have permission
            to access this area.
          </p>

          {/* Divider */}
          <div className="my-6 h-px w-64 bg-gray-700" />

          {/* System Message */}
          <p className="text-sm text-gray-500 tracking-wide">
            ERROR CODE: 404 | UMBRELLA SYSTEMS SECURITY
          </p>

          {/* Button */}
          <button
            onClick={() => window.history.back()}
            className="mt-6 bg-red-600 px-6 py-2 text-sm font-semibold hover:bg-red-700 transition"
          >
            Return to Previous Screen
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";

export type ScreenState = "mobile" | "desktop" | "wide" | "shortHeight";

export function useScreenSize() {
  const [screenState, setScreenState] = useState<ScreenState>("desktop");
  const [screenMessage, setScreenMessage] = useState<string>("");

  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (height < 771) {
        setScreenState("shortHeight");
        setScreenMessage(
          "Your screen height is too small to properly display the portal. Please increase the height of your browser window or use a taller monitor."
        );
      } else if (width < 1024) {
        setScreenState("mobile");
        setScreenMessage(
          "Sorry, the Digital Evidence System portal is only available on normal desktop screens. Please use a laptop or standard monitor."
        );
      } else if (width > 1920) {
        setScreenState("wide");
        setScreenMessage(
          "Your screen is too wide for optimal viewing. Please resize your browser to a standard desktop width."
        );
      } else {
        setScreenState("desktop");
        setScreenMessage(""); // no message needed for normal desktop
      }
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  return { screenState, screenMessage };
}
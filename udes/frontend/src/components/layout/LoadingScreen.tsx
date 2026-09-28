import Logo from "../../common/Logo";
import "../../app/ripple.css";

export default function LoadingScreen() {
  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-body-black">
      
      {/* Ripple container */}
      <div className="absolute flex items-center justify-center">
        <span className="ripple ripple-1"></span>
        <span className="ripple ripple-2"></span>
        <span className="ripple ripple-3"></span>
      </div>

      {/* Logo */}
      <div className="z-10">
        <Logo set_classname="logo-rem-3" />
      </div>
    </div>
  );
}

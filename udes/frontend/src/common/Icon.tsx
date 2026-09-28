import { useState } from "react";

type IconProps = {
  set_default_src: string;
  set_hover_src: string;
  set_classname?: string;
  isOpen?: boolean; // NEW: allow external control of open state
  onToggle?: (isOpen: boolean) => void;
};

export default function Icon({
  set_default_src,
  set_hover_src,
  set_classname,
  isOpen = false,
  onToggle,
}: IconProps) {
  const [isHovered, setIsHovered] = useState(false);

  const isActive = isHovered || isOpen;

  const handleClick = () => {
   onToggle?.(!isOpen)
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="shrink-0"
    >
      <img
        src={isActive ? set_hover_src : set_default_src}
        alt="Menu Icon"
        className={`transition-all duration-300 ease-in-out ${set_classname}`}
      />
    </button>
  );
}

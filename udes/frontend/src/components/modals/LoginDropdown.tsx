import { useState, useRef, useEffect } from "react";
import Icon from "../../common/Icon";
import { useNavigate } from "react-router-dom";

type DropdownMenuProps = {
  defaultIcon: string;
  hoverIcon: string;
};

export default function DropdownMenu({ defaultIcon, hoverIcon }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();

   //Detect outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Icon Button */}
      <Icon
        set_default_src={defaultIcon}
        set_hover_src={hoverIcon}
        isOpen={open}
        onToggle={setOpen}
        set_classname="w-6 h-6"
      />

      {/* Dropdown Items */}
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white shadow-lg  z-50">
          <ul className="flex flex-col text-gray-800">
            <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={()=>{
                setOpen(false);
                navigate("/help");
              }}
            >
              Help
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

import { type ReactNode, useEffect, useState } from "react";

export type SidebarMenuGroup = {
  key: string;
  label: string;
  items: Array<{ key: string; label: string }>;
};

type Props = {
  title: string;
  subtitle: string;
  groups: SidebarMenuGroup[];
  activeView: string;
  setActiveView: (view: string) => void;
  className?: string;
  children?: ReactNode;
};

export default function CollapsibleSidebarNav({
  title,
  subtitle,
  groups,
  activeView,
  setActiveView,
  className,
  children,
}: Props) {
  const activeGroupKey = groups.find((group) =>
    group.items.some((item) => item.key === activeView),
  )?.key;
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    activeGroupKey ? [activeGroupKey] : [],
  );

  useEffect(() => {
    if (!activeGroupKey) return;
    setOpenGroups((current) =>
      current.includes(activeGroupKey) ? current : [...current, activeGroupKey],
    );
  }, [activeGroupKey]);

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey],
    );
  };

  return (
    <div className={className ?? "h-full overflow-y-auto bg-body-black/80 p-4 text-left"}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
        {title}
      </h2>
      <p className="mt-1 mb-5 text-sm text-white/55">{subtitle}</p>

      <nav aria-label={`${title} navigation`} className="space-y-2">
        {groups.map((group) => {
          const open = openGroups.includes(group.key);
          const containsActive = group.items.some((item) => item.key === activeView);

          return (
            <section key={group.key} className="border border-white/10 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={open}
                className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm font-semibold transition ${
                  containsActive ? "bg-red-600/10 text-white" : "text-white/80 hover:bg-white/[0.05]"
                }`}
              >
                <span>{group.label}</span>
                <span aria-hidden="true" className={`text-base text-white/45 transition-transform ${open ? "rotate-180" : ""}`}>
                  ⌄
                </span>
              </button>

              {open && (
                <ul className="border-t border-white/10 bg-black/20 py-1">
                  {group.items.map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => setActiveView(item.key)}
                        className={`w-full border-l-2 px-5 py-2.5 text-left text-sm transition ${
                          activeView === item.key
                            ? "border-red-500 bg-red-600/20 text-white"
                            : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

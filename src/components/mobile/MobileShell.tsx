import { CalendarClock, CalendarRange, LayoutGrid, MapPinned, Menu } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import "./mobile-integrated.css";

export type MobileTab = "today" | "timetable" | "route" | "gaps";

type MobileRouteTargetContextValue = {
  routeTargetId: string | null;
  setRouteTargetId: (id: string | null) => void;
};

const MobileRouteTargetContext = createContext<MobileRouteTargetContextValue | null>(null);

export function useMobileRouteTarget() {
  const value = useContext(MobileRouteTargetContext);
  if (!value) throw new Error("useMobileRouteTarget must be used inside MobileShell");
  return value;
}

const NAV_ITEMS = [
  { tab: "today" as MobileTab, to: "/today" as const, label: "Today", icon: CalendarClock },
  {
    tab: "timetable" as MobileTab,
    to: "/timetable" as const,
    label: "Timetable",
    icon: LayoutGrid,
  },
  { tab: "gaps" as MobileTab, to: "/gaps" as const, label: "Gaps", icon: CalendarRange },
  { tab: "route" as MobileTab, to: "/route" as const, label: "Map", icon: MapPinned },
];

const PAGE_LABEL: Record<MobileTab, string> = {
  today: "My day",
  timetable: "Timetable",
  gaps: "Gap plan",
  route: "Campus map",
};

export function MobileShell({
  tab,
  onOpenMore,
  moreOpen,
  children,
}: {
  tab: MobileTab;
  onOpenMore: () => void;
  moreOpen: boolean;
  children: ReactNode;
}) {
  const [routeTargetId, setRouteTargetId] = useState<string | null>(null);
  const routeTargetContext = useMemo(() => ({ routeTargetId, setRouteTargetId }), [routeTargetId]);

  return (
    <MobileRouteTargetContext.Provider value={routeTargetContext}>
      <div className="app-shell mobile-integrated-app flex min-h-[100dvh] flex-col bg-background text-foreground">
        <header className="mobile-topbar sticky top-0 z-30 border-b border-border">
          <div className="mx-auto flex min-h-[3.5rem] w-full max-w-[46rem] items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="brand-mark-shell h-7 w-7">
                <img src="/logo-mark.svg" alt="" aria-hidden="true" />
              </span>
              <p className="truncate font-display text-[0.95rem] font-semibold tracking-[-0.035em]">
                Gapwise
              </p>
            </div>
            <p className="truncate text-xs font-semibold text-muted-foreground">
              {PAGE_LABEL[tab]}
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-4">
          {children}
        </main>

        <nav
          aria-label="Main"
          className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto grid max-w-[46rem] grid-cols-5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.tab;
              return (
                <li key={item.tab}>
                  <Link
                    to={item.to}
                    onClick={() => {
                      if (item.tab === "route") setRouteTargetId(null);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`mobile-nav-item flex min-h-[3.75rem] w-full flex-col items-center justify-center gap-1 text-[0.64rem] font-semibold ${
                      active ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={onOpenMore}
                aria-expanded={moreOpen}
                className={`mobile-nav-item flex min-h-[3.75rem] w-full flex-col items-center justify-center gap-1 text-[0.64rem] font-semibold ${
                  moreOpen ? "text-accent" : "text-muted-foreground"
                }`}
              >
                <Menu className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
                More
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </MobileRouteTargetContext.Provider>
  );
}

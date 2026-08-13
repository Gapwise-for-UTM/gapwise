import { CalendarClock, LayoutGrid, MapPinned, Menu } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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
  { tab: "route" as MobileTab, to: "/route" as const, label: "Map", icon: MapPinned },
];

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
      <div className="app-shell flex min-h-[100dvh] flex-col bg-background text-foreground">
        <header className="app-nav sticky top-0 z-30 border-b" data-scrolled="true">
          <div className="flex min-h-[3.25rem] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
            <span className="brand-mark-shell h-7 w-7">
              <img src="/logo-mark.svg" alt="" aria-hidden="true" />
            </span>
            <p className="flex min-w-0 items-center gap-2 truncate font-display text-[0.95rem] font-semibold tracking-[-0.035em]">
              Gapwise <span className="brand-utm-pill">UTM</span>
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-4">
          {children}
        </main>

        <nav
          aria-label="Main"
          className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="grid grid-cols-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.tab || (item.tab === "timetable" && tab === "gaps");
              return (
                <li key={item.tab}>
                  <Link
                    to={item.to}
                    onClick={() => {
                      if (item.tab === "route") setRouteTargetId(null);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`mobile-nav-item flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold ${
                      active ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
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
                className={`mobile-nav-item flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold ${
                  moreOpen ? "text-accent" : "text-muted-foreground"
                }`}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
                More
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </MobileRouteTargetContext.Provider>
  );
}

import { CalendarClock, LayoutGrid, MapPinned, Menu } from "lucide-react";
import type { ReactNode } from "react";

export type MobileTab = "today" | "timetable" | "route" | "gaps";

const NAV_ITEMS = [
  { tab: "today" as MobileTab, label: "Today", icon: CalendarClock },
  { tab: "timetable" as MobileTab, label: "Timetable", icon: LayoutGrid },
  { tab: "route" as MobileTab, label: "Map", icon: MapPinned },
];

export function MobileShell({
  tab,
  onTabChange,
  onOpenMore,
  moreOpen,
  children,
}: {
  tab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onOpenMore: () => void;
  moreOpen: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app-shell flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="app-nav sticky top-0 z-30 border-b" data-scrolled="true">
        <div className="flex min-h-[3.25rem] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-6 w-6 shrink-0" />
          <p className="min-w-0 truncate font-display text-[0.95rem] font-semibold tracking-[-0.025em]">
            Gapwise <span className="text-accent">for UTM</span>
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-4">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      >
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.tab || (item.tab === "timetable" && tab === "gaps");
            return (
              <li key={item.tab}>
                <button
                  type="button"
                  onClick={() => onTabChange(item.tab)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold transition-colors ${
                    active ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={onOpenMore}
              aria-expanded={moreOpen}
              className={`flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold transition-colors ${
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
  );
}

import {
  CalendarClock,
  CalendarRange,
  Home,
  LayoutGrid,
  MapPinned,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Theme } from "@/hooks/use-preferences";
import type { AppDestination } from "@/features/navigation/use-app-navigation";

const destinations = [
  {
    to: "/today",
    destination: "today",
    label: "Today",
    accessibleLabel: "Today",
    icon: CalendarClock,
  },
  {
    to: "/timetable",
    destination: "timetable",
    label: "Timetable",
    accessibleLabel: "Weekly timetable",
    icon: LayoutGrid,
  },
  {
    to: "/gaps",
    destination: "gaps",
    label: "Gap Plan",
    accessibleLabel: "Gap plan",
    icon: CalendarRange,
  },
  {
    to: "/route",
    destination: "route",
    label: "Map",
    accessibleLabel: "Day route",
    icon: MapPinned,
  },
] as const;

/** Desktop-only primary navigation. Mobile retains the integrated bottom navigation. */
export function DesktopSidebar({
  destination,
  arrivalLabel,
  theme,
  onOpenArrival,
  onToggleTheme,
}: {
  destination: AppDestination;
  arrivalLabel: string;
  theme: Theme;
  onOpenArrival: () => void;
  onOpenAccount: () => void;
  onToggleTheme: () => void;
}) {
  const darkTheme = theme === "dark";

  return (
    <aside className="desktop-sidebar" aria-label="Desktop navigation">
      <Link to="/" className="desktop-brand" aria-label="Gapwise for UTM home">
        <span className="brand-mark-shell">
          <img src="/logo-mark.svg" alt="" aria-hidden="true" />
        </span>
        <span>Gapwise</span>
        <span
          className="brand-utm-pill"
          style={{ color: "light-dark(var(--color-primary), var(--color-accent))" }}
        >
          UTM
        </span>
      </Link>

      <nav role="group" aria-label="View mode">
        {destinations.map((item) => {
          const Icon = item.icon;
          const active = destination === item.destination;
          return (
            <Link
              key={item.destination}
              to={item.to}
              role="button"
              aria-label={item.accessibleLabel}
              aria-pressed={active}
              aria-current={active ? "page" : undefined}
              className="desktop-nav-link"
              style={
                active
                  ? { color: "light-dark(var(--color-primary), var(--color-accent))" }
                  : undefined
              }
            >
              <Icon aria-hidden="true" />
              <span className="desktop-nav-copy">
                <span>{item.label}</span>
                {active && item.destination === "gaps" ? (
                  <small>Tune gap recommendations</small>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="desktop-sidebar-foot">
        <button
          type="button"
          className="desktop-sidebar-utility"
          aria-label="Campus arrival settings"
          onClick={onOpenArrival}
        >
          <Home aria-hidden="true" />
          <span>{arrivalLabel}</span>
        </button>
        <div className="desktop-account-row">
          <button
            type="button"
            className="desktop-sidebar-utility desktop-account-settings"
            aria-label="Account settings"
            onClick={() => window.dispatchEvent(new Event("gapwise:open-account-settings"))}
          >
            <Settings aria-hidden="true" />
            <span>Account settings</span>
          </button>
          <button
            type="button"
            className="desktop-theme-toggle"
            onClick={onToggleTheme}
            aria-pressed={darkTheme}
            aria-label={darkTheme ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkTheme ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

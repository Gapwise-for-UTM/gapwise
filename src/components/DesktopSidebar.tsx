import { CalendarClock, CalendarRange, Home, LayoutGrid, MapPinned, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
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

function openCampusArrivalSettings() {
  document
    .querySelector<HTMLButtonElement>(
      '.desktop-app-header button[aria-label="Campus arrival settings"]',
    )
    ?.click();
}

/** Desktop-only primary navigation. Mobile retains the integrated bottom navigation. */
export function DesktopSidebar({ destination }: { destination: AppDestination }) {
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
          onClick={openCampusArrivalSettings}
        >
          <Home aria-hidden="true" />
          <span>Campus arrival</span>
        </button>
        <div className="desktop-identity">
          <span className="desktop-avatar">G</span>
          <span>
            <strong>Gapwise</strong>
            <small>Private by design</small>
          </span>
          <Settings aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}

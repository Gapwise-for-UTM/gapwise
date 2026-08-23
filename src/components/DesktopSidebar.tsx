import { CalendarClock, CalendarRange, LayoutGrid, MapPinned, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AppDestination } from "@/features/navigation/use-app-navigation";

const destinations = [
  { to: "/today", destination: "today", label: "Today", icon: CalendarClock },
  { to: "/timetable", destination: "timetable", label: "Timetable", icon: LayoutGrid },
  { to: "/gaps", destination: "gaps", label: "Gap Plan", icon: CalendarRange },
  { to: "/route", destination: "route", label: "Map", icon: MapPinned },
] as const;

/** Desktop-only primary navigation. Mobile retains the integrated bottom navigation. */
export function DesktopSidebar({ destination }: { destination: AppDestination }) {
  return (
    <aside className="desktop-sidebar" aria-label="Desktop navigation">
      <Link to="/" className="desktop-brand" aria-label="Gapwise for UTM home">
        <span className="brand-mark-shell">
          <img src="/logo-mark.svg" alt="" aria-hidden="true" />
        </span>
        <span>Gapwise</span>
        <span className="brand-utm-pill">UTM</span>
      </Link>

      <nav aria-label="Main">
        {destinations.map((item) => {
          const Icon = item.icon;
          const active = destination === item.destination;
          return (
            <Link
              key={item.destination}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className="desktop-nav-link"
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="desktop-sidebar-foot">
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

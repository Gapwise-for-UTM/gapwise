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
import { useEffect, useState } from "react";
import type { AppDestination } from "@/features/navigation/use-app-navigation";

const CAMPUS_ARRIVAL_TRIGGER = '.desktop-app-header button[aria-label="Campus arrival settings"]';
const ACCOUNT_TRIGGER = '.desktop-app-header [role="group"][aria-label="Account"] button';
const THEME_TRIGGER = ".desktop-app-header .theme-toggle";

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

function campusArrivalTrigger() {
  return document.querySelector<HTMLButtonElement>(CAMPUS_ARRIVAL_TRIGGER);
}

function openCampusArrivalSettings() {
  campusArrivalTrigger()?.click();
}

function openAccountSettings() {
  const trigger = document.querySelector<HTMLButtonElement>(ACCOUNT_TRIGGER);
  if (!trigger) return;

  const signedOut = trigger.textContent?.trim() === "Sign in";
  trigger.click();
  if (signedOut) return;

  window.setTimeout(() => {
    const settingsItem = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      (item) => item.textContent?.includes("Account settings"),
    );
    settingsItem?.click();
  }, 0);
}

function toggleTheme() {
  document.querySelector<HTMLButtonElement>(THEME_TRIGGER)?.click();
}

/** Desktop-only primary navigation. Mobile retains the integrated bottom navigation. */
export function DesktopSidebar({ destination }: { destination: AppDestination }) {
  const [arrivalLabel, setArrivalLabel] = useState("Campus arrival");
  const [darkTheme, setDarkTheme] = useState(false);

  useEffect(() => {
    const trigger = campusArrivalTrigger();
    if (!trigger) return;

    const syncLabel = () => {
      const label = trigger.textContent?.trim();
      setArrivalLabel(label || "Campus arrival");
    };
    syncLabel();

    const observer = new MutationObserver(syncLabel);
    observer.observe(trigger, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setDarkTheme(root.classList.contains("dark"));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

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
          <span>{arrivalLabel}</span>
        </button>
        <div className="desktop-account-row">
          <button
            type="button"
            className="desktop-sidebar-utility desktop-account-settings"
            onClick={openAccountSettings}
          >
            <Settings aria-hidden="true" />
            <span>Account settings</span>
          </button>
          <button
            type="button"
            className="desktop-theme-toggle"
            onClick={toggleTheme}
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

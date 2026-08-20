import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { MobileTab } from "@/components/mobile/MobileShell";

export type AppDestination = "home" | MobileTab;

const DESTINATION_PATHS = {
  home: "/",
  today: "/today",
  timetable: "/timetable",
  gaps: "/gaps",
  route: "/route",
} as const satisfies Record<AppDestination, string>;

export function destinationFromPath(pathname: string): AppDestination {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (normalized === "/today") return "today";
  if (normalized === "/timetable") return "timetable";
  if (normalized === "/gaps") return "gaps";
  if (normalized === "/route") return "route";
  return "home";
}

/** Owns URL-backed app selection and lazy desktop view mounting, not domain schedule state. */
export function useAppNavigation(hasMeetings: boolean) {
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const destination = destinationFromPath(location.pathname);
  const selectedBuildingCode =
    destination === "route" && typeof location.search["building"] === "string"
      ? location.search["building"]
      : null;
  const [openedViews, setOpenedViews] = useState({ gaps: false, route: false });
  const allowInitialHomeRedirect = useRef(destination === "home");

  useEffect(() => {
    if (!allowInitialHomeRedirect.current) return;
    if (destination !== "home") {
      allowInitialHomeRedirect.current = false;
      return;
    }
    if (!hasMeetings) return;
    allowInitialHomeRedirect.current = false;
    void navigate({ to: "/timetable", replace: true });
  }, [destination, hasMeetings, navigate]);

  const showView = useCallback(
    (nextView: "timetable" | "gaps" | "route") => {
      if (nextView !== "timetable") {
        setOpenedViews((current) =>
          current[nextView] ? current : { ...current, [nextView]: true },
        );
      }
      void navigate({ to: DESTINATION_PATHS[nextView] });
    },
    [navigate],
  );

  useEffect(() => {
    if (destination !== "gaps" && destination !== "route") return;
    setOpenedViews((current) =>
      current[destination] ? current : { ...current, [destination]: true },
    );
  }, [destination]);

  const selectBuilding = useCallback(
    (code: string | null) => {
      if (code === null && selectedBuildingCode === null) return;
      void navigate({
        to: "/route",
        search: code ? { building: code } : {},
        replace: destination === "route",
        resetScroll: false,
      });
    },
    [destination, navigate, selectedBuildingCode],
  );

  return {
    destination,
    selectedBuildingCode,
    openedViews,
    mobileTab: destination === "home" ? ("today" as const) : destination,
    view: destination === "gaps" || destination === "route" ? destination : ("timetable" as const),
    navigateToday: () => void navigate({ to: "/today" }),
    showView,
    selectBuilding,
    openGapPlan: () => showView("gaps"),
    openDayRoute: () => showView("route"),
  };
}

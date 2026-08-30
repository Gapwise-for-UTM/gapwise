import { useEffect, useMemo, useState } from "react";
import type { GapPreferences } from "@/features/gaps/types";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term } from "@/lib/timetable-types";
import { buildTodayState, type TodayState } from "./today-state";

export type UseTodayStateArgs = {
  meetings: Meeting[];
  selectedTerm: Term;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
};

export function millisecondsUntilNextMinute(now = Date.now()): number {
  const remainder = now % 60_000;
  return remainder === 0 ? 60_000 : 60_000 - remainder;
}

/** Owns the ticking clock so every Today presentation shares one evaluation. */
export function useTodayState({
  meetings,
  selectedTerm,
  preferences,
  gapPreferences,
  planTransition,
}: UseTodayStateArgs): { now: Date; state: TodayState } {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    };

    const scheduleNextMinute = () => {
      clearTimer();
      if (document.visibilityState === "hidden") return;
      timer = window.setTimeout(() => {
        timer = null;
        setNow(new Date());
        scheduleNextMinute();
      }, millisecondsUntilNextMinute());
    };

    const refreshVisibleClock = () => {
      if (document.visibilityState === "hidden") {
        clearTimer();
        return;
      }
      setNow(new Date());
      scheduleNextMinute();
    };

    scheduleNextMinute();
    document.addEventListener("visibilitychange", refreshVisibleClock);
    window.addEventListener("focus", refreshVisibleClock);
    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", refreshVisibleClock);
      window.removeEventListener("focus", refreshVisibleClock);
    };
  }, []);

  const state = useMemo(
    () =>
      buildTodayState({ meetings, selectedTerm, preferences, gapPreferences, planTransition, now }),
    [gapPreferences, meetings, now, planTransition, preferences, selectedTerm],
  );

  return { now, state };
}

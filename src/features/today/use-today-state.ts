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
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const state = useMemo(
    () =>
      buildTodayState({ meetings, selectedTerm, preferences, gapPreferences, planTransition, now }),
    [gapPreferences, meetings, now, planTransition, preferences, selectedTerm],
  );

  return { now, state };
}

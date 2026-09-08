import { useLocation } from "@tanstack/react-router";
import { lazy, memo, Suspense } from "react";
import { GapDestinationChecker } from "@/components/GapDestinationChecker";
import type { GapPreferences } from "@/features/gaps/types";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import { useTodayState } from "@/features/today/use-today-state";
import type { Meeting, Term } from "@/lib/timetable-types";

const TodaySummaryImpl = lazy(() =>
  import("./TodaySummaryImpl").then((module) => ({ default: module.TodaySummary })),
);

export type TodaySummaryProps = {
  meetings: Meeting[];
  selectedTerm: Term;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
  onOpenGapPlan: () => void;
  onOpenDayRoute: () => void;
};

function TodayGapDestinationChecker({
  meetings,
  selectedTerm,
  preferences,
  gapPreferences,
  planTransition,
}: Pick<
  TodaySummaryProps,
  "meetings" | "selectedTerm" | "preferences" | "gapPreferences" | "planTransition"
>) {
  const location = useLocation();
  const { state } = useTodayState({
    meetings,
    selectedTerm,
    preferences,
    gapPreferences,
    planTransition,
  });

  if (location.pathname.replace(/\/$/, "") !== "/today" || state.kind !== "gap") return null;

  return (
    <GapDestinationChecker
      gap={state.gap}
      preferences={preferences}
      gapPreferences={gapPreferences}
      planTransition={planTransition}
      className="mt-4"
    />
  );
}

export const TodaySummary = memo(function TodaySummary(props: TodaySummaryProps) {
  return (
    <>
      <Suspense fallback={<div className="surface h-28" aria-hidden="true" />}>
        <TodaySummaryImpl {...props} />
      </Suspense>
      <TodayGapDestinationChecker {...props} />
    </>
  );
});

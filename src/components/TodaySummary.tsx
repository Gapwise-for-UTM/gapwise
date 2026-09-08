import { lazy, memo, Suspense } from "react";
import type { GapPreferences } from "@/features/gaps/types";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
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

export const TodaySummary = memo(function TodaySummary(props: TodaySummaryProps) {
  return (
    <Suspense fallback={<div className="surface h-28" aria-hidden="true" />}>
      <TodaySummaryImpl {...props} />
    </Suspense>
  );
});

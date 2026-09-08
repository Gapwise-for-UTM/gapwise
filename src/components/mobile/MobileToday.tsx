import { lazy, Suspense } from "react";
import type { GapPreferences } from "@/features/gaps/types";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import type { TodayState } from "@/features/today/today-state";
import type { Meeting, Term } from "@/lib/timetable-types";

const MobileTodayImpl = lazy(() =>
  import("./MobileTodayImpl").then((module) => ({ default: module.MobileToday })),
);

export type MobileTodayProps = {
  state: TodayState;
  now: Date;
  meetings: Meeting[];
  selectedTerm: Term;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
  meetingCount: number;
  gapCount: number;
  isDemo: boolean;
  onOpenGapPlan: () => void;
  onOpenDayRoute: () => void;
};

export function MobileToday(props: MobileTodayProps) {
  return (
    <Suspense fallback={<div className="surface h-28" aria-hidden="true" />}>
      <MobileTodayImpl {...props} />
    </Suspense>
  );
}

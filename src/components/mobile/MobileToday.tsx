import { lazy, Suspense } from "react";
import type { TodayState } from "@/features/today/today-state";
import type { Term } from "@/lib/timetable-types";

const MobileTodayImpl = lazy(() =>
  import("./MobileTodayImpl").then((module) => ({ default: module.MobileToday })),
);
const GapDestinationChecker = lazy(() =>
  import("../GapDestinationChecker").then((module) => ({
    default: module.GapDestinationChecker,
  })),
);

export type MobileTodayProps = {
  state: TodayState;
  now: Date;
  selectedTerm: Term;
  meetingCount: number;
  gapCount: number;
  isDemo: boolean;
  onOpenGapPlan: () => void;
  onOpenDayRoute: () => void;
};

export function MobileToday(props: MobileTodayProps) {
  return (
    <>
      <Suspense fallback={<div className="surface h-28" aria-hidden="true" />}>
        <MobileTodayImpl {...props} />
      </Suspense>
      {props.state.kind === "gap" ? (
        <Suspense fallback={<div className="surface mt-4 h-32" aria-hidden="true" />}>
          <GapDestinationChecker
            gap={props.state.gap}
            preferences={props.state.destinationContext.preferences}
            gapPreferences={props.state.destinationContext.gapPreferences}
            planTransition={props.state.destinationContext.planTransition}
            className="mt-4"
          />
        </Suspense>
      ) : null}
    </>
  );
}

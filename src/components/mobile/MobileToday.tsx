import { lazy, Suspense } from "react";
import type { TodayState } from "@/features/today/today-state";
import type { Term } from "@/lib/timetable-types";

const MobileTodayImpl = lazy(() =>
  import("./MobileTodayImpl").then((module) => ({ default: module.MobileToday })),
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
    <Suspense fallback={<div className="surface h-28" aria-hidden="true" />}>
      <MobileTodayImpl {...props} />
    </Suspense>
  );
}

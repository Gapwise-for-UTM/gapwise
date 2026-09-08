import { lazy, Suspense, type ReactNode } from "react";
import type { Gap, Meeting, Term } from "@/lib/timetable-types";

const MobileTimetableImpl = lazy(() =>
  import("./MobileTimetableImpl").then((module) => ({ default: module.MobileTimetable })),
);

export type MobileTimetableProps = {
  meetings: Meeting[];
  term: Term;
  terms: Term[];
  gaps: Gap[];
  onTermChange: (term: Term) => void;
  onOpenGapPlan: (gap: Gap) => void;
  onRouteToMeeting: (meeting: Meeting) => void;
  exportAction: ReactNode;
};

export function MobileTimetable(props: MobileTimetableProps) {
  return (
    <Suspense fallback={<div className="surface h-72" aria-hidden="true" />}>
      <MobileTimetableImpl key={props.term} {...props} />
    </Suspense>
  );
}

import { lazy, Suspense, useState, type ReactNode } from "react";
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
  const [termReset, setTermReset] = useState(0);
  const handleTermChange = (term: Term) => {
    if (term === props.term) setTermReset((reset) => reset + 1);
    props.onTermChange(term);
  };

  return (
    <Suspense fallback={<div className="surface h-72" aria-hidden="true" />}>
      <MobileTimetableImpl
        key={`${props.term}:${termReset}`}
        {...props}
        onTermChange={handleTermChange}
      />
    </Suspense>
  );
}

import { lazy, memo, Suspense, type ReactNode } from "react";
import type { ActivityType, Gap, Meeting } from "@/lib/timetable-types";

type TimetableActivityLabel = ActivityType | "RES";

export function ActivityBadge({ type }: { type: TimetableActivityLabel }) {
  return (
    <span
      data-activity={type}
      className="activity-badge rounded-md px-1.5 py-0.5 text-[0.68rem] font-bold tracking-[0.08em]"
    >
      {type}
    </span>
  );
}

const TimetableGridImpl = lazy(() =>
  import("./TimetableGridImpl").then((module) => ({ default: module.TimetableGrid })),
);

export const TimetableGrid = memo(function TimetableGrid({
  meetings,
  gaps,
  onRouteToMeeting,
  onOpenGap,
  headerAction,
}: {
  meetings: Meeting[];
  gaps: Gap[];
  onRouteToMeeting?: (meeting: Meeting) => void;
  onOpenGap?: (gap: Gap) => void;
  headerAction?: ReactNode;
}) {
  return (
    <Suspense fallback={<div className="surface h-72" aria-hidden="true" />}>
      <TimetableGridImpl
        meetings={meetings}
        gaps={gaps}
        {...(onRouteToMeeting ? { onRouteToMeeting } : {})}
        {...(onOpenGap ? { onOpenGap } : {})}
        {...(headerAction !== undefined ? { headerAction } : {})}
      />
    </Suspense>
  );
});

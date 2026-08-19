import { type Gap, type Meeting, type Term, WEEKDAYS } from "./timetable-types.js";
import type { RouteResult } from "../features/routing/types.js";

export const USABLE_BUFFER_MINUTES = 15;

export type GapTiming = {
  totalMinutes: number;
  travelSeconds: number | null;
  bufferMinutes: number;
  usableMinutes: number;
  leaveByMinutes: number;
  arrivalMinutes: number | null;
  fallback: boolean;
};

export function calculateLeaveBy(
  nextStartMinutes: number,
  routeSeconds: number,
  bufferMinutes: number,
): number {
  return Math.max(0, nextStartMinutes - Math.ceil(routeSeconds / 60) - bufferMinutes);
}

export function calculateGapTiming(
  gap: Pick<Gap, "durationMinutes" | "endTime">,
  route: Pick<RouteResult, "estimatedSeconds"> | null,
  transitionBufferMinutes: number,
): GapTiming {
  if (!route) {
    return {
      totalMinutes: gap.durationMinutes,
      travelSeconds: null,
      bufferMinutes: USABLE_BUFFER_MINUTES,
      usableMinutes: Math.max(0, gap.durationMinutes - USABLE_BUFFER_MINUTES),
      leaveByMinutes: Math.max(0, gap.endTime - USABLE_BUFFER_MINUTES),
      arrivalMinutes: null,
      fallback: true,
    };
  }
  const travelMinutes = Math.ceil(route.estimatedSeconds / 60);
  const leaveByMinutes = calculateLeaveBy(
    gap.endTime,
    route.estimatedSeconds,
    transitionBufferMinutes,
  );
  return {
    totalMinutes: gap.durationMinutes,
    travelSeconds: route.estimatedSeconds,
    bufferMinutes: transitionBufferMinutes,
    usableMinutes: Math.max(0, gap.durationMinutes - travelMinutes - transitionBufferMinutes),
    leaveByMinutes,
    arrivalMinutes: leaveByMinutes + travelMinutes,
    fallback: false,
  };
}

export function findGaps(meetings: Meeting[], term: Term): Gap[] {
  const gaps: Gap[] = [];
  for (const weekday of WEEKDAYS) {
    const day = meetings
      .filter((m) => m.term === term && m.weekday === weekday)
      .sort((a, b) => a.startTime - b.startTime || b.endTime - a.endTime);

    let previous = day[0];
    for (let i = 1; previous && i < day.length; i += 1) {
      const next = day[i]!;
      if (next.startTime <= previous.endTime) {
        if (next.endTime > previous.endTime) previous = next;
        continue;
      }
      const durationMinutes = next.startTime - previous.endTime;
      if (durationMinutes < 5) {
        previous = next;
        continue;
      }
      gaps.push({
        id: `${term}-${weekday}-${previous.id}-${next.id}`,
        term,
        weekday,
        startTime: previous.endTime,
        endTime: next.startTime,
        durationMinutes,
        previous,
        next,
      });
      previous = next;
    }
  }
  return gaps;
}

export function groupGapsByDay(gaps: Gap[]) {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    gaps: gaps.filter((g) => g.weekday === weekday),
  })).filter((group) => group.gaps.length > 0);
}

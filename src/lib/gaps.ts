import { type Gap, type GapKind, type Meeting, type Term, WEEKDAYS } from "./timetable-types";
import type { RouteResult } from "@/features/routing/types";

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
  route: RouteResult | null,
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

export function classifyGap(minutes: number): GapKind {
  if (minutes < 30) return "Transition only";
  if (minutes < 60) return "Short break";
  if (minutes < 120) return "Useful study gap";
  return "Long campus gap";
}

export function findGaps(meetings: Meeting[], term: Term): Gap[] {
  const gaps: Gap[] = [];
  for (const weekday of WEEKDAYS) {
    const day = meetings
      .filter((m) => m.term === term && m.weekday === weekday)
      .sort((a, b) => a.startTime - b.startTime);

    for (let i = 0; i < day.length - 1; i += 1) {
      const previous = day[i]!;
      const next = day[i + 1]!;
      // skip overlapping / nested meetings
      if (next.startTime <= previous.endTime) continue;
      const durationMinutes = next.startTime - previous.endTime;
      if (durationMinutes < 5) continue;
      gaps.push({
        id: `${term}-${weekday}-${previous.id}-${next.id}`,
        term,
        weekday,
        startTime: previous.endTime,
        endTime: next.startTime,
        durationMinutes,
        usableMinutes: Math.max(0, durationMinutes - USABLE_BUFFER_MINUTES),
        kind: classifyGap(durationMinutes),
        previous,
        next,
      });
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

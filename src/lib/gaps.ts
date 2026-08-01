import {
  type Gap,
  type GapKind,
  type Meeting,
  type Term,
  WEEKDAYS,
} from "./timetable-types";

export const USABLE_BUFFER_MINUTES = 15;

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
      let next = day[i + 1]!;
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

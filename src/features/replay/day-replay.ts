import type { TransitionPlanner } from "@/features/routing/transition";
import type { TransitionRoute } from "@/features/routing/types";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Gap, Meeting, Term, Weekday } from "@/lib/timetable-types";

export type DayReplayPhase = "before" | "class" | "gap" | "after";

export type DayReplaySegment = {
  id: string;
  from: Meeting;
  to: Meeting;
  route: TransitionRoute;
};

export type DayReplaySnapshot = {
  minute: number;
  phase: DayReplayPhase;
  current: Meeting | null;
  previous: Meeting | null;
  next: Meeting | null;
  gap: Gap | null;
  selectedMeetingId: string | null;
  selectedSegmentId: string | null;
  visibleSegmentIds: string[];
};

export function dayReplayMeetings(
  meetings: readonly Meeting[],
  term: Term,
  weekday: Weekday,
): Meeting[] {
  return meetings
    .filter((meeting) => meeting.term === term && meeting.weekday === weekday)
    .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id));
}

export function buildDayReplaySegments(
  meetings: readonly Meeting[],
  preferences: UserPreferences,
  planTransition: TransitionPlanner,
): DayReplaySegment[] {
  return meetings.slice(0, -1).flatMap((from, index) => {
    const to = meetings[index + 1]!;
    if (to.startTime < from.endTime) return [];
    return [
      {
        id: `${from.id}--${to.id}`,
        from,
        to,
        route: planTransition(from, to, preferences),
      },
    ];
  });
}

export function dayReplayBounds(meetings: readonly Meeting[]) {
  const first = meetings[0];
  const last = meetings[meetings.length - 1];
  if (!first || !last) return null;
  return {
    startMinute: Math.max(0, first.startTime - 30),
    endMinute: Math.min(1440, last.endTime + 30),
  };
}

export function buildDayReplaySnapshot(
  meetings: readonly Meeting[],
  segments: readonly DayReplaySegment[],
  minute: number,
): DayReplaySnapshot {
  const current =
    meetings.find((meeting) => meeting.startTime <= minute && meeting.endTime > minute) ?? null;
  const previous = [...meetings].reverse().find((meeting) => meeting.endTime <= minute) ?? null;
  const next = meetings.find((meeting) => meeting.startTime > minute) ?? null;

  let phase: DayReplayPhase;
  if (current) phase = "class";
  else if (!previous) phase = "before";
  else if (!next) phase = "after";
  else phase = "gap";

  const gap =
    phase === "gap" && previous && next && next.startTime > previous.endTime
      ? {
          id: `replay-${previous.id}-${next.id}`,
          term: previous.term,
          weekday: previous.weekday,
          startTime: previous.endTime,
          endTime: next.startTime,
          durationMinutes: next.startTime - previous.endTime,
          previous,
          next,
        }
      : null;

  const selectedSegmentId = gap ? `${gap.previous.id}--${gap.next.id}` : null;
  const visibleSegmentIds = segments
    .filter((segment) => segment.from.endTime <= minute)
    .map((segment) => segment.id);

  return {
    minute,
    phase,
    current,
    previous,
    next,
    gap,
    selectedMeetingId: current?.id ?? null,
    selectedSegmentId,
    visibleSegmentIds,
  };
}

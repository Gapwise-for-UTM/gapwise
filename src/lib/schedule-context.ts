import type { Gap, Meeting, Term, Weekday } from "./timetable-types";

export type SchedulePosition = {
  phase: "before" | "commitment" | "gap" | "after";
  currentCommitment: Meeting | null;
  previousCommitment: Meeting | null;
  nextCommitment: Meeting | null;
  currentGap: Gap | null;
  remainingCommitments: Meeting[];
};

export function orderSchedule(meetings: readonly Meeting[]): Meeting[] {
  return [...meetings].sort(
    (a, b) => a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id),
  );
}

export function scheduleForWeekday(
  meetings: readonly Meeting[],
  term: Term,
  weekday: Weekday,
): Meeting[] {
  return orderSchedule(
    meetings.filter((meeting) => meeting.term === term && meeting.weekday === weekday),
  );
}

export function gapBetween(previous: Meeting, next: Meeting): Gap | null {
  if (previous.term !== next.term || previous.weekday !== next.weekday) return null;
  if (next.startTime <= previous.endTime) return null;
  return {
    id: `${previous.term}-${previous.weekday}-${previous.id}-${next.id}`,
    term: previous.term,
    weekday: previous.weekday,
    startTime: previous.endTime,
    endTime: next.startTime,
    durationMinutes: next.startTime - previous.endTime,
    previous,
    next,
  };
}

/** Canonical fixed-schedule answer at a minute boundary; end times are exclusive. */
export function querySchedulePosition(
  meetings: readonly Meeting[],
  minute: number,
): SchedulePosition {
  const ordered = orderSchedule(meetings);
  const currentCommitment =
    ordered.find((meeting) => meeting.startTime <= minute && meeting.endTime > minute) ?? null;
  const previousCommitment =
    ordered
      .filter((meeting) => meeting.endTime <= minute)
      .sort(
        (a, b) => b.endTime - a.endTime || b.startTime - a.startTime || a.id.localeCompare(b.id),
      )[0] ?? null;
  const nextCommitment = ordered.find((meeting) => meeting.startTime > minute) ?? null;
  const currentGap =
    !currentCommitment && previousCommitment && nextCommitment
      ? gapBetween(previousCommitment, nextCommitment)
      : null;
  const phase = currentCommitment
    ? "commitment"
    : currentGap
      ? "gap"
      : previousCommitment
        ? "after"
        : "before";

  return {
    phase,
    currentCommitment,
    previousCommitment,
    nextCommitment,
    currentGap,
    remainingCommitments: ordered.filter((meeting) => meeting.endTime > minute),
  };
}

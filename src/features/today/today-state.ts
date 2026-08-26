import { planGapAssessment } from "@/features/gaps/assess-gap";
import type { GapAssessment, GapPreferences } from "@/features/gaps/types";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { TransitionRoute } from "@/features/routing/types";
import type { UserPreferences } from "@/features/sync/preferences";
import {
  calendarDateKey,
  firstOccurrence,
  meetingOccursOnDate,
  nextOccurrence,
  termStatus,
} from "@/lib/calendar-awareness";
import { calculateLeaveBy } from "@/lib/gaps";
import { querySchedulePosition } from "@/lib/schedule-context";
import type { Gap, Meeting, Term } from "@/lib/timetable-types";
import { formatTime, termForMonth } from "@/lib/timetable-types";

export type TodayOccurrence = { date: Date; meeting: Meeting };

export type ResidenceTrip = {
  buildingName: string;
  outbound: TransitionRoute;
  inbound: TransitionRoute;
};

export type GapDestinationContext = {
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
};

export type PlannedWorkContext = {
  current: Meeting | null;
  next: Meeting | null;
};

export type TodayState = (
  | { kind: "before"; first: TodayOccurrence }
  | { kind: "ended"; next: TodayOccurrence | null }
  | { kind: "dates-unavailable" }
  | { kind: "before-first"; next: Meeting }
  | {
      kind: "in-class";
      current: Meeting;
      next: Meeting | null;
      route?: TransitionRoute | undefined;
      leaveBy?: number | null | undefined;
    }
  | {
      kind: "gap";
      gap: Gap;
      assessment: GapAssessment;
      route: TransitionRoute;
      residenceTrip?: ResidenceTrip | undefined;
      destinationContext: GapDestinationContext;
    }
  | { kind: "done"; next: TodayOccurrence | null }
  | { kind: "no-classes"; next: TodayOccurrence | null }
) & { plannedWork: PlannedWorkContext };

export type TodayStateInput = {
  meetings: Meeting[];
  selectedTerm: Term;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
  now: Date;
};

export function minutesNow(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatOccurrenceDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function occurrenceLead(date: Date, meeting: Meeting, now: Date) {
  const location = getLocationPresentation({ meeting }).label;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (calendarDateKey(date) === calendarDateKey(tomorrow)) {
    return `Tomorrow starts at ${formatTime(meeting.startTime)} in ${location}`;
  }
  return `Next class: ${meeting.courseCode} · ${formatOccurrenceDate(date)} · ${formatTime(
    meeting.startTime,
  )} · ${location}`;
}

export function routeMinutes(route: TransitionRoute) {
  const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
  return seconds === null ? null : Math.ceil(seconds / 60);
}

export function routeCopy(from: Meeting, to: Meeting, route: TransitionRoute) {
  const presentation = getLocationPresentation({ from, to, route });
  const minutes = routeMinutes(route);
  if (minutes === null || route.status === "same-room") return presentation.label;
  return `~${minutes} min walk${route.status === "approximate" ? ` · ${presentation.label}` : ""}`;
}

/**
 * Single source of truth for the "Today" state machine. Desktop and mobile
 * presentations both consume this so they cannot disagree.
 */
export function buildTodayState({
  meetings,
  selectedTerm,
  preferences,
  gapPreferences,
  planTransition,
  now,
}: TodayStateInput): TodayState {
  const selectedMeetings = meetings.filter(
    (meeting) => meeting.term === selectedTerm && meeting.sectionCode !== "STUDY",
  );
  const status = termStatus(selectedMeetings, selectedTerm, now);
  const minute = minutesNow(now);
  const planned = meetings
    .filter(
      (meeting) =>
        meeting.term === selectedTerm &&
        meeting.sectionCode === "STUDY" &&
        meeting.notes?.endsWith(" accepted") === true &&
        meetingOccursOnDate(meeting, now) &&
        meeting.endTime > minute,
    )
    .sort((a, b) => a.startTime - b.startTime);
  const plannedWork: PlannedWorkContext = {
    current: planned.find((meeting) => meeting.startTime <= minute) ?? null,
    next: planned.find((meeting) => meeting.startTime > minute) ?? null,
  };
  const result = (value: object): TodayState => ({ ...value, plannedWork }) as TodayState;
  const first = firstOccurrence(selectedMeetings);
  if (status === "before" && first) return result({ kind: "before", first });
  if (status === "ended") {
    return result({ kind: "ended", next: nextOccurrence(selectedMeetings, now) });
  }
  if (status === "unknown" && termForMonth(now.getMonth() + 1) !== selectedTerm) {
    return result({ kind: "dates-unavailable" });
  }

  const day = selectedMeetings
    .filter((meeting) => meetingOccursOnDate(meeting, now))
    .sort((a, b) => a.startTime - b.startTime);
  const {
    currentCommitment: current,
    nextCommitment: next,
    currentGap,
  } = querySchedulePosition(day, minute);

  if (current) {
    if (!next) return result({ kind: "in-class", current, next: null });
    const route = planTransition(current, next, preferences);
    const travel = routeMinutes(route);
    const leaveBy =
      travel === null
        ? null
        : calculateLeaveBy(next.startTime, travel * 60, preferences.transitionBufferMinutes);
    return result({ kind: "in-class", current, next, route, leaveBy });
  }

  if (currentGap) {
    const plan = planGapAssessment(currentGap, preferences, gapPreferences, planTransition);
    return result({
      kind: "gap",
      gap: currentGap,
      ...plan,
      destinationContext: { preferences, gapPreferences, planTransition },
    });
  }

  if (next) return result({ kind: "before-first", next });
  return result({
    kind: day.length > 0 ? "done" : "no-classes",
    next: nextOccurrence(selectedMeetings, now),
  });
}

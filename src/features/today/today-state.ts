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
import type { Gap, Meeting, Term } from "@/lib/timetable-types";
import { formatTime, termForMonth, WEEKDAYS } from "@/lib/timetable-types";

export type TodayOccurrence = { date: Date; meeting: Meeting };

export type ResidenceTrip = {
  buildingName: string;
  outbound: TransitionRoute;
  inbound: TransitionRoute;
};

export type TodayState =
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
    }
  | { kind: "done"; next: TodayOccurrence | null }
  | { kind: "no-classes"; next: TodayOccurrence | null };

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
  const selectedMeetings = meetings.filter((meeting) => meeting.term === selectedTerm);
  const status = termStatus(meetings, selectedTerm, now);
  const first = firstOccurrence(selectedMeetings);
  if (status === "before" && first) return { kind: "before", first };
  if (status === "ended") {
    return { kind: "ended", next: nextOccurrence(meetings, now) };
  }
  if (status === "unknown" && termForMonth(now.getMonth() + 1) !== selectedTerm) {
    return { kind: "dates-unavailable" };
  }

  const weekday = WEEKDAYS[now.getDay() - 1] ?? null;
  const day = weekday
    ? selectedMeetings
        .filter((meeting) => meetingOccursOnDate(meeting, now))
        .sort((a, b) => a.startTime - b.startTime)
    : [];
  const minute = minutesNow(now);
  const current = day.find((meeting) => meeting.startTime <= minute && meeting.endTime > minute);
  const previous = [...day].reverse().find((meeting) => meeting.endTime <= minute) ?? null;
  const next = day.find((meeting) => meeting.startTime > minute) ?? null;

  if (current) {
    if (!next) return { kind: "in-class", current, next: null };
    const route = planTransition(current, next, preferences);
    const travel = routeMinutes(route);
    const leaveBy =
      travel === null
        ? null
        : calculateLeaveBy(next.startTime, travel * 60, preferences.transitionBufferMinutes);
    return { kind: "in-class", current, next, route, leaveBy };
  }

  if (previous && next) {
    const gap: Gap = {
      id: `${selectedTerm}-${weekday}-${previous.id}-${next.id}`,
      term: selectedTerm,
      weekday: weekday!,
      startTime: previous.endTime,
      endTime: next.startTime,
      durationMinutes: next.startTime - previous.endTime,
      previous,
      next,
    };
    const plan = planGapAssessment(gap, preferences, gapPreferences, planTransition);
    return { kind: "gap", gap, ...plan };
  }

  if (next) return { kind: "before-first", next };
  return {
    kind: day.length > 0 ? "done" : "no-classes",
    next: nextOccurrence(selectedMeetings, now),
  };
}

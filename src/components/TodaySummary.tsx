import {
  ArrowRight,
  CalendarClock,
  Home,
  Navigation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { planGapAssessment } from "@/features/gaps/assess-gap";
import type { GapPreferences } from "@/features/gaps/types";
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
import { formatCompactDuration, formatTime, termForMonth, WEEKDAYS } from "@/lib/timetable-types";

function minutesNow(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatOccurrenceDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function occurrenceLead(date: Date, meeting: Meeting, now: Date) {
  const location = getLocationPresentation({ meeting }).label;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (calendarDateKey(date) === calendarDateKey(tomorrow)) {
    return `Tomorrow starts at ${formatTime(meeting.startTime)} in ${location}`;
  }
  return `Next class: ${meeting.courseCode} · ${formatOccurrenceDate(date)} · ${formatTime(
    meeting.startTime,
  )} · ${location}`;
}

function routeMinutes(route: TransitionRoute) {
  const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
  return seconds === null ? null : Math.ceil(seconds / 60);
}

function routeCopy(from: Meeting, to: Meeting, route: TransitionRoute) {
  const presentation = getLocationPresentation({ from, to, route });
  const minutes = routeMinutes(route);
  if (minutes === null || route.status === "same-room") return presentation.label;
  return `~${minutes} min walk${route.status === "approximate" ? ` · ${presentation.label}` : ""}`;
}

export const TodaySummary = memo(function TodaySummary({
  meetings,
  selectedTerm,
  preferences,
  gapPreferences,
  planTransition,
  onOpenGapPlan,
  onOpenDayRoute,
}: {
  meetings: Meeting[];
  selectedTerm: Term;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
  onOpenGapPlan: () => void;
  onOpenDayRoute: () => void;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const selectedMeetings = meetings.filter((meeting) => meeting.term === selectedTerm);
    const status = termStatus(meetings, selectedTerm, now);
    const first = firstOccurrence(selectedMeetings);
    if (status === "before" && first) return { kind: "before" as const, first };
    if (status === "ended") {
      return { kind: "ended" as const, next: nextOccurrence(meetings, now) };
    }
    if (status === "unknown" && termForMonth(now.getMonth() + 1) !== selectedTerm) {
      return { kind: "dates-unavailable" as const };
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
      if (!next) return { kind: "in-class" as const, current, next: null };
      const route = planTransition(current, next, preferences);
      const travel = routeMinutes(route);
      const leaveBy =
        travel === null
          ? null
          : calculateLeaveBy(next.startTime, travel * 60, preferences.transitionBufferMinutes);
      return { kind: "in-class" as const, current, next, route, leaveBy };
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
      return { kind: "gap" as const, gap, ...plan };
    }

    if (next) return { kind: "before-first" as const, next };
    return {
      kind: day.length > 0 ? ("done" as const) : ("no-classes" as const),
      next: nextOccurrence(selectedMeetings, now),
    };
  }, [gapPreferences, meetings, now, planTransition, preferences, selectedTerm]);

  let title: string;
  let detail: string | null = null;
  let secondary: string | null = null;
  let SecondaryIcon: LucideIcon = Navigation;
  let heading = `Today · ${WEEKDAYS[now.getDay() - 1] ?? "Weekend"}`;

  switch (summary.kind) {
    case "before":
      heading = `${selectedTerm} classes haven't started yet`;
      title = `First class: ${summary.first.meeting.courseCode}`;
      detail = `${formatOccurrenceDate(summary.first.date)} · ${formatTime(
        summary.first.meeting.startTime,
      )} · ${getLocationPresentation({ meeting: summary.first.meeting }).label}`;
      break;
    case "ended":
      heading = `${selectedTerm} classes have finished`;
      title = summary.next
        ? `${summary.next.meeting.term} is next`
        : "Your imported timetable has no later classes";
      detail = summary.next
        ? occurrenceLead(summary.next.date, summary.next.meeting, now)
        : "Upload a new ACORN calendar when your next timetable is ready.";
      break;
    case "dates-unavailable":
      heading = `${selectedTerm} timetable`;
      title = "Term dates aren't available";
      detail = "Re-import the ACORN calendar to add real recurrence dates.";
      break;
    case "before-first": {
      const startsIn = Math.max(0, summary.next.startTime - minutesNow(now));
      title = `Next: ${summary.next.courseCode} at ${formatTime(summary.next.startTime)}`;
      detail = `${getLocationPresentation({ meeting: summary.next }).label} · starts in ${formatCompactDuration(startsIn)}`;
      break;
    }
    case "in-class": {
      title = `Now: ${summary.current.courseCode}`;
      detail = `${getLocationPresentation({ meeting: summary.current }).label} · until ${formatTime(summary.current.endTime)}`;
      if (summary.next) {
        const presentation = getLocationPresentation({
          from: summary.current,
          to: summary.next,
          route: summary.route,
        });
        SecondaryIcon = presentation.icon;
        secondary = `Next: ${summary.next.courseCode} at ${formatTime(summary.next.startTime)} · ${routeCopy(
          summary.current,
          summary.next,
          summary.route,
        )}${summary.leaveBy === null ? "" : ` · leave by ${formatTime(summary.leaveBy)}`}`;
      }
      break;
    }
    case "gap": {
      title = summary.assessment.primary.title;
      detail = `${formatCompactDuration(
        summary.assessment.primary.activityMinutes,
      )} usable · Next: ${summary.gap.next.courseCode} · ${getLocationPresentation({ meeting: summary.gap.next }).label} at ${formatTime(summary.gap.next.startTime)}`;
      const outbound = summary.residenceTrip ? routeMinutes(summary.residenceTrip.outbound) : null;
      const inbound = summary.residenceTrip ? routeMinutes(summary.residenceTrip.inbound) : null;
      if (
        summary.assessment.primary.action === "go-home" &&
        summary.residenceTrip &&
        outbound !== null &&
        inbound !== null
      ) {
        SecondaryIcon = Home;
        secondary = `~${outbound + inbound} min campus round trip · leave home by ${formatTime(
          summary.gap.next.startTime - inbound - summary.assessment.bufferMinutes,
        )}`;
      } else {
        const presentation = getLocationPresentation({
          from: summary.gap.previous,
          to: summary.gap.next,
          route: summary.route,
        });
        SecondaryIcon = presentation.icon;
        secondary = `${routeCopy(summary.gap.previous, summary.gap.next, summary.route)} · leave by ${formatTime(
          summary.assessment.leaveByMinutes,
        )}`;
      }
      break;
    }
    case "done":
      title = "Done for today";
      detail = summary.next
        ? occurrenceLead(summary.next.date, summary.next.meeting, now)
        : "No more classes are scheduled in this term.";
      break;
    case "no-classes":
      title = "No classes today";
      detail = summary.next
        ? occurrenceLead(summary.next.date, summary.next.meeting, now)
        : "No later classes are scheduled in this term.";
      break;
  }

  const canPlanGap = summary.kind === "gap";
  const canOpenRoute =
    summary.kind === "gap" || summary.kind === "before-first" || summary.kind === "in-class";

  return (
    <section className="surface mb-6 mt-6 overflow-hidden p-5 sm:p-6" aria-labelledby="today-title">
      <h2
        id="today-title"
        className="flex items-center gap-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
        {heading}
      </h2>
      <p className="mt-4 font-display text-xl font-medium tracking-tight">{title}</p>
      {detail ? <p className="mt-1.5 text-sm text-muted-foreground">{detail}</p> : null}
      {secondary ? (
        <p className="mt-3 flex items-start gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
          <SecondaryIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          {secondary}
        </p>
      ) : null}
      {canPlanGap || canOpenRoute ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canPlanGap ? (
            <button
              type="button"
              onClick={onOpenGapPlan}
              className="button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Plan this gap
            </button>
          ) : null}
          {canOpenRoute ? (
            <button
              type="button"
              onClick={onOpenDayRoute}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${
                canPlanGap ? "button-secondary" : "button-primary"
              }`}
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              View day route
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
});

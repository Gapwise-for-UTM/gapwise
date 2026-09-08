import { useLocation } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Home,
  MapPin,
  Navigation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useMobileRouteTarget } from "@/components/mobile/MobileShell";
import { planGapAssessment } from "@/features/gaps/assess-gap";
import type { GapPreferences } from "@/features/gaps/types";
import { useFirstValueArrival } from "@/features/onboarding/first-value";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import {
  formatOccurrenceDate,
  minutesNow,
  occurrenceLead,
  routeCopy,
  routeMinutes,
  type TodayState,
} from "@/features/today/today-state";
import { meetingOccursOnDate } from "@/lib/calendar-awareness";
import { findGaps } from "@/lib/gaps";
import type { Gap, Meeting, Term } from "@/lib/timetable-types";
import { formatCompactDuration, formatTime, weekdayForDate } from "@/lib/timetable-types";

type Row = { icon: LucideIcon; text: string };

type Presentation = {
  eyebrow: string;
  title: string;
  detail: string | null;
  rows: Row[];
};

function present(state: TodayState, now: Date, selectedTerm: string): Presentation {
  const weekdayLabel = weekdayForDate(now);
  switch (state.kind) {
    case "before":
      return {
        eyebrow: `${selectedTerm} hasn't started`,
        title: `First class: ${state.first.meeting.courseCode}`,
        detail: `${formatOccurrenceDate(state.first.date)} · ${formatTime(state.first.meeting.startTime)}`,
        rows: [
          { icon: MapPin, text: getLocationPresentation({ meeting: state.first.meeting }).label },
        ],
      };
    case "ended":
      return {
        eyebrow: `${selectedTerm} has finished`,
        title: state.next ? `${state.next.meeting.term} is next` : "No later classes in this timetable",
        detail: state.next
          ? occurrenceLead(state.next.date, state.next.meeting, now)
          : "Upload a new ACORN calendar when your next timetable is ready.",
        rows: [],
      };
    case "dates-unavailable":
      return {
        eyebrow: `${selectedTerm} timetable`,
        title: "Term dates aren't available",
        detail: "Re-import the ACORN calendar to add real recurrence dates.",
        rows: [],
      };
    case "before-first": {
      const startsIn = Math.max(0, state.next.startTime - minutesNow(now));
      return {
        eyebrow: `Today · ${weekdayLabel}`,
        title: `Next: ${state.next.courseCode}`,
        detail: `${formatTime(state.next.startTime)} · starts in ${formatCompactDuration(startsIn)}`,
        rows: [{ icon: MapPin, text: getLocationPresentation({ meeting: state.next }).label }],
      };
    }
    case "in-class": {
      const rows: Row[] = [
        {
          icon: MapPin,
          text: `${getLocationPresentation({ meeting: state.current }).label} · until ${formatTime(state.current.endTime)}`,
        },
      ];
      if (state.next && state.route) {
        const presentation = getLocationPresentation({
          from: state.current,
          to: state.next,
          route: state.route,
        });
        rows.push({
          icon: presentation.icon,
          text: `Next: ${state.next.courseCode} at ${formatTime(state.next.startTime)} · ${routeCopy(state.current, state.next, state.route)}`,
        });
      }
      return {
        eyebrow: `Today · ${weekdayLabel}`,
        title: `Now: ${state.current.courseCode}`,
        detail: state.current.courseName || null,
        rows,
      };
    }
    case "gap": {
      const rows: Row[] = [
        {
          icon: MapPin,
          text: `Next: ${state.gap.next.courseCode} · ${getLocationPresentation({ meeting: state.gap.next }).label} at ${formatTime(state.gap.next.startTime)}`,
        },
      ];
      const outbound = state.residenceTrip ? routeMinutes(state.residenceTrip.outbound) : null;
      const inbound = state.residenceTrip ? routeMinutes(state.residenceTrip.inbound) : null;
      if (
        state.assessment.primary.action === "go-home" &&
        state.residenceTrip &&
        outbound !== null &&
        inbound !== null
      ) {
        rows.push({
          icon: Home,
          text: `~${outbound + inbound} min round trip · leave home by ${formatTime(
            state.gap.next.startTime - inbound - state.assessment.bufferMinutes,
          )}`,
        });
      } else {
        const presentation = getLocationPresentation({
          from: state.gap.previous,
          to: state.gap.next,
          route: state.route,
        });
        rows.push({
          icon: presentation.icon,
          text: `${routeCopy(state.gap.previous, state.gap.next, state.route)} · leave by ${formatTime(
            state.assessment.leaveByMinutes,
          )}`,
        });
      }
      return {
        eyebrow: `Today · ${weekdayLabel}`,
        title: state.assessment.primary.title,
        detail: `${formatCompactDuration(state.assessment.primary.activityMinutes)} usable`,
        rows,
      };
    }
    case "done":
      return {
        eyebrow: `Today · ${weekdayLabel}`,
        title: "Done for today",
        detail: state.next
          ? occurrenceLead(state.next.date, state.next.meeting, now)
          : "No more classes are scheduled in this term.",
        rows: [],
      };
    case "no-classes":
      return {
        eyebrow: `Today · ${weekdayLabel}`,
        title: "No classes today",
        detail: state.next
          ? occurrenceLead(state.next.date, state.next.meeting, now)
          : "No later classes are scheduled in this term.",
        rows: [],
      };
  }
}

function AgendaItem({
  meeting,
  active,
  passed,
}: {
  meeting: Meeting;
  active: boolean;
  passed: boolean;
}) {
  const location = getLocationPresentation({ meeting });
  const label =
    meeting.sectionCode === "STUDY"
      ? "Study"
      : meeting.sectionCode === "PERSONAL"
        ? "Personal"
        : meeting.activityType === "OTHER"
          ? "Class"
          : meeting.activityType;
  return (
    <div className={`mobile-day-row ${active ? "mobile-day-row-active" : ""}`}>
      <div className="mobile-day-time">
        <strong>{formatTime(meeting.startTime)}</strong>
        <span>{formatTime(meeting.endTime)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold">{meeting.courseCode}</p>
          <span className="mobile-mini-badge">{label}</span>
          {active ? <span className="mobile-now-badge">Now</span> : passed ? <span className="mobile-done-label">Done</span> : null}
        </div>
        {meeting.courseName ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{meeting.courseName}</p>
        ) : null}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{location.label}</span>
        </p>
      </div>
    </div>
  );
}

function GapRow({
  gap,
  preferences,
  gapPreferences,
  planTransition,
  onOpen,
}: {
  gap: Gap;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
  onOpen: () => void;
}) {
  const result = planGapAssessment(gap, preferences, gapPreferences, planTransition);
  return (
    <button type="button" onClick={onOpen} className="mobile-day-gap-row">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/8 text-accent">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-xs font-semibold">
          {formatCompactDuration(gap.durationMinutes)} gap · {result.assessment.primary.title}
        </span>
        <span className="mt-0.5 block text-[0.7rem] text-muted-foreground">
          {formatCompactDuration(result.assessment.primary.activityMinutes)} usable · leave by {formatTime(result.assessment.leaveByMinutes)}
        </span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

export function MobileToday({
  state,
  now,
  meetings,
  selectedTerm,
  preferences,
  gapPreferences,
  planTransition,
  meetingCount,
  gapCount,
  isDemo,
  onOpenGapPlan,
  onOpenDayRoute,
}: {
  state: TodayState;
  now: Date;
  meetings: Meeting[];
  selectedTerm: Term;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
  meetingCount: number;
  gapCount: number;
  isDemo: boolean;
  onOpenGapPlan: () => void;
  onOpenDayRoute: () => void;
}) {
  const location = useLocation();
  const firstValue = useFirstValueArrival(location.pathname.replace(/\/$/, "") === "/today");
  const { setRouteTargetId } = useMobileRouteTarget();
  const { eyebrow, title, detail, rows } = present(state, now, selectedTerm);
  const nowMinutes = minutesNow(now);
  const todayMeetings = useMemo(
    () =>
      meetings
        .filter((meeting) => meeting.term === selectedTerm && meetingOccursOnDate(meeting, now))
        .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime),
    [meetings, now, selectedTerm],
  );
  const todayGaps = useMemo(() => findGaps(todayMeetings, selectedTerm), [selectedTerm, todayMeetings]);
  const gapByPreviousId = useMemo(
    () => new Map(todayGaps.map((gap) => [gap.previous.id, gap])),
    [todayGaps],
  );
  const classCount = todayMeetings.filter(
    (meeting) => meeting.sectionCode !== "STUDY" && meeting.sectionCode !== "PERSONAL",
  ).length;
  const plannedCount = todayMeetings.length - classCount;
  const firstStart = todayMeetings[0]?.startTime ?? null;
  const lastEnd = todayMeetings.at(-1)?.endTime ?? null;
  const scheduledMinutes = todayMeetings.reduce(
    (sum, meeting) => sum + Math.max(0, meeting.endTime - meeting.startTime),
    0,
  );
  const openMinutes =
    firstStart !== null && lastEnd !== null
      ? Math.max(0, lastEnd - firstStart - scheduledMinutes)
      : 0;
  const plannedWork = state.plannedWork.current ?? state.plannedWork.next;
  const canOpenRoute =
    state.kind === "gap" || state.kind === "before-first" || state.kind === "in-class";
  const routeTargetId =
    state.kind === "gap"
      ? state.gap.next.id
      : state.kind === "before-first"
        ? state.next.id
        : state.kind === "in-class"
          ? (state.next?.id ?? state.current.id)
          : null;

  return (
    <div className="rise-in mobile-page-stack">
      {firstValue.showSuccess ? (
        <p role="status" aria-live="polite" className="mobile-inline-status">
          Schedule ready — {meetingCount} {meetingCount === 1 ? "class" : "classes"} imported.
        </p>
      ) : null}

      <section className={`mobile-primary-card ${firstValue.emphasize ? "first-value-emphasis" : ""}`}>
        <p className="mobile-kicker">
          <CalendarClock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="mt-3 text-balance font-display text-[1.7rem] font-medium leading-[1.05] tracking-[-0.04em]">
          {title}
        </h1>
        {detail ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p> : null}

        {rows.length > 0 ? (
          <ul className="mt-4 space-y-2.5 border-t border-border pt-4">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <li key={row.text} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0">{row.text}</span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {plannedWork ? (
          <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              {state.plannedWork.current ? "Planned now" : "Planned next"}
            </p>
            <p className="mt-1.5 text-sm font-medium">
              {plannedWork.courseCode} · {plannedWork.courseName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatTime(plannedWork.startTime)}–{formatTime(plannedWork.endTime)}
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          {state.kind === "gap" ? (
            <button
              type="button"
              onClick={() => {
                firstValue.acknowledge();
                onOpenGapPlan();
              }}
              className="button-primary inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Plan gap
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              firstValue.acknowledge();
              setRouteTargetId(routeTargetId);
              onOpenDayRoute();
            }}
            disabled={!canOpenRoute && todayMeetings.length === 0}
            className={`${state.kind === "gap" ? "button-secondary" : "button-primary col-span-2"} inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold disabled:opacity-45`}
          >
            <Navigation className="h-4 w-4" aria-hidden="true" />
            Day route
          </button>
        </div>
      </section>

      <section className="mobile-stats-card">
        <div>
          <span>Classes</span>
          <strong>{classCount}</strong>
        </div>
        <div>
          <span>Planned</span>
          <strong>{plannedCount}</strong>
        </div>
        <div>
          <span>Gaps</span>
          <strong>{todayGaps.length}</strong>
        </div>
        <div>
          <span>Open</span>
          <strong>{formatCompactDuration(openMinutes)}</strong>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="mobile-kicker">My day</p>
            <h2 className="mt-1 font-display text-xl font-medium tracking-tight">Timeline</h2>
          </div>
          {todayGaps.length > 0 ? (
            <button type="button" onClick={onOpenGapPlan} className="mobile-text-action">
              All gaps <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {todayMeetings.length === 0 ? (
          <div className="mobile-empty-card">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-medium">Nothing scheduled today</p>
            <p className="mt-1 text-sm text-muted-foreground">Your day is open.</p>
          </div>
        ) : (
          <div className="mobile-agenda-card">
            {todayMeetings.map((meeting) => {
              const gap = gapByPreviousId.get(meeting.id);
              return (
                <div key={meeting.id}>
                  <AgendaItem
                    meeting={meeting}
                    active={meeting.startTime <= nowMinutes && nowMinutes < meeting.endTime}
                    passed={meeting.endTime <= nowMinutes}
                  />
                  {gap ? (
                    <GapRow
                      gap={gap}
                      preferences={preferences}
                      gapPreferences={gapPreferences}
                      planTransition={planTransition}
                      onOpen={onOpenGapPlan}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="px-1 pb-1 text-center text-[0.66rem] text-muted-foreground">
        {isDemo ? "Sample timetable" : `${meetingCount} meetings in ${selectedTerm} · ${gapCount} gaps in the term`}
      </p>
    </div>
  );
}

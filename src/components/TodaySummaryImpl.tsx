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
  Route,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { memo, useMemo } from "react";
import type { GapPreferences } from "@/features/gaps/types";
import { planGapAssessment } from "@/features/gaps/assess-gap";
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
} from "@/features/today/today-state";
import { useTodayState } from "@/features/today/use-today-state";
import { meetingOccursOnDate } from "@/lib/calendar-awareness";
import { findGaps } from "@/lib/gaps";
import type { Gap, Meeting, Term } from "@/lib/timetable-types";
import { formatCompactDuration, formatTime, weekdayForDate } from "@/lib/timetable-types";

function meetingKind(meeting: Meeting) {
  if (meeting.sectionCode === "STUDY") return "Study";
  if (meeting.sectionCode === "PERSONAL") return "Personal";
  return meeting.activityType === "OTHER" ? "Class" : meeting.activityType;
}

function DayAgenda({
  meetings,
  gaps,
  nowMinutes,
  preferences,
  gapPreferences,
  planTransition,
  onOpenGapPlan,
}: {
  meetings: Meeting[];
  gaps: Gap[];
  nowMinutes: number;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
  onOpenGapPlan: () => void;
}) {
  if (meetings.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 font-medium">Nothing scheduled today</p>
        <p className="mt-1 text-sm text-muted-foreground">Your day is open.</p>
      </div>
    );
  }

  const gapsByPreviousId = new Map(gaps.map((gap) => [gap.previous.id, gap]));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {meetings.map((meeting, index) => {
        const location = getLocationPresentation({ meeting });
        const current = meeting.startTime <= nowMinutes && nowMinutes < meeting.endTime;
        const passed = meeting.endTime <= nowMinutes;
        const gap = gapsByPreviousId.get(meeting.id);
        const gapResult = gap
          ? planGapAssessment(gap, preferences, gapPreferences, planTransition)
          : null;
        return (
          <div key={meeting.id}>
            <div
              className={`grid gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[5.25rem_minmax(0,1fr)_auto] sm:items-start ${
                current ? "bg-accent/6" : ""
              }`}
            >
              <div className="text-xs">
                <p className={`font-semibold ${current ? "text-accent" : "text-foreground"}`}>
                  {formatTime(meeting.startTime)}
                </p>
                <p className="mt-0.5 text-muted-foreground">{formatTime(meeting.endTime)}</p>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{meeting.courseCode}</p>
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
                    {meetingKind(meeting)}
                  </span>
                  {current ? (
                    <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-accent">
                      Now
                    </span>
                  ) : passed ? (
                    <span className="text-[0.65rem] font-medium text-muted-foreground">Done</span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {meeting.courseName}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {location.label}
                </p>
              </div>
              <div className="text-xs text-muted-foreground sm:text-right">
                {index < meetings.length - 1 ? `${formatCompactDuration(meeting.endTime - meeting.startTime)}` : "Last item"}
              </div>
            </div>

            {gap && gapResult ? (
              <button
                type="button"
                onClick={onOpenGapPlan}
                className="group flex w-full items-center gap-3 border-b border-border bg-secondary/20 px-4 py-3 text-left hover:bg-secondary/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/8 text-accent">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {formatCompactDuration(gap.durationMinutes)} gap · {gapResult.assessment.primary.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatCompactDuration(gapResult.assessment.primary.activityMinutes)} usable ·
                    leave by {formatTime(gapResult.assessment.leaveByMinutes)}
                  </p>
                </div>
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
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
  const location = useLocation();
  const onTodayRoute = location.pathname.replace(/\/$/, "") === "/today";
  const firstValue = useFirstValueArrival(onTodayRoute);
  const { now, state: summary } = useTodayState({
    meetings,
    selectedTerm,
    preferences,
    gapPreferences,
    planTransition,
  });
  const importedMeetingCount = meetings.filter(
    (meeting) => meeting.sectionCode !== "STUDY" && meeting.sectionCode !== "PERSONAL",
  ).length;

  const todayMeetings = useMemo(
    () =>
      meetings
        .filter(
          (meeting) => meeting.term === selectedTerm && meetingOccursOnDate(meeting, now),
        )
        .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime),
    [meetings, now, selectedTerm],
  );
  const todayGaps = useMemo(() => findGaps(todayMeetings, selectedTerm), [selectedTerm, todayMeetings]);
  const classMeetings = todayMeetings.filter(
    (meeting) => meeting.sectionCode !== "STUDY" && meeting.sectionCode !== "PERSONAL",
  );
  const plannedMeetings = todayMeetings.filter(
    (meeting) => meeting.sectionCode === "STUDY" || meeting.sectionCode === "PERSONAL",
  );
  const firstStart = todayMeetings[0]?.startTime ?? null;
  const lastEnd = todayMeetings.at(-1)?.endTime ?? null;
  const spanMinutes = firstStart !== null && lastEnd !== null ? Math.max(0, lastEnd - firstStart) : 0;
  const scheduledMinutes = todayMeetings.reduce(
    (sum, meeting) => sum + Math.max(0, meeting.endTime - meeting.startTime),
    0,
  );
  const openMinutes = Math.max(0, spanMinutes - scheduledMinutes);

  let title: string;
  let detail: string | null = null;
  let secondary: string | null = null;
  let SecondaryIcon: LucideIcon = Navigation;
  let heading = `Today · ${weekdayForDate(now)}`;

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
      if (summary.next && summary.route) {
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
        )}${summary.leaveBy === null || summary.leaveBy === undefined ? "" : ` · leave by ${formatTime(summary.leaveBy)}`}`;
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

  if (!onTodayRoute) return null;

  const canOpenRoute =
    summary.kind === "gap" || summary.kind === "before-first" || summary.kind === "in-class";
  const isGap = summary.kind === "gap";

  return (
    <div className="mt-6 space-y-4">
      {firstValue.showSuccess ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border border-accent/25 bg-accent/6 px-4 py-3 text-sm font-medium"
        >
          Schedule ready — {importedMeetingCount} {importedMeetingCount === 1 ? "class" : "classes"}{" "}
          imported.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <section
          className={`rounded-xl border border-border bg-card p-5 sm:p-6 ${
            firstValue.emphasize ? "first-value-emphasis" : ""
          }`}
          aria-labelledby="today-title"
        >
          <h2
            id="today-title"
            className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
            {heading}
          </h2>
          <p className="mt-4 font-display text-2xl font-medium tracking-tight">{title}</p>
          {detail ? <p className="mt-1.5 text-sm text-muted-foreground">{detail}</p> : null}
          {secondary ? (
            <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
              <SecondaryIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              {secondary}
            </p>
          ) : null}

          {summary.plannedWork.current || summary.plannedWork.next ? (
            <div className="mt-4 rounded-lg border border-border bg-secondary/25 p-3.5">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {summary.plannedWork.current ? "Planned now" : "Planned next"}
              </p>
              {(() => {
                const work = summary.plannedWork.current ?? summary.plannedWork.next!;
                return (
                  <p className="mt-1.5 text-sm font-medium">
                    {work.courseCode} · {work.courseName}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {formatTime(work.startTime)}–{formatTime(work.endTime)}
                    </span>
                  </p>
                );
              })()}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {isGap ? (
              <button
                type="button"
                onClick={() => {
                  firstValue.acknowledge();
                  onOpenGapPlan();
                }}
                className="button-primary inline-flex min-h-10 items-center gap-2 px-4 text-sm font-semibold"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Plan this gap
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                firstValue.acknowledge();
                onOpenDayRoute();
              }}
              disabled={!canOpenRoute && todayMeetings.length === 0}
              className={`${isGap ? "button-secondary" : "button-primary"} inline-flex min-h-10 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-45`}
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Day route
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-card p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            At a glance
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-secondary/35 p-3">
              <p className="text-xs text-muted-foreground">Classes</p>
              <p className="mt-1 text-xl font-semibold">{classMeetings.length}</p>
            </div>
            <div className="rounded-lg bg-secondary/35 p-3">
              <p className="text-xs text-muted-foreground">Planned</p>
              <p className="mt-1 text-xl font-semibold">{plannedMeetings.length}</p>
            </div>
            <div className="rounded-lg bg-secondary/35 p-3">
              <p className="text-xs text-muted-foreground">Gaps</p>
              <p className="mt-1 text-xl font-semibold">{todayGaps.length}</p>
            </div>
            <div className="rounded-lg bg-secondary/35 p-3">
              <p className="text-xs text-muted-foreground">Open between</p>
              <p className="mt-1 text-xl font-semibold">{formatCompactDuration(openMinutes)}</p>
            </div>
          </div>
          {firstStart !== null && lastEnd !== null ? (
            <div className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Day runs {formatTime(firstStart)}–{formatTime(lastEnd)}
              </p>
              <p className="mt-2 flex items-center gap-2">
                <Route className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {formatCompactDuration(scheduledMinutes)} scheduled
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      <section aria-labelledby="today-agenda-title">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              My day
            </p>
            <h2 id="today-agenda-title" className="mt-1 font-display text-xl font-medium">
              Timeline
            </h2>
          </div>
          {todayGaps.length > 0 ? (
            <button
              type="button"
              onClick={onOpenGapPlan}
              className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-xs font-semibold"
            >
              Open all gaps
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <DayAgenda
          meetings={todayMeetings}
          gaps={todayGaps}
          nowMinutes={minutesNow(now)}
          preferences={preferences}
          gapPreferences={gapPreferences}
          planTransition={planTransition}
          onOpenGapPlan={onOpenGapPlan}
        />
      </section>
    </div>
  );
});

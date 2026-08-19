import { useLocation } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Home, Navigation, type LucideIcon } from "lucide-react";
import { memo } from "react";
import { GapPlannerPreview } from "@/components/GapPlannerPreview";
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
} from "@/features/today/today-state";
import { useTodayState } from "@/features/today/use-today-state";
import type { Meeting, Term } from "@/lib/timetable-types";
import { formatCompactDuration, formatTime, WEEKDAYS } from "@/lib/timetable-types";

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

  const showPlanner = onTodayRoute && summary.kind === "gap";
  const canPlanGap = summary.kind === "gap" && !showPlanner;
  const canOpenRoute =
    summary.kind === "gap" || summary.kind === "before-first" || summary.kind === "in-class";

  return (
    <>
      {firstValue.showSuccess ? (
        <p
          role="status"
          aria-live="polite"
          className="surface mb-3 mt-6 border-accent/25 bg-accent/6 px-4 py-3 text-sm font-medium"
        >
          Schedule ready — {meetings.length} {meetings.length === 1 ? "class" : "classes"} imported.
        </p>
      ) : null}
      <section
        className={`today-signal surface mb-6 mt-6 overflow-hidden p-5 sm:p-6 ${
          firstValue.emphasize ? "first-value-emphasis" : ""
        }`}
        aria-labelledby="today-title"
      >
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

        {showPlanner ? (
          <GapPlannerPreview
            assessment={summary.assessment}
            onOpenGapPlan={() => {
              firstValue.acknowledge();
              onOpenGapPlan();
            }}
            className="mt-4"
          />
        ) : null}

        {canPlanGap || canOpenRoute ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {canPlanGap ? (
              <button
                type="button"
                onClick={() => {
                  firstValue.acknowledge();
                  onOpenGapPlan();
                }}
                className="button-primary inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-semibold"
              >
                Plan this gap
              </button>
            ) : null}
            {canOpenRoute ? (
              <button
                type="button"
                onClick={() => {
                  firstValue.acknowledge();
                  onOpenDayRoute();
                }}
                className={`inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-semibold ${
                  canPlanGap ? "button-secondary" : showPlanner ? "button-secondary" : "button-primary"
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
    </>
  );
});

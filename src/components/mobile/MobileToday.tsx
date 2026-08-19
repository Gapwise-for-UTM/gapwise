import { useLocation } from "@tanstack/react-router";
import {
  CalendarClock,
  Clock3,
  Home,
  MapPin,
  Navigation,
  type LucideIcon,
} from "lucide-react";
import { GapPlannerPreview } from "@/components/GapPlannerPreview";
import { useMobileRouteTarget } from "@/components/mobile/MobileShell";
import { useFirstValueArrival } from "@/features/onboarding/first-value";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import {
  formatOccurrenceDate,
  minutesNow,
  occurrenceLead,
  routeCopy,
  routeMinutes,
  type TodayState,
} from "@/features/today/today-state";
import { formatCompactDuration, formatTime, WEEKDAYS } from "@/lib/timetable-types";

type Row = { icon: LucideIcon; text: string };

type Presentation = {
  eyebrow: string;
  title: string;
  detail: string | null;
  rows: Row[];
};

function present(state: TodayState, now: Date, selectedTerm: string): Presentation {
  const weekdayLabel = WEEKDAYS[now.getDay() - 1] ?? "Weekend";
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
        title: state.next
          ? `${state.next.meeting.term} is next`
          : "No later classes in this timetable",
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
        if (state.leaveBy !== null && state.leaveBy !== undefined) {
          rows.push({ icon: Clock3, text: `Leave by ${formatTime(state.leaveBy)}` });
        }
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
          text: `~${outbound + inbound} min campus round trip · leave home by ${formatTime(
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
          text: routeCopy(state.gap.previous, state.gap.next, state.route),
        });
        rows.push({
          icon: Clock3,
          text: `Leave by ${formatTime(state.assessment.leaveByMinutes)}`,
        });
      }
      return {
        eyebrow: `Today · ${weekdayLabel}`,
        title: state.assessment.primary.title,
        detail: `${formatCompactDuration(state.assessment.primary.activityMinutes)} usable · ${formatTime(
          state.gap.startTime,
        )} – ${formatTime(state.gap.endTime)}`,
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

export function MobileToday({
  state,
  now,
  selectedTerm,
  meetingCount,
  gapCount,
  isDemo,
  onOpenGapPlan,
  onOpenDayRoute,
}: {
  state: TodayState;
  now: Date;
  selectedTerm: string;
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
    <div className="rise-in space-y-4">
      {firstValue.showSuccess ? (
        <p
          role="status"
          aria-live="polite"
          className="surface border-accent/25 bg-accent/6 px-4 py-3 text-sm font-medium"
        >
          Schedule ready — {meetingCount} {meetingCount === 1 ? "class" : "classes"} imported.
        </p>
      ) : null}

      <section
        className={`surface overflow-hidden p-5 ${firstValue.emphasize ? "first-value-emphasis" : ""}`}
        aria-labelledby="mobile-today-title"
      >
        <p className="flex items-center gap-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1
          id="mobile-today-title"
          className="mt-3 text-balance font-display text-[1.55rem] font-medium leading-[1.1] tracking-[-0.03em]"
        >
          {title}
        </h1>
        {detail ? (
          <p className="mt-2 text-[0.9rem] leading-6 text-muted-foreground">{detail}</p>
        ) : null}

        {rows.length > 0 ? (
          <ul className="mt-4 space-y-2.5 border-t border-border pt-4">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <li
                  key={row.text}
                  className="flex items-start gap-2.5 text-[0.875rem] leading-6 text-muted-foreground"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0">{row.text}</span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {state.kind === "gap" ? (
          <GapPlannerPreview
            assessment={state.assessment}
            onOpenGapPlan={() => {
              firstValue.acknowledge();
              onOpenGapPlan();
            }}
            className="mt-5"
          />
        ) : null}

        {canOpenRoute ? (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                firstValue.acknowledge();
                setRouteTargetId(routeTargetId);
                onOpenDayRoute();
              }}
              className={`inline-flex min-h-[2.875rem] items-center justify-center gap-2 px-4 text-sm font-semibold ${
                state.kind === "gap" ? "button-secondary" : "button-primary"
              }`}
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Navigate
            </button>
          </div>
        ) : null}
      </section>

      <section className="surface p-5">
        <p className="eyebrow text-muted-foreground">
          {isDemo ? "Sample data" : "Campus day plan"}
        </p>
        <p className="mt-2 text-[0.875rem] leading-6 text-muted-foreground">
          {meetingCount} meetings in {selectedTerm} · {gapCount} gaps detected
        </p>
      </section>

      <p className="px-1 pb-2 text-center font-mono text-[0.6rem] uppercase leading-relaxed tracking-[0.13em] text-muted-foreground">
        Independent student project · Not affiliated with U of T
      </p>
    </div>
  );
}

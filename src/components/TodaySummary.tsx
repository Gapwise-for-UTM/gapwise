import { AlertTriangle, CalendarClock, Navigation } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { CAMPUS_BUILDINGS } from "@/data/utm/campus";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";
import {
  formatDuration,
  formatTime,
  locationLabel,
  termForMonth,
  WEEKDAYS,
} from "@/lib/timetable-types";

function currentTerm(date: Date): Term {
  return termForMonth(date.getMonth() + 1);
}

function minutesNow(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function manualStartMeeting(buildingCode: string, weekday: Weekday, term: Term): Meeting {
  return {
    id: `manual-${buildingCode}`,
    courseCode: "START",
    activityType: "OTHER",
    sectionCode: "",
    courseName: "Manually selected start",
    startTime: 0,
    endTime: 1,
    weekday,
    buildingCode,
    room: null,
    term,
    locationUnknown: false,
  };
}

export const TodaySummary = memo(function TodaySummary({
  meetings,
  preferences,
  planTransition,
}: {
  meetings: Meeting[];
  preferences: UserPreferences;
  planTransition: TransitionPlanner;
}) {
  const [now, setNow] = useState(() => new Date());
  const [manualBuilding, setManualBuilding] = useState("MN");
  const [useManualStart, setUseManualStart] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const dayIndex = now.getDay() - 1;
    const weekday = WEEKDAYS[dayIndex];
    if (!weekday) return null;
    const term = currentTerm(now);
    const minute = minutesNow(now);
    const day = meetings
      .filter((meeting) => meeting.term === term && meeting.weekday === weekday)
      .sort((a, b) => a.startTime - b.startTime);
    const current = day.find((meeting) => meeting.startTime <= minute && meeting.endTime > minute);
    const previous = [...day].reverse().find((meeting) => meeting.endTime <= minute);
    const anchor = current ?? previous ?? null;
    const next = day.find((meeting) => meeting.startTime > minute) ?? null;
    if (!next)
      return { weekday, term, current, previous, next: null, route: null, departure: null };
    const start =
      useManualStart || !anchor ? manualStartMeeting(manualBuilding, weekday, term) : anchor;
    const route = planTransition(start, next, preferences);
    const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
    const departure =
      seconds === null
        ? null
        : Math.max(
            0,
            next.startTime - Math.ceil(seconds / 60) - preferences.transitionBufferMinutes,
          );
    return { weekday, term, current, previous, next, route, departure };
  }, [manualBuilding, meetings, now, planTransition, preferences, useManualStart]);

  if (!summary) {
    return (
      <section className="surface mb-6 mt-6 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
          Today
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Weekend view — no Monday–Friday timetable route is active.
        </p>
      </section>
    );
  }

  const minute = minutesNow(now);
  const untilDeparture = summary.departure === null ? null : summary.departure - minute;
  const recent = summary.current ?? summary.previous;

  return (
    <section className="surface mb-6 mt-6 p-4 sm:p-5" aria-labelledby="today-title">
      <div
        className={`grid gap-5 ${
          summary.next ? "lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8" : ""
        }`}
      >
        <div>
          <h2 id="today-title" className="flex items-center gap-2 text-base font-semibold">
            <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
            Today · {summary.weekday}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {recent
              ? `${summary.current ? "Current" : "Most recently completed"}: ${recent.courseCode} · ${locationLabel(recent)}`
              : "No previous class today; choose a campus starting building."}
          </p>
        </div>

        {summary.next ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:w-auto">
            <label className="block w-full text-xs font-medium sm:w-auto">
              Starting point for route to next class
              <select
                value={manualBuilding}
                onChange={(event) => setManualBuilding(event.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-card px-3 py-2 sm:min-w-64"
              >
                {CAMPUS_BUILDINGS.map((building) => (
                  <option key={building.code} value={building.code}>
                    {building.code} · {building.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block max-w-72 text-[0.7rem] font-normal leading-relaxed text-muted-foreground">
                {recent
                  ? "Use this when you are starting somewhere other than your current or previous class."
                  : "No earlier class is available, so the selected building is used automatically."}
              </span>
            </label>

            {recent ? (
              <button
                type="button"
                aria-pressed={useManualStart}
                onClick={() => setUseManualStart((value) => !value)}
                className={`w-full rounded-md border px-3 py-2 text-xs font-semibold transition-colors sm:w-auto ${
                  useManualStart
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-input hover:border-accent/60 hover:bg-secondary/50"
                }`}
              >
                {useManualStart ? "Using selected building" : "Use selected building"}
              </button>
            ) : (
              <span className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-foreground">
                Using selected building
              </span>
            )}
          </div>
        ) : null}
      </div>

      {summary.next ? (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Next class</p>
            <p className="text-sm font-semibold">
              {summary.next.courseCode} at {formatTime(summary.next.startTime)}
            </p>
            <p className="text-xs text-muted-foreground">{locationLabel(summary.next)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Departure</p>
            <p className="text-sm font-semibold">
              {summary.departure === null
                ? "Unavailable"
                : untilDeparture !== null && untilDeparture <= 0
                  ? "Leave now"
                  : `In ${formatDuration(untilDeparture ?? 0)} · ${formatTime(summary.departure)}`}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> Route to next
            </p>
            <p className="text-sm font-semibold">
              {summary.route?.accuracy ?? "Location unavailable"}
            </p>
            <p className="text-xs text-muted-foreground">{summary.route?.message}</p>
          </div>
          {summary.route?.warnings.length ? (
            <p className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-3">
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                aria-hidden="true"
              />
              {summary.route.warnings[0]}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
          No later class is scheduled today.
        </p>
      )}

      {summary.next ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Uses your current or previous class unless you choose another building. Live geolocation is not
          used.
        </p>
      ) : null}
    </section>
  );
});

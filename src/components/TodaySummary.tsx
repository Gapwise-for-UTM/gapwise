import { AlertTriangle, CalendarClock, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CAMPUS_BUILDINGS, UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { planMeetingTransition } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";
import { formatDuration, formatTime, locationLabel, WEEKDAYS } from "@/lib/timetable-types";

function currentTerm(date: Date): Term {
  return date.getMonth() + 1 >= 8 ? "Fall" : "Winter";
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

export function TodaySummary({
  meetings,
  preferences,
}: {
  meetings: Meeting[];
  preferences: UserPreferences;
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
    const route = planMeetingTransition(start, next, UTM_ROUTING_GRAPH, preferences);
    const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
    const departure =
      seconds === null
        ? null
        : Math.max(
            0,
            next.startTime - Math.ceil(seconds / 60) - preferences.transitionBufferMinutes,
          );
    return { weekday, term, current, previous, next, route, departure };
  }, [manualBuilding, meetings, now, preferences, useManualStart]);

  if (!summary) {
    return (
      <section className="surface mb-6 p-4">
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
    <section className="surface mb-6 p-4" aria-labelledby="today-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium">
            Manual starting building
            <select
              value={manualBuilding}
              onChange={(event) => setManualBuilding(event.target.value)}
              className="mt-1 block rounded-md border border-input bg-card px-2 py-1.5"
            >
              {CAMPUS_BUILDINGS.map((building) => (
                <option key={building.code} value={building.code}>
                  {building.code} · {building.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setUseManualStart((value) => !value)}
            className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${
              useManualStart ? "border-accent bg-accent/10" : "border-input"
            }`}
          >
            {useManualStart ? "Using manual start" : "Use manual start"}
          </button>
        </div>
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
        <p className="mt-3 text-sm text-muted-foreground">No later class is scheduled today.</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Uses your previous class or selected building as the start. Live geolocation is not used.
      </p>
    </section>
  );
}

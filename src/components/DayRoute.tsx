import type { User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Footprints,
  LocateFixed,
  Route as RouteIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CampusMap } from "./CampusMap";
import { IndoorFloorViewer } from "./IndoorFloorViewer";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { TransitionRoute } from "@/features/routing/types";
import { loadPreferences, savePreferences } from "@/features/sync/sync-service";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";
import { formatDuration, formatTime, locationLabel, WEEKDAYS } from "@/lib/timetable-types";

type DaySegment = {
  id: string;
  from: Meeting;
  to: Meeting;
  route: TransitionRoute;
};

function secondsLabel(seconds: number): string {
  return formatDuration(Math.max(1, Math.ceil(seconds / 60)));
}

function distanceLabel(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function DayRoute({
  meetings,
  term,
  onTermChange,
  preferences,
  onPreferencesChange,
  user,
  planTransition,
}: {
  meetings: Meeting[];
  term: Term;
  onTermChange: (term: Term) => void;
  preferences: UserPreferences;
  onPreferencesChange: (preferences: UserPreferences) => void;
  user: User | null;
  planTransition: TransitionPlanner;
}) {
  const availableTerms = useMemo(
    () =>
      (["Fall", "Winter"] as Term[]).filter((item) =>
        meetings.some((meeting) => meeting.term === item),
      ),
    [meetings],
  );
  const initialDay =
    WEEKDAYS[new Date().getDay() - 1] && new Date().getDay() <= 5
      ? WEEKDAYS[new Date().getDay() - 1]!
      : "Monday";
  const [weekday, setWeekday] = useState<Weekday>(initialDay);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [preferenceMessage, setPreferenceMessage] = useState<string | null>(null);

  const dayMeetings = useMemo(
    () =>
      meetings
        .filter((meeting) => meeting.term === term && meeting.weekday === weekday)
        .sort((a, b) => a.startTime - b.startTime),
    [meetings, term, weekday],
  );
  const segments = useMemo<DaySegment[]>(
    () =>
      dayMeetings.slice(0, -1).map((from, index) => {
        const to = dayMeetings[index + 1]!;
        return {
          id: `${from.id}--${to.id}`,
          from,
          to,
          route: planTransition(from, to, preferences),
        };
      }),
    [dayMeetings, planTransition, preferences],
  );

  useEffect(() => {
    setSelectedMeetingId(dayMeetings[0]?.id ?? null);
    setSelectedSegmentId(segments[0]?.id ?? null);
  }, [dayMeetings, segments]);

  const selectMeeting = useCallback((id: string) => {
    setSelectedMeetingId(id);
    setSelectedSegmentId(null);
  }, []);
  const selectSegment = useCallback((id: string) => {
    setSelectedSegmentId(id);
    setSelectedMeetingId(null);
  }, []);
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) ?? null;

  function updatePreferences(patch: Partial<UserPreferences>) {
    const next = { ...preferences, ...patch };
    next.avoidStairs = next.mode === "step-free";
    next.preferIndoor = next.mode === "prefer-indoor";
    onPreferencesChange(next);
  }

  return (
    <div className="space-y-5">
      <section className="surface p-4" aria-labelledby="route-preferences-title">
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Term and day
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableTerms.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onTermChange(item)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    item === term ? "bg-primary text-primary-foreground" : "bg-secondary"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setWeekday(day)}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium ${
                    day === weekday ? "bg-accent text-accent-foreground" : "hover:bg-secondary"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 id="route-preferences-title" className="text-sm font-semibold">
              Route preferences
            </h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium">
                Mode
                <select
                  value={preferences.mode}
                  onChange={(event) =>
                    updatePreferences({ mode: event.target.value as UserPreferences["mode"] })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-card px-2 py-2"
                >
                  <option value="fastest">Fastest</option>
                  <option value="prefer-indoor">Prefer indoor</option>
                  <option value="step-free">Step-free</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                Walking speed · {preferences.walkingSpeedMps.toFixed(2)} m/s
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={preferences.walkingSpeedMps}
                  onChange={(event) =>
                    updatePreferences({ walkingSpeedMps: Number(event.target.value) })
                  }
                  className="mt-3 w-full accent-[var(--color-accent)]"
                />
              </label>
              <label className="text-xs font-medium">
                Transition buffer · {preferences.transitionBufferMinutes} min
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={preferences.transitionBufferMinutes}
                  onChange={(event) =>
                    updatePreferences({ transitionBufferMinutes: Number(event.target.value) })
                  }
                  className="mt-3 w-full accent-[var(--color-accent)]"
                />
              </label>
            </div>
            {user ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void savePreferences(preferences)
                      .then(() => setPreferenceMessage("Route preferences saved."))
                      .catch((error: unknown) =>
                        setPreferenceMessage(
                          error instanceof Error ? error.message : "Save failed.",
                        ),
                      )
                  }
                  className="rounded-md border border-input px-2 py-1 text-xs font-semibold hover:bg-secondary"
                >
                  Save preferences
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void loadPreferences()
                      .then((value) => {
                        if (value) onPreferencesChange(value);
                        setPreferenceMessage(
                          value ? "Saved preferences loaded." : "No saved preferences found.",
                        );
                      })
                      .catch((error: unknown) =>
                        setPreferenceMessage(
                          error instanceof Error ? error.message : "Load failed.",
                        ),
                      )
                  }
                  className="rounded-md border border-input px-2 py-1 text-xs font-semibold hover:bg-secondary"
                >
                  Load preferences
                </button>
                {preferenceMessage ? (
                  <span className="text-xs text-muted-foreground" role="status">
                    {preferenceMessage}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {dayMeetings.length === 0 ? (
        <div className="surface p-8 text-center">
          <h2 className="text-lg font-semibold">No classes on {weekday}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose another weekday or term.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
          <section className="surface p-4" aria-labelledby="day-timeline-title">
            <h2 id="day-timeline-title" className="text-lg font-semibold">
              {weekday} timeline
            </h2>
            <ol className="mt-3 space-y-3">
              {dayMeetings.map((meeting, index) => {
                const segment = segments[index];
                const selected = selectedMeetingId === meeting.id;
                return (
                  <li key={meeting.id}>
                    <button
                      type="button"
                      onClick={() => selectMeeting(meeting.id)}
                      className={`w-full rounded-lg border p-3 text-left ${
                        selected ? "border-accent bg-secondary" : "border-border hover:bg-muted/60"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {index + 1}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">
                            {meeting.courseCode} {meeting.activityType}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatTime(meeting.startTime)}–{formatTime(meeting.endTime)} ·{" "}
                            {locationLabel(meeting)}
                          </span>
                        </span>
                      </span>
                    </button>
                    {segment ? (
                      <button
                        type="button"
                        onClick={() => selectSegment(segment.id)}
                        className={`ml-3 mt-2 w-[calc(100%-0.75rem)] rounded-lg border-l-2 p-3 text-left text-xs ${
                          selectedSegmentId === segment.id
                            ? "border-accent bg-accent/10"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          Transition to {segment.to.courseCode}
                        </span>
                        <span className="mt-1 block text-muted-foreground">
                          {segment.route.message}
                        </span>
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="space-y-4">
            <CampusMap
              meetings={dayMeetings}
              segments={segments}
              selectedMeetingId={selectedMeetingId}
              selectedSegmentId={selectedSegmentId}
              onSelectMeeting={selectMeeting}
              onSelectSegment={selectSegment}
            />
            {selectedSegment ? (
              <SegmentDetails segment={selectedSegment} preferences={preferences} />
            ) : (
              <p className="surface p-4 text-sm text-muted-foreground">
                Select a transition to see distance, timing, and route accuracy.
              </p>
            )}
          </div>
        </div>
      )}

      {selectedSegment ? (
        <IndoorFloorViewer
          key={selectedSegment.id}
          route={selectedSegment.route}
          from={selectedSegment.from}
          to={selectedSegment.to}
        />
      ) : null}
    </div>
  );
}

function SegmentDetails({
  segment,
  preferences,
}: {
  segment: DaySegment;
  preferences: UserPreferences;
}) {
  const route = segment.route;
  const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
  const distance = route.result?.totalDistanceMeters ?? route.approximateDistanceMeters;
  const departure =
    seconds === null
      ? null
      : Math.max(
          0,
          segment.to.startTime - Math.ceil(seconds / 60) - preferences.transitionBufferMinutes,
        );
  return (
    <section className="surface p-4" aria-labelledby="segment-details-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="segment-details-title" className="text-base font-semibold">
            {locationLabel(segment.from)} → {locationLabel(segment.to)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{route.accuracy}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            route.status === "routed" || route.status === "same-room"
              ? "bg-lec/15 text-lec"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {route.status === "approximate" ? "Estimate" : route.status.replace("-", " ")}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Metric
          icon={Clock3}
          label="Estimated walk"
          value={seconds === null ? "Unavailable" : secondsLabel(seconds)}
        />
        <Metric
          icon={Footprints}
          label="Distance"
          value={
            distance === null
              ? "Unavailable"
              : `${route.status === "approximate" ? "~" : ""}${distanceLabel(distance)}`
          }
        />
        <Metric
          icon={LocateFixed}
          label="Leave by"
          value={departure === null ? "Unavailable" : formatTime(departure)}
        />
        <Metric
          icon={RouteIcon}
          label="Outdoor"
          value={
            route.result
              ? distanceLabel(route.result.outdoorDistanceMeters)
              : route.status === "approximate" && distance !== null
                ? `~${distanceLabel(distance)}`
                : "Unknown"
          }
        />
        <Metric
          icon={RouteIcon}
          label="Indoor"
          value={route.result ? distanceLabel(route.result.indoorDistanceMeters) : "Not mapped"}
        />
        <Metric
          icon={RouteIcon}
          label="Floor changes"
          value={route.result ? String(route.result.floorChanges) : "Unknown"}
        />
      </dl>
      {route.warnings.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {route.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                aria-hidden="true"
              />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

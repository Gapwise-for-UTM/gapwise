import type { User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Clock3,
  Footprints,
  Home,
  LocateFixed,
  Route as RouteIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BubbleTabs } from "./BubbleTabs";
import { CampusMap } from "./CampusMap";
import { IndoorFloorViewer } from "./IndoorFloorViewer";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import {
  createResidenceMeeting,
  isResidenceMeeting,
  selectedResidence,
} from "@/features/routing/residence";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { TransitionRoute } from "@/features/routing/types";
import { loadPreferences, savePreferences } from "@/features/sync/sync-service";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";
import { formatDuration, formatTime, TERMS, WEEKDAYS } from "@/lib/timetable-types";

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
    () => TERMS.filter((item) => meetings.some((meeting) => meeting.term === item)),
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
  const residence = selectedResidence(preferences);
  const mapHome = useMemo(
    () => (residence ? { buildingCode: residence.code, label: residence.name } : null),
    [residence],
  );
  const routeStops = useMemo(() => {
    if (!residence || dayMeetings.length === 0) return dayMeetings;
    const first = dayMeetings[0]!;
    const last = dayMeetings[dayMeetings.length - 1]!;
    return [
      createResidenceMeeting({
        buildingCode: residence.code,
        term,
        weekday,
        time: first.startTime,
        position: "start",
      }),
      ...dayMeetings,
      createResidenceMeeting({
        buildingCode: residence.code,
        term,
        weekday,
        time: last.endTime,
        position: "end",
      }),
    ];
  }, [dayMeetings, residence, term, weekday]);
  const segments = useMemo<DaySegment[]>(
    () =>
      routeStops.slice(0, -1).map((from, index) => {
        const to = routeStops[index + 1]!;
        return {
          id: `${from.id}--${to.id}`,
          from,
          to,
          route: planTransition(from, to, preferences),
        };
      }),
    [planTransition, preferences, routeStops],
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
      <section className="surface p-5" aria-labelledby="route-preferences-title">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.5fr]">
          <div>
            <p className="eyebrow text-muted-foreground">Term and day</p>
            <BubbleTabs
              label="Route term"
              items={availableTerms.map((item) => ({ value: item, label: item }))}
              value={term}
              onChange={onTermChange}
              compact
              className="mt-2 w-full sm:w-44"
            />
            <BubbleTabs
              label="Route weekday"
              items={WEEKDAYS.map((day) => ({
                value: day,
                label: day.slice(0, 3),
                ariaLabel: day,
              }))}
              value={weekday}
              onChange={setWeekday}
              compact
              className="mt-2 w-full"
            />
          </div>
          <div>
            <h2 id="route-preferences-title" className="text-sm font-medium">
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
                  className="button-secondary px-2 py-1 text-xs font-semibold"
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
                  className="button-secondary px-2 py-1 text-xs font-semibold"
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
        <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.65fr)]">
          <section className="surface p-5" aria-labelledby="day-timeline-title">
            <p className="eyebrow text-accent">Day sequence</p>
            <h2 id="day-timeline-title" className="mt-2 text-lg font-medium tracking-tight">
              {weekday} timeline
            </h2>
            <ol className="mt-3 space-y-3">
              {routeStops.map((meeting, index) => {
                const segment = segments[index];
                const selected = selectedMeetingId === meeting.id;
                const homeStop = isResidenceMeeting(meeting);
                const classNumber = homeStop
                  ? null
                  : routeStops.slice(0, index + 1).filter((stop) => !isResidenceMeeting(stop))
                      .length;
                const meetingPresentation = getLocationPresentation({ meeting });
                const segmentPresentation = segment
                  ? getLocationPresentation({
                      from: segment.from,
                      to: segment.to,
                      route: segment.route,
                    })
                  : null;
                const SegmentStatusIcon = segmentPresentation?.icon;
                return (
                  <li key={meeting.id}>
                    <button
                      type="button"
                      onClick={() => selectMeeting(meeting.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? "border-accent/60 bg-accent/8"
                          : "border-border bg-card hover:bg-muted/60"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {homeStop ? (
                            <Home className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            classNumber
                          )}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">
                            {homeStop
                              ? index === 0
                                ? "Start at home"
                                : "Return home"
                              : `${meeting.courseCode} ${meeting.activityType}`}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {homeStop
                              ? `${residence?.name} · ${residence?.code}`
                              : `${formatTime(meeting.startTime)}–${formatTime(meeting.endTime)} · ${meetingPresentation.label}`}
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
                            ? "border-accent bg-accent/8"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          {SegmentStatusIcon ? (
                            <SegmentStatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : null}
                          {isResidenceMeeting(segment.to)
                            ? "Walk home"
                            : isResidenceMeeting(segment.from)
                              ? `Walk to ${segment.to.courseCode}`
                              : `Transition to ${segment.to.courseCode}`}
                        </span>
                        <span className="mt-1 block text-muted-foreground">
                          {segmentPresentation?.label}
                        </span>
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="space-y-3">
            <CampusMap
              meetings={dayMeetings}
              segments={segments}
              selectedMeetingId={selectedMeetingId}
              selectedSegmentId={selectedSegmentId}
              onSelectMeeting={selectMeeting}
              onSelectSegment={selectSegment}
              home={mapHome}
              className="h-[30rem] lg:h-[36rem]"
            />
            {selectedSegment ? (
              <SegmentDetails segment={selectedSegment} preferences={preferences} />
            ) : null}
          </div>
        </div>
      )}

      {selectedSegment &&
      !isResidenceMeeting(selectedSegment.from) &&
      !isResidenceMeeting(selectedSegment.to) ? (
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
  const presentation = getLocationPresentation({
    from: segment.from,
    to: segment.to,
    route,
  });
  const fromLocation = getLocationPresentation({ meeting: segment.from });
  const toLocation = getLocationPresentation({ meeting: segment.to });
  const fromResidence = isResidenceMeeting(segment.from) ? selectedResidence(preferences) : null;
  const toResidence = isResidenceMeeting(segment.to) ? selectedResidence(preferences) : null;
  const fromLabel = fromResidence?.name ?? fromLocation.label;
  const toLabel = toResidence?.name ?? toLocation.label;
  const StatusIcon = presentation.icon;
  const routeWarnings = route.warnings.filter((warning) => warning !== presentation.detail);
  const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
  const distance = route.result?.totalDistanceMeters ?? route.approximateDistanceMeters;
  const departure =
    seconds === null
      ? null
      : toResidence
        ? segment.from.endTime
        : Math.max(
            0,
            segment.to.startTime - Math.ceil(seconds / 60) - preferences.transitionBufferMinutes,
          );
  return (
    <section className="surface route-details-panel p-4" aria-labelledby="segment-details-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="segment-details-title" className="text-base font-medium tracking-tight">
            {fromLabel} → {toLabel}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{presentation.detail}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            route.status === "routed" || route.status === "same-room"
              ? "bg-lec/15 text-lec"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {presentation.label}
        </span>
      </div>
      {route.status === "same-room" ? (
        <div className="mt-4 rounded-xl border border-lec/25 bg-lec/8 p-3.5">
          <p className="text-sm font-semibold text-lec">No walk needed</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your next class is in the same room.
          </p>
        </div>
      ) : route.status === "unavailable" ||
        seconds === null ||
        distance === null ||
        departure === null ? (
        <div className="mt-4 flex gap-3 rounded-xl border border-accent/25 bg-accent/8 p-3.5">
          <StatusIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{presentation.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {presentation.detail}
            </p>
          </div>
        </div>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Metric icon={Clock3} label="Estimated walk" value={secondsLabel(seconds)} />
          <Metric
            icon={Footprints}
            label="Distance"
            value={`${route.status === "approximate" ? "~" : ""}${distanceLabel(distance)}`}
          />
          <Metric
            icon={LocateFixed}
            label={toResidence ? "Head home" : "Leave by"}
            value={formatTime(departure)}
          />
          <Metric
            icon={RouteIcon}
            label="Outdoor"
            value={
              route.result
                ? distanceLabel(route.result.outdoorDistanceMeters)
                : `~${distanceLabel(distance)}`
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
      )}
      {routeWarnings.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {routeWarnings.map((warning) => (
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
      <dd className="metric-value mt-1 font-semibold">{value}</dd>
    </div>
  );
}

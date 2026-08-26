import type { User } from "@supabase/supabase-js";
import { AlertTriangle, Clock3, Footprints, LocateFixed, Route as RouteIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BubbleTabs } from "./BubbleTabs";
import { CampusExplorer } from "./CampusExplorer";
import { DayRouteSequence } from "./DayRouteSequence";
import { IndoorFloorViewer } from "./IndoorFloorViewer";
import { MobileDayRoute } from "@/components/mobile/MobileDayRoute";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import {
  campusDayAnchorPresentation,
  createCampusDayRouteStops,
  isCampusDayAnchorMeeting,
  selectedCampusDayAnchor,
  type CampusDayAnchor,
} from "@/features/routing/campus-day";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { TransitionRoute } from "@/features/routing/types";
import { loadPreferences, savePreferences } from "@/features/sync/sync-service";
import type { UserPreferences } from "@/features/sync/preferences";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";
import {
  formatDuration,
  formatTime,
  TERMS,
  visibleWeekdaysForMeetings,
  weekdayForDate,
} from "@/lib/timetable-types";

type DaySegment = {
  id: string;
  from: Meeting;
  to: Meeting;
  route: TransitionRoute;
};

const EMPTY_MEETINGS: Meeting[] = [];
const EMPTY_SEGMENTS: DaySegment[] = [];
const ignoreMapSelection = () => undefined;

function secondsLabel(seconds: number): string {
  return formatDuration(Math.max(1, Math.ceil(seconds / 60)));
}

function distanceLabel(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function departureMetricLabel(kind: CampusDayAnchor["kind"]) {
  if (kind === "residence") return "Head home";
  if (kind === "parking") return "Return to car";
  if (kind === "transit") return "Head to transit";
  return "Head to pick-up";
}

export function DayRoute({
  meetings,
  term,
  onTermChange,
  preferences,
  onPreferencesChange,
  user,
  planTransition,
  selectedBuildingCode,
  onSelectBuilding,
}: {
  meetings: Meeting[];
  term: Term;
  onTermChange: (term: Term) => void;
  preferences: UserPreferences;
  onPreferencesChange: (preferences: UserPreferences) => void;
  user: User | null;
  planTransition: TransitionPlanner;
  selectedBuildingCode: string | null;
  onSelectBuilding: (code: string | null) => void;
}) {
  const isMobile = useIsMobile();
  const availableTerms = useMemo(
    () => TERMS.filter((item) => meetings.some((meeting) => meeting.term === item)),
    [meetings],
  );
  const routeDays = useMemo(
    () => visibleWeekdaysForMeetings(meetings.filter((meeting) => meeting.term === term)),
    [meetings, term],
  );
  const today = weekdayForDate(new Date());
  const initialDay = routeDays.includes(today) ? today : "Monday";
  const [weekday, setWeekday] = useState<Weekday>(initialDay);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [hoveredBuildingCode, setHoveredBuildingCode] = useState<string | null>(null);
  const [preferenceMessage, setPreferenceMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!routeDays.includes(weekday)) setWeekday("Monday");
  }, [routeDays, weekday]);

  const dayMeetings = useMemo(
    () =>
      meetings
        .filter((meeting) => meeting.term === term && meeting.weekday === weekday)
        .sort((a, b) => a.startTime - b.startTime),
    [meetings, term, weekday],
  );
  const dayAnchor = useMemo(() => selectedCampusDayAnchor(preferences), [preferences]);
  const routeStops = useMemo(
    () => createCampusDayRouteStops(dayMeetings, preferences, term, weekday),
    [dayMeetings, preferences, term, weekday],
  );
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

  const selectMeeting = useCallback(
    (id: string) => {
      setSelectedMeetingId(id);
      setSelectedSegmentId(null);
      if (selectedBuildingCode) onSelectBuilding(null);
    },
    [onSelectBuilding, selectedBuildingCode],
  );
  const selectSegment = useCallback(
    (id: string) => {
      setSelectedSegmentId(id);
      setSelectedMeetingId(null);
      if (selectedBuildingCode) onSelectBuilding(null);
    },
    [onSelectBuilding, selectedBuildingCode],
  );
  const highlightBuilding = useCallback((code: string | null) => setHoveredBuildingCode(code), []);
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) ?? null;

  function updatePreferences(patch: Partial<UserPreferences>) {
    const next = { ...preferences, ...patch };
    next.avoidStairs = next.mode === "step-free";
    next.preferIndoor = next.mode === "prefer-indoor";
    onPreferencesChange(next);
  }

  if (isMobile) {
    return (
      <MobileDayRoute
        meetings={meetings}
        term={term}
        onTermChange={onTermChange}
        preferences={preferences}
        onPreferencesChange={onPreferencesChange}
        planTransition={planTransition}
        selectedBuildingCode={selectedBuildingCode}
        onSelectBuilding={onSelectBuilding}
      />
    );
  }

  if (meetings.length === 0) {
    return (
      <CampusExplorer
        meetings={EMPTY_MEETINGS}
        segments={EMPTY_SEGMENTS}
        selectedMeetingId={null}
        selectedSegmentId={null}
        onSelectMeeting={ignoreMapSelection}
        onSelectSegment={ignoreMapSelection}
        hoveredBuildingCode={hoveredBuildingCode}
        onHoverBuilding={highlightBuilding}
        selectedBuildingCode={selectedBuildingCode}
        onSelectBuilding={onSelectBuilding}
        dayAnchor={null}
        className="h-[calc(100dvh-13rem)] min-h-[32rem] max-h-[46rem]"
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="today-signal surface p-5" aria-labelledby="route-preferences-title">
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
              items={routeDays.map((day) => ({
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
            <h2
              id="route-preferences-title"
              className="font-display text-base font-semibold tracking-tight"
            >
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
            {user && !isEncryptedPrivateCloudAuthoritative ? (
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
            ) : user ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Route preferences are included in encrypted private-data sync.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {dayMeetings.length === 0 ? (
        <div className="space-y-3">
          <div className="empty-state surface p-6 text-center">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              No classes on {weekday}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose another weekday, or keep exploring the campus map.
            </p>
          </div>
          <CampusExplorer
            meetings={EMPTY_MEETINGS}
            segments={EMPTY_SEGMENTS}
            selectedMeetingId={null}
            selectedSegmentId={null}
            onSelectMeeting={ignoreMapSelection}
            onSelectSegment={ignoreMapSelection}
            hoveredBuildingCode={hoveredBuildingCode}
            onHoverBuilding={highlightBuilding}
            selectedBuildingCode={selectedBuildingCode}
            onSelectBuilding={onSelectBuilding}
            dayAnchor={null}
            className="h-[32rem] lg:h-[40rem]"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <CampusExplorer
            meetings={dayMeetings}
            segments={segments}
            selectedMeetingId={selectedMeetingId}
            selectedSegmentId={selectedSegmentId}
            onSelectMeeting={selectMeeting}
            onSelectSegment={selectSegment}
            hoveredBuildingCode={hoveredBuildingCode}
            onHoverBuilding={highlightBuilding}
            selectedBuildingCode={selectedBuildingCode}
            onSelectBuilding={onSelectBuilding}
            dayAnchor={dayAnchor}
            className="h-[min(66vh,44rem)] min-h-[34rem]"
          />

          <DayRouteSequence
            routeStops={routeStops}
            segments={segments}
            selectedMeetingId={selectedMeetingId}
            selectedSegmentId={selectedSegmentId}
            onSelectMeeting={selectMeeting}
            onSelectSegment={selectSegment}
          />

          {selectedSegment ? (
            <SegmentDetails segment={selectedSegment} preferences={preferences} />
          ) : null}
        </div>
      )}

      {selectedSegment &&
      !isCampusDayAnchorMeeting(selectedSegment.from) &&
      !isCampusDayAnchorMeeting(selectedSegment.to) ? (
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
  const presentation = getLocationPresentation({ from: segment.from, to: segment.to, route });
  const fromLocation = getLocationPresentation({ meeting: segment.from });
  const toLocation = getLocationPresentation({ meeting: segment.to });
  const fromAnchor = campusDayAnchorPresentation(segment.from);
  const toAnchor = campusDayAnchorPresentation(segment.to);
  const fromLabel = fromAnchor?.label ?? fromLocation.label;
  const toLabel = toAnchor?.label ?? toLocation.label;
  const StatusIcon = presentation.icon;
  const routeWarnings = route.warnings.filter((warning) => warning !== presentation.detail);
  const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
  const distance = route.result?.totalDistanceMeters ?? route.approximateDistanceMeters;
  const departure =
    seconds === null
      ? null
      : toAnchor
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
            label={toAnchor ? departureMetricLabel(toAnchor.kind) : "Leave by"}
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

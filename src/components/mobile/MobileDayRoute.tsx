import { AlertTriangle, Clock3, Footprints, LocateFixed, Route as RouteIcon, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CampusExplorer } from "@/components/CampusExplorer";
import { DayRouteSequence } from "@/components/DayRouteSequence";
import { IndoorFloorViewer } from "@/components/IndoorFloorViewer";
import { useMobileRouteTarget } from "@/components/mobile/MobileShell";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import {
  campusDayAnchorPresentation,
  createCampusDayRouteStops,
  isCampusDayAnchorMeeting,
  selectedCampusDayAnchor,
} from "@/features/routing/campus-day";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { TransitionRoute } from "@/features/routing/types";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";
import { formatDuration, formatTime, TERMS, WEEKDAYS } from "@/lib/timetable-types";

type DaySegment = {
  id: string;
  from: Meeting;
  to: Meeting;
  route: TransitionRoute;
};

const EMPTY_MEETINGS: Meeting[] = [];
const EMPTY_SEGMENTS: DaySegment[] = [];
const ignoreMapSelection = () => undefined;

const DAY_SHORT: Record<Weekday, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
};

function secondsLabel(seconds: number): string {
  return formatDuration(Math.max(1, Math.ceil(seconds / 60)));
}

function distanceLabel(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function departureMetricLabel(kind: "residence" | "transit" | "parking" | "pickup") {
  if (kind === "residence") return "Head home";
  if (kind === "parking") return "Return to car";
  if (kind === "transit") return "To transit";
  return "To pick-up";
}

function defaultWeekday(meetings: Meeting[], term: Term, targetId: string | null): Weekday {
  const target = targetId ? meetings.find((meeting) => meeting.id === targetId) : null;
  if (target?.term === term) return target.weekday;
  const today = WEEKDAYS[new Date().getDay() - 1];
  if (today && meetings.some((meeting) => meeting.term === term && meeting.weekday === today)) return today;
  return (
    WEEKDAYS.find((day) => meetings.some((meeting) => meeting.term === term && meeting.weekday === day)) ??
    "Monday"
  );
}

function RouteOptionsDrawer({
  open,
  onOpenChange,
  preferences,
  onPreferencesChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: UserPreferences;
  onPreferencesChange: (preferences: UserPreferences) => void;
}) {
  function update(patch: Partial<UserPreferences>) {
    const next = { ...preferences, ...patch };
    next.avoidStairs = next.mode === "step-free";
    next.preferIndoor = next.mode === "prefer-indoor";
    onPreferencesChange(next);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle>Route options</DrawerTitle>
            <DrawerDescription className="text-left">
              Tune walking assumptions without covering the map.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-5">
            <label className="block text-sm font-medium">
              Route mode
              <select
                value={preferences.mode}
                onChange={(event) => update({ mode: event.target.value as UserPreferences["mode"] })}
                className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3"
              >
                <option value="fastest">Fastest</option>
                <option value="prefer-indoor">Prefer indoor</option>
                <option value="step-free">Step-free</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              <span className="flex items-center justify-between gap-3">
                <span>Walking speed</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {preferences.walkingSpeedMps.toFixed(2)} m/s
                </span>
              </span>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.05"
                value={preferences.walkingSpeedMps}
                onChange={(event) => update({ walkingSpeedMps: Number(event.target.value) })}
                className="mt-4 w-full accent-[var(--color-accent)]"
              />
            </label>
            <label className="block text-sm font-medium">
              <span className="flex items-center justify-between gap-3">
                <span>Transition buffer</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {preferences.transitionBufferMinutes} min
                </span>
              </span>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={preferences.transitionBufferMinutes}
                onChange={(event) => update({ transitionBufferMinutes: Number(event.target.value) })}
                className="mt-4 w-full accent-[var(--color-accent)]"
              />
            </label>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function SegmentSummary({ segment, preferences }: { segment: DaySegment | null; preferences: UserPreferences }) {
  if (!segment) {
    return (
      <section className="surface p-4">
        <p className="text-sm font-semibold">Select a transition</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Tap a route line or the travel step between classes to see walking time, distance, and leave-by guidance.
        </p>
      </section>
    );
  }

  const { route } = segment;
  const presentation = getLocationPresentation({ from: segment.from, to: segment.to, route });
  const fromLocation = getLocationPresentation({ meeting: segment.from });
  const toLocation = getLocationPresentation({ meeting: segment.to });
  const fromAnchor = campusDayAnchorPresentation(segment.from);
  const toAnchor = campusDayAnchorPresentation(segment.to);
  const fromLabel = fromAnchor?.label ?? fromLocation.label;
  const toLabel = toAnchor?.label ?? toLocation.label;
  const StatusIcon = presentation.icon;
  const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
  const distance = route.result?.totalDistanceMeters ?? route.approximateDistanceMeters;
  const departure =
    seconds === null
      ? null
      : toAnchor
        ? segment.from.endTime
        : Math.max(0, segment.to.startTime - Math.ceil(seconds / 60) - preferences.transitionBufferMinutes);
  const routeWarnings = route.warnings.filter((warning) => warning !== presentation.detail);

  return (
    <section className="surface p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-accent">Selected route</p>
          <h2 className="mt-1.5 truncate font-display text-lg font-semibold tracking-tight">
            {fromLabel} → {toLabel}
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
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
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Your next class is in the same room.</p>
        </div>
      ) : route.status === "unavailable" || seconds === null || distance === null || departure === null ? (
        <div className="mt-4 flex gap-3 rounded-xl border border-accent/25 bg-accent/8 p-3.5">
          <StatusIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{presentation.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{presentation.detail}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric icon={Clock3} label="Walk" value={secondsLabel(seconds)} />
          <Metric icon={Footprints} label="Distance" value={`${route.status === "approximate" ? "~" : ""}${distanceLabel(distance)}`} />
          <Metric icon={LocateFixed} label={toAnchor ? departureMetricLabel(toAnchor.kind) : "Leave by"} value={formatTime(departure)} />
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-muted-foreground">{presentation.detail}</p>
      {routeWarnings.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          {routeWarnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function MobileDayRoute({
  meetings,
  term,
  onTermChange,
  preferences,
  onPreferencesChange,
  planTransition,
  selectedBuildingCode,
  onSelectBuilding,
}: {
  meetings: Meeting[];
  term: Term;
  onTermChange: (term: Term) => void;
  preferences: UserPreferences;
  onPreferencesChange: (preferences: UserPreferences) => void;
  planTransition: TransitionPlanner;
  selectedBuildingCode: string | null;
  onSelectBuilding: (code: string | null) => void;
}) {
  const { routeTargetId, setRouteTargetId } = useMobileRouteTarget();
  const [requestedMeetingId] = useState<string | null>(routeTargetId);
  const [weekday, setWeekday] = useState<Weekday>(() => defaultWeekday(meetings, term, requestedMeetingId));
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(requestedMeetingId);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const availableTerms = useMemo(
    () => TERMS.filter((item) => meetings.some((meeting) => meeting.term === item)),
    [meetings],
  );
  const dayMeetings = useMemo(
    () => meetings.filter((meeting) => meeting.term === term && meeting.weekday === weekday).sort((a, b) => a.startTime - b.startTime),
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
        return { id: `${from.id}--${to.id}`, from, to, route: planTransition(from, to, preferences) };
      }),
    [planTransition, preferences, routeStops],
  );

  useEffect(() => {
    if (routeTargetId !== null) setRouteTargetId(null);
  }, [routeTargetId, setRouteTargetId]);

  useEffect(() => {
    if (!requestedMeetingId) return;
    const target = meetings.find((meeting) => meeting.id === requestedMeetingId && meeting.term === term);
    if (target) setWeekday(target.weekday);
  }, [meetings, requestedMeetingId, term]);

  useEffect(() => {
    const incoming = requestedMeetingId ? segments.find((segment) => segment.to.id === requestedMeetingId) : null;
    if (incoming) {
      setSelectedSegmentId(incoming.id);
      setSelectedMeetingId(null);
      return;
    }
    const target = requestedMeetingId ? dayMeetings.find((meeting) => meeting.id === requestedMeetingId) : null;
    if (target) {
      setSelectedMeetingId(target.id);
      setSelectedSegmentId(null);
      return;
    }
    setSelectedMeetingId(dayMeetings[0]?.id ?? null);
    setSelectedSegmentId(segments[0]?.id ?? null);
  }, [dayMeetings, requestedMeetingId, segments]);

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
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) ?? null;

  if (meetings.length === 0) {
    return (
      <div className="rise-in space-y-3">
        <section className="surface p-4">
          <p className="eyebrow text-accent">UTM campus explorer</p>
          <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.035em]">Explore campus</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Search or tap a mapped building. No timetable is required.
          </p>
        </section>
        <CampusExplorer
          meetings={EMPTY_MEETINGS}
          segments={EMPTY_SEGMENTS}
          selectedMeetingId={null}
          selectedSegmentId={null}
          onSelectMeeting={ignoreMapSelection}
          onSelectSegment={ignoreMapSelection}
          hoveredBuildingCode={null}
          onHoverBuilding={ignoreMapSelection}
          selectedBuildingCode={selectedBuildingCode}
          onSelectBuilding={onSelectBuilding}
          dayAnchor={null}
          className="h-[64dvh] min-h-[27rem] max-h-[40rem]"
        />
      </div>
    );
  }

  return (
    <div className="rise-in space-y-3">
      <section className="surface p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-accent">Campus route</p>
            <h1 className="mt-1 font-display text-xl font-semibold tracking-[-0.035em]">{weekday}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {dayMeetings.length} {dayMeetings.length === 1 ? "class" : "classes"} · time-labelled map
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            className="button-secondary inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-xs font-semibold"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Options
          </button>
        </div>

        {availableTerms.length > 1 ? (
          <div className="mt-3 flex gap-1 rounded-xl border border-border bg-background/45 p-1">
            {availableTerms.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onTermChange(item)}
                aria-pressed={term === item}
                className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-semibold ${
                  term === item ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-2 grid grid-cols-5 gap-1" role="group" aria-label="Route weekday">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={weekday === day}
              onClick={() => setWeekday(day)}
              className={`min-h-11 rounded-lg text-xs font-semibold ${
                weekday === day
                  ? "border border-accent/40 bg-accent/12 text-accent"
                  : "text-muted-foreground"
              }`}
            >
              {DAY_SHORT[day]}
            </button>
          ))}
        </div>
      </section>

      {dayMeetings.length === 0 ? (
        <>
          <section className="surface p-6 text-center">
            <RouteIcon className="mx-auto h-6 w-6 text-accent" aria-hidden="true" />
            <h2 className="mt-3 font-display text-lg font-semibold">No classes on {weekday}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Choose another weekday, or keep exploring the campus map.
            </p>
          </section>
          <CampusExplorer
            meetings={EMPTY_MEETINGS}
            segments={EMPTY_SEGMENTS}
            selectedMeetingId={null}
            selectedSegmentId={null}
            onSelectMeeting={ignoreMapSelection}
            onSelectSegment={ignoreMapSelection}
            hoveredBuildingCode={null}
            onHoverBuilding={ignoreMapSelection}
            selectedBuildingCode={selectedBuildingCode}
            onSelectBuilding={onSelectBuilding}
            dayAnchor={null}
            className="h-[58dvh] min-h-[24rem] max-h-[34rem]"
          />
        </>
      ) : (
        <>
          <CampusExplorer
            meetings={dayMeetings}
            segments={segments}
            selectedMeetingId={selectedMeetingId}
            selectedSegmentId={selectedSegmentId}
            onSelectMeeting={selectMeeting}
            onSelectSegment={selectSegment}
            hoveredBuildingCode={null}
            onHoverBuilding={ignoreMapSelection}
            selectedBuildingCode={selectedBuildingCode}
            onSelectBuilding={onSelectBuilding}
            dayAnchor={dayAnchor}
            className="h-[52dvh] min-h-[22rem] max-h-[36rem]"
          />

          <DayRouteSequence
            routeStops={routeStops}
            segments={segments}
            selectedMeetingId={selectedMeetingId}
            selectedSegmentId={selectedSegmentId}
            onSelectMeeting={selectMeeting}
            onSelectSegment={selectSegment}
          />

          <SegmentSummary segment={selectedSegment} preferences={preferences} />

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
        </>
      )}

      <RouteOptionsDrawer
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        preferences={preferences}
        onPreferencesChange={onPreferencesChange}
      />
    </div>
  );
}

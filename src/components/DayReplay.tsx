import { Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BubbleTabs } from "@/components/BubbleTabs";
import { CampusMap } from "@/components/CampusMap";
import { planGapAssessment } from "@/features/gaps/assess-gap";
import type { GapPreferences } from "@/features/gaps/types";
import {
  buildDayReplaySegments,
  buildDayReplaySnapshot,
  dayReplayBounds,
  dayReplayMeetings,
} from "@/features/replay/day-replay";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import {
  formatCompactDuration,
  formatTime,
  locationLabel,
  type Meeting,
  type Term,
  type Weekday,
  WEEKDAYS,
} from "@/lib/timetable-types";

const PLAYBACK_STEPS = [
  { value: "1", label: "1×", minutes: 5 },
  { value: "2", label: "2×", minutes: 10 },
  { value: "4", label: "4×", minutes: 20 },
] as const;

function statusCopy(
  phase: ReturnType<typeof buildDayReplaySnapshot>["phase"],
  current: Meeting | null,
  next: Meeting | null,
) {
  if (phase === "before") {
    return {
      eyebrow: "Before classes",
      title: next ? `Next: ${next.courseCode}` : "Day starts soon",
      detail: next ? `${formatTime(next.startTime)} · ${locationLabel(next)}` : null,
    };
  }
  if (phase === "class" && current) {
    return {
      eyebrow: "In class",
      title: current.courseCode,
      detail: `${locationLabel(current)} · until ${formatTime(current.endTime)}`,
    };
  }
  if (phase === "after") {
    return { eyebrow: "Day complete", title: "You're done", detail: null };
  }
  return {
    eyebrow: "Between classes",
    title: next ? `Next: ${next.courseCode}` : "Gap",
    detail: next ? `${formatTime(next.startTime)} · ${locationLabel(next)}` : null,
  };
}

export function DayReplay({
  meetings,
  term,
  preferences,
  gapPreferences,
  planTransition,
}: {
  meetings: Meeting[];
  term: Term;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
}) {
  const availableDays = useMemo(
    () => WEEKDAYS.filter((day) => dayReplayMeetings(meetings, term, day).length > 0),
    [meetings, term],
  );
  const [weekday, setWeekday] = useState<Weekday>(availableDays[0] ?? "Monday");
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof PLAYBACK_STEPS)[number]["value"]>("2");
  const [hoveredBuildingCode, setHoveredBuildingCode] = useState<string | null>(null);
  const [selectedBuildingCode, setSelectedBuildingCode] = useState<string | null>(null);

  useEffect(() => {
    if (!availableDays.includes(weekday)) setWeekday(availableDays[0] ?? "Monday");
  }, [availableDays, weekday]);

  const dayMeetings = useMemo(
    () => dayReplayMeetings(meetings, term, weekday),
    [meetings, term, weekday],
  );
  const segments = useMemo(
    () => buildDayReplaySegments(dayMeetings, preferences, planTransition),
    [dayMeetings, planTransition, preferences],
  );
  const bounds = useMemo(() => dayReplayBounds(dayMeetings), [dayMeetings]);

  useEffect(() => {
    setPlaying(false);
    setMinute(bounds?.startMinute ?? 0);
  }, [bounds?.endMinute, bounds?.startMinute, term, weekday]);

  useEffect(() => {
    if (!playing || !bounds) return;
    const step = PLAYBACK_STEPS.find((item) => item.value === speed)?.minutes ?? 10;
    const timer = window.setInterval(() => {
      setMinute((current) => Math.min(bounds.endMinute, current + step));
    }, 360);
    return () => window.clearInterval(timer);
  }, [bounds, playing, speed]);

  useEffect(() => {
    if (playing && bounds && minute >= bounds.endMinute) {
      setPlaying(false);
    }
  }, [bounds, minute, playing]);

  if (!bounds || dayMeetings.length === 0) {
    return (
      <div className="surface p-8 text-center">
        <h2 className="font-display text-xl font-semibold">No replayable classes</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a term and weekday that contains at least one class.
        </p>
      </div>
    );
  }

  const snapshot = buildDayReplaySnapshot(dayMeetings, segments, minute);
  const visibleSegmentIds = new Set(snapshot.visibleSegmentIds);
  const visibleSegments = segments.filter((segment) => visibleSegmentIds.has(segment.id));
  const visibleRouteLineCount = visibleSegments.filter(
    (segment) => segment.route.displayCoordinates.length >= 2,
  ).length;
  const transitionsWithoutMapLine = visibleSegments.length - visibleRouteLineCount;
  const gapPlan = snapshot.gap
    ? planGapAssessment(snapshot.gap, preferences, gapPreferences, planTransition).assessment
    : null;
  const copy = statusCopy(snapshot.phase, snapshot.current, snapshot.next);
  const elapsed = Math.max(0, minute - bounds.startMinute);
  const total = Math.max(1, bounds.endMinute - bounds.startMinute);
  const progress = Math.min(100, (elapsed / total) * 100);

  function jumpToMeeting(id: string) {
    const meeting = dayMeetings.find((item) => item.id === id);
    if (!meeting) return;
    setPlaying(false);
    setMinute(meeting.startTime);
  }

  function jumpToSegment(id: string) {
    const segment = segments.find((item) => item.id === id);
    if (!segment) return;
    setPlaying(false);
    setMinute(segment.from.endTime);
  }

  return (
    <div className="space-y-4">
      <section className="surface overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="eyebrow text-accent">Local schedule simulation</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Replay {weekday}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Watch classes, gaps, and deterministic campus routes unfold without sending your
              timetable to a replay backend.
            </p>
          </div>
          <BubbleTabs
            label="Replay weekday"
            items={availableDays.map((day) => ({
              value: day,
              label: day.slice(0, 3),
              ariaLabel: day,
            }))}
            value={weekday}
            onChange={setWeekday}
            compact
            className="w-full lg:w-auto"
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.55fr)]">
        <section className="surface flex min-h-[28rem] flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-accent">
                {copy.eyebrow}
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
                {formatTime(minute)}
              </p>
            </div>
            <span className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <h3 className="font-display text-xl font-semibold tracking-tight">{copy.title}</h3>
            {copy.detail ? (
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{copy.detail}</p>
            ) : null}
          </div>

          {gapPlan ? (
            <div className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.05] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-accent">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Gapwise plan
              </p>
              <p className="mt-2 font-semibold">{gapPlan.primary.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {formatCompactDuration(gapPlan.primary.activityMinutes)} usable · leave by{" "}
                {formatTime(gapPlan.leaveByMinutes)} · {Math.round(gapPlan.confidence * 100)}%
                confidence
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Route: {gapPlan.routeAccuracy}
              </p>
            </div>
          ) : null}

          <ol className="mt-5 flex-1 space-y-1.5" aria-label={`${weekday} replay timeline`}>
            {dayMeetings.map((meeting) => {
              const active = snapshot.current?.id === meeting.id;
              const passed = meeting.endTime <= minute;
              return (
                <li key={meeting.id}>
                  <button
                    type="button"
                    onClick={() => jumpToMeeting(meeting.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-accent/45 bg-accent/10"
                        : "border-border bg-background/45 hover:border-accent/30"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {meeting.courseCode}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {formatTime(meeting.startTime)} · {locationLabel(meeting)}
                      </span>
                    </span>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        active ? "bg-accent" : passed ? "bg-muted-foreground/45" : "bg-border"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 border-t border-border pt-4">
            <input
              aria-label="Replay time"
              type="range"
              min={bounds.startMinute}
              max={bounds.endMinute}
              step={1}
              value={minute}
              onChange={(event) => {
                setPlaying(false);
                setMinute(Number(event.target.value));
              }}
              className="w-full accent-[var(--color-accent)]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaying((value) => !value)}
                className="button-primary inline-flex min-h-10 items-center gap-2 px-4 text-sm font-semibold"
              >
                {playing ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
                {playing ? "Pause" : "Play day"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setMinute(bounds.startMinute);
                }}
                aria-label="Restart day replay"
                className="button-secondary inline-flex h-10 w-10 items-center justify-center"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <BubbleTabs
                label="Playback speed"
                items={PLAYBACK_STEPS.map((item) => ({ value: item.value, label: item.label }))}
                value={speed}
                onChange={setSpeed}
                compact
                className="ml-auto w-44"
              />
            </div>
          </div>
        </section>

        <section className="surface overflow-hidden p-2 sm:p-3">
          <CampusMap
            meetings={dayMeetings}
            segments={visibleSegments}
            selectedMeetingId={snapshot.selectedMeetingId}
            selectedSegmentId={snapshot.selectedSegmentId}
            onSelectMeeting={jumpToMeeting}
            onSelectSegment={jumpToSegment}
            hoveredBuildingCode={hoveredBuildingCode}
            onHoverBuilding={setHoveredBuildingCode}
            selectedBuildingCode={selectedBuildingCode}
            onSelectBuilding={setSelectedBuildingCode}
            dayAnchor={null}
            className="h-[55dvh] min-h-[28rem] max-h-[42rem]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-3 text-xs text-muted-foreground">
            <span>
              {visibleRouteLineCount} route line{visibleRouteLineCount === 1 ? "" : "s"} visible
              {transitionsWithoutMapLine > 0 ? (
                <>
                  {" "}· {transitionsWithoutMapLine} transition
                  {transitionsWithoutMapLine === 1 ? "" : "s"} without a map line
                </>
              ) : null}
            </span>
            <span>Map and replay run in your browser</span>
          </div>
        </section>
      </div>
    </div>
  );
}

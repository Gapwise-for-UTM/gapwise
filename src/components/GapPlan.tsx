import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Clock,
  Coffee,
  Home,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { assessGap } from "@/features/gaps/assess-gap";
import {
  DEFAULT_GAP_PREFERENCES,
  loadGapPreferences,
  sanitizeGapPreferences,
  saveGapPreferences,
} from "@/features/gaps/preferences";
import type {
  GapAction,
  GapAssessment,
  GapPreferences,
  GapTimelineKind,
} from "@/features/gaps/types";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import { groupGapsByDay } from "@/lib/gaps";
import type { Gap } from "@/lib/timetable-types";
import { formatDuration, formatTime, locationLabel } from "@/lib/timetable-types";

const ACTION_META: Record<GapAction, { label: string; icon: LucideIcon; style: string }> = {
  "tight-transition": {
    label: "Tight transition",
    icon: ArrowRight,
    style: "bg-muted text-muted-foreground",
  },
  "quick-reset": {
    label: "Quick reset",
    icon: Coffee,
    style: "bg-tut/15 text-tut",
  },
  "focus-sprint": {
    label: "Focus sprint",
    icon: Brain,
    style: "bg-lec/15 text-lec",
  },
  "meal-window": {
    label: "Meal window",
    icon: Utensils,
    style: "bg-tut/15 text-tut",
  },
  "study-block": {
    label: "Study block",
    icon: Brain,
    style: "bg-lec/15 text-lec",
  },
  "deep-work-block": {
    label: "Deep work",
    icon: Sparkles,
    style: "bg-lec/15 text-lec",
  },
  "flexible-long-gap": {
    label: "Flexible block",
    icon: Sparkles,
    style: "bg-pra/15 text-pra",
  },
  "leave-campus-candidate": {
    label: "Leave campus",
    icon: Home,
    style: "bg-pra/15 text-pra",
  },
  "location-dependent": {
    label: "Location dependent",
    icon: AlertTriangle,
    style: "bg-accent/15 text-accent",
  },
};

const CONFIDENCE_STYLES = {
  high: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-destructive/25 bg-destructive/10 text-destructive",
} as const;

const TIMELINE_STYLES: Record<GapTimelineKind, string> = {
  setup: "bg-muted-foreground/35",
  activity: "bg-accent",
  travel: "bg-primary/75",
  buffer: "bg-pra/70",
  flex: "bg-secondary",
};

function minutesToTimeInput(minutes: number) {
  const normalized = Math.min(24 * 60 - 1, Math.max(0, Math.round(minutes)));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function timeInputToMinutes(value: string, fallback: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

function numericInput(value: string, fallback: number, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

const GapSettings = memo(function GapSettings({
  value,
  onChange,
}: {
  value: GapPreferences;
  onChange: (next: GapPreferences) => void;
}) {
  function update(patch: Partial<GapPreferences>) {
    onChange(sanitizeGapPreferences({ ...value, ...patch }));
  }

  return (
    <details className="surface group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-accent" aria-hidden="true" />
          Tune gap recommendations
        </span>
        <span className="text-xs text-muted-foreground group-open:hidden">
          Meals, commute, setup time
        </span>
      </summary>

      <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Lunch window starts</span>
          <input
            type="time"
            value={minutesToTimeInput(value.lunchWindowStart)}
            onChange={(event) =>
              update({
                lunchWindowStart: timeInputToMinutes(event.target.value, value.lunchWindowStart),
              })
            }
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Lunch window ends</span>
          <input
            type="time"
            value={minutesToTimeInput(value.lunchWindowEnd)}
            onChange={(event) =>
              update({
                lunchWindowEnd: timeInputToMinutes(event.target.value, value.lunchWindowEnd),
              })
            }
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Meal target</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={15}
              max={90}
              step={5}
              value={value.mealDurationMinutes}
              onChange={(event) =>
                update({
                  mealDurationMinutes: numericInput(
                    event.target.value,
                    value.mealDurationMinutes,
                    15,
                    90,
                  ),
                })
              }
              className="w-full rounded-xl border border-input bg-background px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </span>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Settle-in time</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={20}
              value={value.setupMinutes}
              onChange={(event) =>
                update({
                  setupMinutes: numericInput(event.target.value, value.setupMinutes, 0, 20),
                })
              }
              className="w-full rounded-xl border border-input bg-background px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </span>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Pack-up time</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={20}
              value={value.packUpMinutes}
              onChange={(event) =>
                update({
                  packUpMinutes: numericInput(event.target.value, value.packUpMinutes, 0, 20),
                })
              }
              className="w-full rounded-xl border border-input bg-background px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </span>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Planning style</span>
          <select
            value={value.riskTolerance}
            onChange={(event) =>
              update({ riskTolerance: event.target.value as GapPreferences["riskTolerance"] })
            }
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="low">Conservative</option>
            <option value="medium">Balanced</option>
            <option value="high">Optimistic</option>
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-secondary/35 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={value.willingToLeaveCampus}
            onChange={(event) => update({ willingToLeaveCampus: event.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            <span className="font-medium">Consider going home during long gaps</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Gapwise only recommends it when the round trip still leaves your minimum worthwhile
              time at home.
            </span>
          </span>
        </label>

        {value.willingToLeaveCampus ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">One-way commute</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={180}
                  placeholder="e.g. 50"
                  value={value.oneWayHomeCommuteMinutes ?? ""}
                  onChange={(event) =>
                    update({
                      oneWayHomeCommuteMinutes:
                        event.target.value.trim() === ""
                          ? null
                          : numericInput(
                              event.target.value,
                              value.oneWayHomeCommuteMinutes ?? 45,
                              5,
                              180,
                            ),
                    })
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </span>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Minimum worthwhile stay</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={30}
                  max={360}
                  step={15}
                  value={value.minimumHomeStayMinutes}
                  onChange={(event) =>
                    update({
                      minimumHomeStayMinutes: numericInput(
                        event.target.value,
                        value.minimumHomeStayMinutes,
                        30,
                        360,
                      ),
                    })
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </span>
            </label>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_GAP_PREFERENCES)}
        className="mt-4 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Reset recommendation settings
      </button>
    </details>
  );
});

function Timeline({ assessment }: { assessment: GapAssessment }) {
  const total = assessment.primary.timeline.reduce((sum, segment) => sum + segment.minutes, 0);
  if (total <= 0) return null;

  return (
    <div className="mt-4">
      <div
        className="flex h-3 overflow-hidden rounded-full bg-secondary"
        aria-label="Recommended gap timeline"
      >
        {assessment.primary.timeline.map((segment, index) => (
          <span
            key={`${segment.label}-${index}`}
            className={`${TIMELINE_STYLES[segment.kind]} min-w-[3px]`}
            style={{ width: `${(segment.minutes / total) * 100}%` }}
            title={`${segment.label}: ${formatDuration(segment.minutes)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-muted-foreground">
        {assessment.primary.timeline.map((segment, index) => (
          <span
            key={`${segment.kind}-${segment.label}-${index}`}
            className="inline-flex items-center gap-1.5"
          >
            <span className={`h-2 w-2 rounded-full ${TIMELINE_STYLES[segment.kind]}`} />
            {segment.label} · {formatDuration(segment.minutes)}
          </span>
        ))}
      </div>
    </div>
  );
}

const GapCard = memo(function GapCard({
  gap,
  preferences,
  gapPreferences,
  planTransition,
}: {
  gap: Gap;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
}) {
  const { route, assessment } = useMemo(() => {
    const route = planTransition(gap.previous, gap.next, preferences);
    return {
      route,
      assessment: assessGap({
        gap,
        route,
        routePreferences: preferences,
        gapPreferences,
      }),
    };
  }, [gap, gapPreferences, planTransition, preferences]);

  const meta = ACTION_META[assessment.primary.action];
  const ActionIcon = meta.icon;

  return (
    <article className="surface overflow-hidden p-0">
      <div className="border-b border-border bg-secondary/25 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
            {formatTime(gap.startTime)} – {formatTime(gap.endTime)}
          </p>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${CONFIDENCE_STYLES[assessment.confidenceLabel]}`}
            title={`${Math.round(assessment.confidence * 100)}% recommendation confidence`}
          >
            {assessment.confidenceLabel} confidence
          </span>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.style}`}
          >
            <ActionIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Best use · {meta.label}
            </p>
            <h4 className="mt-1 font-display text-lg font-semibold leading-tight tracking-tight">
              {assessment.primary.title}
            </h4>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {assessment.primary.summary}
            </p>
          </div>
        </div>

        <Timeline assessment={assessment} />
      </div>

      <div className="p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total gap</dt>
            <dd className="mt-0.5 font-semibold">{formatDuration(gap.durationMinutes)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Activity time</dt>
            <dd className="mt-0.5 font-semibold">
              {formatDuration(assessment.primary.activityMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Travel</dt>
            <dd className="mt-0.5 font-semibold">
              {assessment.travelMinutes === null
                ? "Unknown"
                : formatDuration(assessment.travelMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Leave by</dt>
            <dd className="mt-0.5 font-semibold">{formatTime(assessment.leaveByMinutes)}</dd>
          </div>
        </dl>

        <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Why this recommendation
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {assessment.primary.reasons.slice(0, 3).map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {assessment.alternatives.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Other sensible options
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {assessment.alternatives.map((alternative) => {
                const alternativeMeta = ACTION_META[alternative.action];
                return (
                  <div key={alternative.id} className="rounded-xl border border-border p-3">
                    <p className="text-xs font-semibold text-foreground">{alternative.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {alternative.summary}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${alternativeMeta.style}`}
                    >
                      {alternativeMeta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {assessment.warnings.length > 0 ? (
          <details className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-amber-800 dark:text-amber-300">
              {assessment.warnings.length} uncertainty note
              {assessment.warnings.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
              {assessment.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              <span className="text-muted-foreground">After </span>
              {gap.previous.courseCode} {gap.previous.activityType} · {locationLabel(gap.previous)}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ArrowRight
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              <span className="text-muted-foreground">Before </span>
              {gap.next.courseCode} {gap.next.activityType} · {locationLabel(gap.next)}
            </span>
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {route.accuracy}
            {assessment.arrivalMinutes === null
              ? " · Arrival time cannot be verified."
              : ` · Estimated arrival ${formatTime(assessment.arrivalMinutes)}.`}
          </p>
        </div>
      </div>
    </article>
  );
});

export const GapPlan = memo(function GapPlan({
  gaps,
  preferences,
  planTransition,
}: {
  gaps: Gap[];
  preferences: UserPreferences;
  planTransition: TransitionPlanner;
}) {
  const groups = useMemo(() => groupGapsByDay(gaps), [gaps]);
  const [gapPreferences, setGapPreferences] = useState<GapPreferences>(DEFAULT_GAP_PREFERENCES);

  useEffect(() => {
    setGapPreferences(loadGapPreferences());
  }, []);

  function updateGapPreferences(next: GapPreferences) {
    const sanitized = sanitizeGapPreferences(next);
    setGapPreferences(sanitized);
    saveGapPreferences(sanitized);
  }

  if (groups.length === 0) {
    return (
      <div className="surface p-8 text-center">
        <h3 className="text-lg font-semibold">No gaps in this term</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your classes run back to back, or you only have one meeting per day.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
          Intelligent gap planning
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Recommendations use real or estimated travel, transition risk, setup time, meal timing,
          location certainty, and your commute preferences—not just the raw gap length.
        </p>
      </div>

      <GapSettings value={gapPreferences} onChange={updateGapPreferences} />

      {groups.map((group) => (
        <section key={group.weekday} aria-labelledby={`gaps-${group.weekday}`}>
          <h3 id={`gaps-${group.weekday}`} className="text-base font-semibold">
            {group.weekday}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {group.gaps.length} gap{group.gaps.length === 1 ? "" : "s"}
            </span>
          </h3>
          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            {group.gaps.map((gap) => (
              <GapCard
                key={gap.id}
                gap={gap}
                preferences={preferences}
                gapPreferences={gapPreferences}
                planTransition={planTransition}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});

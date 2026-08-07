import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Clock,
  Coffee,
  Home,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { planGapAssessment } from "@/features/gaps/assess-gap";
import { DEFAULT_GAP_PREFERENCES, sanitizeGapPreferences } from "@/features/gaps/preferences";
import type { GapAction, GapPreferences, GapRecommendation } from "@/features/gaps/types";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import { groupGapsByDay } from "@/lib/gaps";
import type { Gap } from "@/lib/timetable-types";
import {
  formatCompactDuration,
  formatDuration,
  formatTime,
  locationLabel,
} from "@/lib/timetable-types";

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

function actionChipLabel(recommendation: GapRecommendation) {
  switch (recommendation.action) {
    case "meal-window":
      return "Eat";
    case "leave-campus-candidate":
      return "Leave campus";
    case "quick-reset":
      return "Take a break";
    case "tight-transition":
      return "Head to class";
    case "location-dependent":
      return "Stay flexible";
    default:
      return "Study";
  }
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
  const { route, assessment } = useMemo(
    () => planGapAssessment(gap, preferences, gapPreferences, planTransition),
    [gap, gapPreferences, planTransition, preferences],
  );
  const [selectedRecommendationId, setSelectedRecommendationId] = useState(assessment.primary.id);
  const recommendations = useMemo(() => {
    const uniqueLabels = new Set<string>();
    return [assessment.primary, ...assessment.alternatives].filter((recommendation) => {
      const label = actionChipLabel(recommendation);
      if (uniqueLabels.has(label)) return false;
      uniqueLabels.add(label);
      return true;
    });
  }, [assessment]);
  const selected =
    recommendations.find((item) => item.id === selectedRecommendationId) ?? assessment.primary;
  const meta = ACTION_META[selected.action];
  const ActionIcon = meta.icon;
  const travelCopy =
    assessment.travelMinutes === null
      ? "Travel time unavailable"
      : assessment.routeStatus === "same-room"
        ? "Same room"
        : `~${assessment.travelMinutes} min walk`;
  const routeNote =
    assessment.routeStatus === "approximate"
      ? "Route estimate"
      : assessment.routeStatus === "unavailable"
        ? "Timing includes a conservative transition allowance"
        : route.warnings.some((warning) => /indoor room routing/i.test(warning))
          ? "Indoor path not mapped yet"
          : null;

  return (
    <article className="surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
          {formatTime(gap.startTime)} – {formatTime(gap.endTime)}
        </p>
        <span className="text-sm font-semibold text-muted-foreground">
          {formatCompactDuration(gap.durationMinutes)}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-2.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.style}`}
        >
          <ActionIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h4 className="font-display text-base font-semibold leading-tight">{selected.title}</h4>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {formatCompactDuration(selected.activityMinutes)} usable
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selected.summary}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-secondary/25 px-3 py-2.5 text-sm">
        <p className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{locationLabel(gap.previous)}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{locationLabel(gap.next)}</span>
        </p>
        <p className="mt-1 pl-6 text-xs text-muted-foreground">
          {travelCopy} · leave by {formatTime(assessment.leaveByMinutes)}
        </p>
        {routeNote ? (
          <p className="mt-0.5 pl-6 text-xs text-muted-foreground">{routeNote}</p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {recommendations.map((recommendation) => {
          const selectedOption = selected.id === recommendation.id;
          return (
            <button
              key={recommendation.id}
              type="button"
              aria-pressed={selectedOption}
              onClick={() => setSelectedRecommendationId(recommendation.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                selectedOption
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-input text-muted-foreground hover:border-accent/60 hover:text-foreground"
              }`}
            >
              {actionChipLabel(recommendation)}
            </button>
          );
        })}
      </div>

      <details className="group mt-3 text-xs">
        <summary className="ml-auto w-fit cursor-pointer rounded-full border border-input px-3 py-1 font-semibold text-muted-foreground hover:border-accent/60 hover:text-foreground">
          Details
        </summary>
        <div className="mt-3 rounded-lg border border-border bg-background/45 p-3 text-muted-foreground">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
            <div>
              <dt>Raw gap</dt>
              <dd className="font-semibold text-foreground">
                {formatDuration(gap.durationMinutes)}
              </dd>
            </div>
            <div>
              <dt>Travel</dt>
              <dd className="font-semibold text-foreground">
                {assessment.travelMinutes === null
                  ? "Unavailable"
                  : formatDuration(assessment.travelMinutes)}
              </dd>
            </div>
            <div>
              <dt>Transition buffer</dt>
              <dd className="font-semibold text-foreground">
                {formatDuration(assessment.bufferMinutes)}
              </dd>
            </div>
            <div>
              <dt>Setup + pack-up</dt>
              <dd className="font-semibold text-foreground">
                {formatDuration(gapPreferences.setupMinutes + gapPreferences.packUpMinutes)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-border pt-3">{route.accuracy}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {selected.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
            {assessment.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      </details>
    </article>
  );
});

export const GapPlan = memo(function GapPlan({
  gaps,
  preferences,
  gapPreferences,
  onGapPreferencesChange,
  planTransition,
}: {
  gaps: Gap[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  onGapPreferencesChange: (next: GapPreferences) => void;
  planTransition: TransitionPlanner;
}) {
  const groups = useMemo(() => groupGapsByDay(gaps), [gaps]);

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
      <GapSettings value={gapPreferences} onChange={onGapPreferencesChange} />

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

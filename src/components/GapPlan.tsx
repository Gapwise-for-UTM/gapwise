import type { User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Clock,
  Coffee,
  Home,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  Users,
  type LucideIcon,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { FriendOverlapPanel } from "@/features/friends/FriendOverlapPanel";
import type { FriendGapOverlap } from "@/features/friends/types";
import { planGapAssessment } from "@/features/gaps/assess-gap";
import { DEFAULT_GAP_PREFERENCES, sanitizeGapPreferences } from "@/features/gaps/preferences";
import type { GapAction, GapPreferences, GapRecommendation } from "@/features/gaps/types";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import { selectedResidence } from "@/features/routing/residence";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { TransitionRoute } from "@/features/routing/types";
import type { UserPreferences } from "@/features/sync/preferences";
import { groupGapsByDay } from "@/lib/gaps";
import type { Gap, Term } from "@/lib/timetable-types";
import { formatCompactDuration, formatDuration, formatTime } from "@/lib/timetable-types";

const EMPTY_FRIEND_OVERLAPS: FriendGapOverlap[] = [];

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
  "go-home": {
    label: "Go home",
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

function transitionMinutes(route: TransitionRoute) {
  const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
  return seconds === null ? null : Math.ceil(seconds / 60);
}

const GapSettings = memo(function GapSettings({
  value,
  onChange,
  residenceName,
}: {
  value: GapPreferences;
  onChange: (next: GapPreferences) => void;
  residenceName: string | null;
}) {
  function update(patch: Partial<GapPreferences>) {
    onChange(sanitizeGapPreferences({ ...value, ...patch }));
  }

  return (
    <details className="surface group p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-accent" aria-hidden="true" />
          Tune gap recommendations
        </span>
        <span className="text-xs text-muted-foreground group-open:hidden">
          {residenceName ? "Meals, home routes, setup time" : "Meals, commute, setup time"}
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

      {residenceName ? (
        <div className="mt-4 rounded-xl border border-accent/25 bg-accent/8 p-4">
          <div className="flex items-start gap-3">
            <Home className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Home routes use {residenceName}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Gapwise checks the actual walk home and back before suggesting it.
              </p>
            </div>
          </div>
          <label className="mt-4 block space-y-1.5 text-sm">
            <span className="font-medium">Minimum worthwhile stay</span>
            <span className="flex items-center gap-2 sm:max-w-xs">
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
      ) : (
        <div className="mt-4 rounded-xl border border-border bg-secondary/35 p-4">
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
      )}

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
    case "go-home":
      return "Go home";
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
  friendOverlaps,
}: {
  gap: Gap;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
  friendOverlaps: FriendGapOverlap[];
}) {
  const { route, assessment, residenceTrip } = useMemo(
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
  const routePresentation = getLocationPresentation({
    from: gap.previous,
    to: gap.next,
    route,
  });
  const previousLocation = getLocationPresentation({ meeting: gap.previous });
  const nextLocation = getLocationPresentation({ meeting: gap.next });
  const RouteStatusIcon = routePresentation.icon;
  const travelCopy =
    assessment.travelMinutes === null
      ? routePresentation.label
      : assessment.routeStatus === "same-room"
        ? routePresentation.label
        : `~${assessment.travelMinutes} min walk`;
  const routeNote = routePresentation.status === "known" ? null : routePresentation.detail;
  const homeOutboundMinutes = residenceTrip ? transitionMinutes(residenceTrip.outbound) : null;
  const homeInboundMinutes = residenceTrip ? transitionMinutes(residenceTrip.inbound) : null;
  const showingHomeRoute =
    selected.action === "go-home" &&
    residenceTrip !== undefined &&
    homeOutboundMinutes !== null &&
    homeInboundMinutes !== null;
  const detailMessages = [
    ...new Set(
      [...selected.reasons, ...assessment.warnings].map((message) =>
        message === route.accuracy ? routePresentation.detail : message,
      ),
    ),
  ];

  return (
    <article className="surface surface-interactive p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-xs font-medium tabular-nums text-muted-foreground">
          <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
          {formatTime(gap.startTime)} – {formatTime(gap.endTime)}
        </p>
        <span className="font-mono text-xs font-medium text-muted-foreground">
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
          <h4 className="font-display text-lg font-medium leading-tight tracking-tight">
            {selected.title}
          </h4>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {formatCompactDuration(selected.activityMinutes)} usable
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selected.summary}</p>
        </div>
      </div>

      {friendOverlaps.length > 0 ? (
        <div className="mt-4 rounded-lg border border-accent/25 bg-accent/8 px-3 py-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-accent">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Mutual friend availability
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {friendOverlaps.map((overlap) => (
              <li key={`${overlap.friendshipId}-${overlap.startMinute}-${overlap.endMinute}`}>
                {overlap.friendDisplayName} · {formatTime(overlap.startMinute)}–
                {formatTime(overlap.endMinute)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-border bg-secondary/25 px-3 py-3 text-sm">
        {showingHomeRoute ? (
          <>
            <p className="flex min-w-0 items-center gap-2">
              <Home className="h-4 w-4 shrink-0 text-pra" aria-hidden="true" />
              <span className="truncate">{previousLocation.label}</span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate">{residenceTrip.buildingName}</span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate">{nextLocation.label}</span>
            </p>
            <p className="mt-1 pl-6 text-xs text-muted-foreground">
              ~{homeOutboundMinutes + homeInboundMinutes} min round trip · leave home by{" "}
              {formatTime(gap.next.startTime - homeInboundMinutes - assessment.bufferMinutes)}
            </p>
          </>
        ) : (
          <>
            <p className="flex min-w-0 items-center gap-2">
              <RouteStatusIcon
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate">{previousLocation.label}</span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate">{nextLocation.label}</span>
            </p>
            <p className="mt-1 pl-6 text-xs text-muted-foreground">
              {travelCopy} · leave by {formatTime(assessment.leaveByMinutes)}
            </p>
            {routeNote ? (
              <p className="mt-0.5 pl-6 text-xs text-muted-foreground">{routeNote}</p>
            ) : null}
          </>
        )}
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
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                selectedOption
                  ? "border-primary bg-primary text-primary-foreground shadow-[var(--accent-glow)]"
                  : "border-input bg-card text-muted-foreground hover:border-accent/50 hover:bg-secondary hover:text-foreground"
              }`}
            >
              {actionChipLabel(recommendation)}
            </button>
          );
        })}
      </div>

      <details className="group mt-3 text-xs">
        <summary className="ml-auto w-fit cursor-pointer rounded-lg border border-input px-3 py-1 font-semibold text-muted-foreground hover:border-accent/60 hover:text-foreground">
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
                  ? routePresentation.label
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
          <p className="mt-3 border-t border-border pt-3">{routePresentation.detail}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {detailMessages.map((message) => (
              <li key={message}>{message}</li>
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
  user,
  term,
}: {
  gaps: Gap[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  onGapPreferencesChange: (next: GapPreferences) => void;
  planTransition: TransitionPlanner;
  user: User | null;
  term: Term;
}) {
  const groups = useMemo(() => groupGapsByDay(gaps), [gaps]);
  const residence = selectedResidence(preferences);
  const [friendOverlapState, setFriendOverlapState] = useState<{
    userId: string | null;
    overlaps: FriendGapOverlap[];
  }>({ userId: null, overlaps: [] });
  const userId = user?.id ?? null;
  const handleFriendOverlapsChange = useCallback(
    (overlaps: FriendGapOverlap[]) => setFriendOverlapState({ userId, overlaps }),
    [userId],
  );
  const friendOverlapsByGapId = useMemo(() => {
    const friendOverlaps =
      friendOverlapState.userId === userId ? friendOverlapState.overlaps : EMPTY_FRIEND_OVERLAPS;
    const overlapsByGap = new Map<string, FriendGapOverlap[]>();
    for (const gap of gaps) {
      const matches = friendOverlaps.filter(
        (overlap) =>
          overlap.term === gap.term &&
          overlap.weekday === gap.weekday &&
          overlap.startMinute >= gap.startTime &&
          overlap.endMinute <= gap.endTime,
      );
      overlapsByGap.set(gap.id, matches.length > 0 ? matches : EMPTY_FRIEND_OVERLAPS);
    }
    return overlapsByGap;
  }, [friendOverlapState, gaps, userId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-accent">Between classes</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight">Plan around your day</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Suggestions account for walking time, setup, pack-up, and your next class.
        </p>
      </div>
      <GapSettings
        value={gapPreferences}
        onChange={onGapPreferencesChange}
        residenceName={residence?.name ?? null}
      />

      <FriendOverlapPanel
        key={userId ?? "guest"}
        user={user}
        term={term}
        onOverlapsChange={handleFriendOverlapsChange}
      />

      {groups.length === 0 ? (
        <div className="surface p-8 text-center">
          <h3 className="text-lg font-semibold">No gaps in this term</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Your classes run back to back, or you only have one meeting per day.
          </p>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.weekday} aria-labelledby={`gaps-${group.weekday}`}>
          <h3 id={`gaps-${group.weekday}`} className="text-base font-medium tracking-tight">
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
                friendOverlaps={friendOverlapsByGapId.get(gap.id) ?? EMPTY_FRIEND_OVERLAPS}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});

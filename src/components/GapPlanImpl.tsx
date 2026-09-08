import type { User } from "@supabase/supabase-js";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock3,
  Coffee,
  Home,
  MapPin,
  Route,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  Users,
  type LucideIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FriendOverlapPanel } from "@/features/friends/FriendOverlapPanel";
import type { FriendGapOverlap } from "@/features/friends/types";
import { planGapAssessment } from "@/features/gaps/assess-gap";
import { DEFAULT_GAP_PREFERENCES, sanitizeGapPreferences } from "@/features/gaps/preferences";
import type { GapAction, GapPreferences } from "@/features/gaps/types";
import {
  clearQueuedGapPlanSelection,
  peekQueuedGapPlanSelection,
  subscribeGapPlanSelection,
} from "@/features/gaps/selection";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import { selectedResidence } from "@/features/routing/residence";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import { groupGapsByDay } from "@/lib/gaps";
import type { Gap, Term } from "@/lib/timetable-types";
import { formatCompactDuration, formatDuration, formatTime } from "@/lib/timetable-types";

const EMPTY_FRIEND_OVERLAPS: FriendGapOverlap[] = [];
type GapPlanOverlay = "tune" | "friends" | null;
type GapAssessmentResult = ReturnType<typeof planGapAssessment>;

const ACTION_META: Record<GapAction, { label: string; icon: LucideIcon }> = {
  "tight-transition": { label: "Head to class", icon: ArrowRight },
  "quick-reset": { label: "Take a break", icon: Coffee },
  "focus-sprint": { label: "Focus sprint", icon: Brain },
  "meal-window": { label: "Eat", icon: Utensils },
  "study-block": { label: "Study", icon: Brain },
  "deep-work-block": { label: "Deep work", icon: Sparkles },
  "flexible-long-gap": { label: "Flexible", icon: Sparkles },
  "leave-campus-candidate": { label: "Leave campus", icon: Home },
  "go-home": { label: "Go home", icon: Home },
  "location-dependent": { label: "Stay flexible", icon: MapPin },
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

function recommendationsFor(result: GapAssessmentResult) {
  const seen = new Set<string>();
  return [result.assessment.primary, ...result.assessment.alternatives].filter((item) => {
    const label = ACTION_META[item.action].label;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

function TunePanel({
  value,
  onChange,
  residenceName,
}: {
  value: GapPreferences;
  onChange: (next: GapPreferences) => void;
  residenceName: string | null;
}) {
  const update = (patch: Partial<GapPreferences>) =>
    onChange(sanitizeGapPreferences({ ...value, ...patch }));

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Lunch starts</span>
          <input
            type="time"
            value={minutesToTimeInput(value.lunchWindowStart)}
            onChange={(event) =>
              update({
                lunchWindowStart: timeInputToMinutes(event.target.value, value.lunchWindowStart),
              })
            }
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Lunch ends</span>
          <input
            type="time"
            value={minutesToTimeInput(value.lunchWindowEnd)}
            onChange={(event) =>
              update({
                lunchWindowEnd: timeInputToMinutes(event.target.value, value.lunchWindowEnd),
              })
            }
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Meal target</span>
          <div className="flex items-center gap-2">
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
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Planning style</span>
          <select
            value={value.riskTolerance}
            onChange={(event) =>
              update({ riskTolerance: event.target.value as GapPreferences["riskTolerance"] })
            }
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
          >
            <option value="low">Conservative</option>
            <option value="medium">Balanced</option>
            <option value="high">Optimistic</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Settle-in time</span>
          <div className="flex items-center gap-2">
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
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Pack-up time</span>
          <div className="flex items-center gap-2">
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
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </label>
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={value.willingToLeaveCampus}
            onChange={(event) => update({ willingToLeaveCampus: event.target.checked })}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium">Consider going home during long gaps</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {residenceName
                ? `Gapwise uses the route to ${residenceName} and back.`
                : "Add a commute estimate when a residence route is unavailable."}
            </span>
          </span>
        </label>
        {value.willingToLeaveCampus && !residenceName ? (
          <label className="mt-4 block space-y-1.5 text-sm sm:max-w-xs">
            <span className="font-medium">One-way commute</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={180}
                placeholder="45"
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
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </label>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_GAP_PREFERENCES)}
        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Reset recommendations
      </button>
    </div>
  );
}

function GapOption({
  gap,
  result,
  selected,
  onSelect,
}: {
  gap: Gap;
  result: GapAssessmentResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const recommendation = result.assessment.primary;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`min-w-0 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-accent/55 bg-accent/8"
          : "border-border bg-card hover:border-accent/30 hover:bg-secondary/30"
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold">
          {formatTime(gap.startTime)}–{formatTime(gap.endTime)}
        </span>
        <span className="shrink-0 text-[0.68rem] font-semibold text-muted-foreground">
          {formatCompactDuration(gap.durationMinutes)}
        </span>
      </div>
      <p className="mt-2 line-clamp-1 text-xs font-medium text-foreground">
        {recommendation.title}
      </p>
      <p className="mt-1 text-[0.68rem] text-muted-foreground">
        {formatCompactDuration(recommendation.activityMinutes)} usable
      </p>
    </button>
  );
}

function GapInspector({
  gap,
  result,
  friendOverlaps,
  selectedRecommendationId,
  onRecommendationChange,
  onOpenFriends,
}: {
  gap: Gap;
  result: GapAssessmentResult;
  friendOverlaps: FriendGapOverlap[];
  selectedRecommendationId: string | null;
  onRecommendationChange: (id: string) => void;
  onOpenFriends: () => void;
}) {
  const recommendations = recommendationsFor(result);
  const selected =
    recommendations.find((item) => item.id === selectedRecommendationId) ??
    result.assessment.primary;
  const meta = ACTION_META[selected.action];
  const ActionIcon = meta.icon;
  const previousLocation = getLocationPresentation({ meeting: gap.previous });
  const nextLocation = getLocationPresentation({ meeting: gap.next });
  const routePresentation = getLocationPresentation({
    from: gap.previous,
    to: gap.next,
    route: result.route,
  });
  const RouteIcon = routePresentation.icon;
  const usablePercent = Math.min(
    100,
    (selected.activityMinutes / Math.max(1, gap.durationMinutes)) * 100,
  );

  return (
    <div className="mt-3 min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/8 text-accent">
              <ActionIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
                Recommended
              </p>
              <h4 className="mt-1 text-balance font-display text-xl font-medium tracking-tight">
                {selected.title}
              </h4>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {selected.summary}
              </p>
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${usablePercent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{formatDuration(selected.activityMinutes)} usable</span>
            <span>{formatDuration(result.assessment.bufferMinutes)} buffer</span>
            <span>
              {result.assessment.travelMinutes === null
                ? routePresentation.label
                : `${result.assessment.travelMinutes} min travel`}
            </span>
          </div>

          {recommendations.length > 1 ? (
            <div className="mt-4 flex min-w-0 flex-wrap gap-2">
              {recommendations.map((recommendation) => {
                const active = recommendation.id === selected.id;
                return (
                  <button
                    key={recommendation.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onRecommendationChange(recommendation.id)}
                    className={`max-w-full rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                      active
                        ? "border-accent/55 bg-accent/9 text-foreground"
                        : "border-input bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {ACTION_META[recommendation.action].label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {selected.reasons.length > 0 ? (
            <details className="mt-4 border-t border-border pt-3 text-xs">
              <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                Why this fits
              </summary>
              <ul className="mt-2 space-y-1.5 text-muted-foreground">
                {selected.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                      aria-hidden="true"
                    />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <aside className="min-w-0 rounded-lg border border-border bg-background/45 p-3.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Route className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Transition
          </p>
          <div className="mt-3 space-y-3 text-xs">
            <div className="min-w-0">
              <p className="text-muted-foreground">From</p>
              <p className="mt-0.5 break-words font-medium">{previousLocation.label}</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground">Next</p>
              <p className="mt-0.5 break-words font-medium">
                {gap.next.courseCode} · {nextLocation.label}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                starts {formatTime(gap.next.startTime)}
              </p>
            </div>
            <div className="flex min-w-0 items-start gap-2 border-t border-border pt-3">
              <RouteIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">
                  Leave by {formatTime(result.assessment.leaveByMinutes)}
                </p>
                <p className="mt-0.5 break-words leading-5 text-muted-foreground">
                  {routePresentation.detail}
                </p>
              </div>
            </div>
          </div>

          {friendOverlaps.length > 0 ? (
            <button
              type="button"
              onClick={onOpenFriends}
              className="mt-3 flex w-full min-w-0 items-center justify-between gap-2 border-t border-border pt-3 text-xs font-semibold text-accent"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {friendOverlaps.length} friend overlap{friendOverlaps.length === 1 ? "" : "s"}
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

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
  const assessments = useMemo(() => {
    const map = new Map<string, GapAssessmentResult>();
    for (const gap of gaps)
      map.set(gap.id, planGapAssessment(gap, preferences, gapPreferences, planTransition));
    return map;
  }, [gapPreferences, gaps, planTransition, preferences]);
  const totalUsableMinutes = useMemo(
    () =>
      gaps.reduce(
        (sum, gap) => sum + (assessments.get(gap.id)?.assessment.primary.activityMinutes ?? 0),
        0,
      ),
    [assessments, gaps],
  );

  const [selectedByDay, setSelectedByDay] = useState<Record<string, string>>({});
  const [recommendationByGap, setRecommendationByGap] = useState<Record<string, string>>({});
  const [activeOverlay, setActiveOverlay] = useState<GapPlanOverlay>(null);
  const [friendOverlapState, setFriendOverlapState] = useState<{
    userId: string | null;
    overlaps: FriendGapOverlap[];
  }>({ userId: null, overlaps: [] });
  const userId = user?.id ?? null;

  useEffect(() => {
    setSelectedByDay((current) => {
      const next = { ...current };
      for (const group of groups) {
        if (!group.gaps.some((gap) => gap.id === next[group.weekday]))
          next[group.weekday] = group.gaps[0]!.id;
      }
      return next;
    });
  }, [groups]);

  useEffect(() => {
    const applySelection = (gapId: string) => {
      const gap = gaps.find((item) => item.id === gapId);
      if (!gap) return;
      setSelectedByDay((current) => ({ ...current, [gap.weekday]: gap.id }));
      clearQueuedGapPlanSelection(gap.id);
    };
    const queued = peekQueuedGapPlanSelection();
    if (queued) applySelection(queued);
    return subscribeGapPlanSelection(applySelection);
  }, [gaps]);

  const handleFriendOverlapsChange = useCallback(
    (overlaps: FriendGapOverlap[]) => setFriendOverlapState({ userId, overlaps }),
    [userId],
  );

  const friendOverlapsByGapId = useMemo(() => {
    const source =
      friendOverlapState.userId === userId ? friendOverlapState.overlaps : EMPTY_FRIEND_OVERLAPS;
    const map = new Map<string, FriendGapOverlap[]>();
    for (const gap of gaps) {
      const matches = source.filter(
        (overlap) =>
          overlap.term === gap.term &&
          overlap.weekday === gap.weekday &&
          overlap.startMinute >= gap.startTime &&
          overlap.endMinute <= gap.endTime,
      );
      map.set(gap.id, matches.length ? matches : EMPTY_FRIEND_OVERLAPS);
    }
    return map;
  }, [friendOverlapState, gaps, userId]);

  return (
    <div className="gap-plan-root min-w-0 space-y-4">
      <section className="gap-plan-overview min-w-0 border-b border-border pb-5">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="md:hidden">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Between classes
              </p>
              <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">Gap plan</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:mt-0">
              See what actually fits after walking time, setup, and the buffer before your next
              class.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveOverlay("tune")}
              className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-xs font-semibold"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Tune
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay("friends")}
              className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-xs font-semibold"
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              Friend gaps
            </button>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-3 overflow-hidden rounded-lg border border-border bg-card">
          <div className="min-w-0 border-r border-border p-3">
            <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              Gaps
            </p>
            <p className="mt-1 text-lg font-semibold">{gaps.length}</p>
          </div>
          <div className="min-w-0 border-r border-border p-3">
            <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              Usable
            </p>
            <p className="mt-1 truncate text-lg font-semibold">
              {formatCompactDuration(totalUsableMinutes)}
            </p>
          </div>
          <div className="min-w-0 p-3">
            <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              Days
            </p>
            <p className="mt-1 text-lg font-semibold">{groups.length}</p>
          </div>
        </div>
      </section>

      <Dialog
        open={activeOverlay !== null}
        onOpenChange={(open) => !open && setActiveOverlay(null)}
      >
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl">
          {activeOverlay === "tune" ? (
            <>
              <DialogTitle>Tune gap recommendations</DialogTitle>
              <DialogDescription>
                Changes update usable time and recommendations immediately.
              </DialogDescription>
              <TunePanel
                value={gapPreferences}
                onChange={onGapPreferencesChange}
                residenceName={residence?.name ?? null}
              />
            </>
          ) : activeOverlay === "friends" ? (
            <>
              <DialogTitle>Friend gaps</DialogTitle>
              <DialogDescription>
                Compare mutual free-time windows without sharing full timetables.
              </DialogDescription>
              <div className="mt-4">
                <FriendOverlapPanel
                  key={user?.id ?? "guest"}
                  user={user}
                  term={term}
                  onOverlapsChange={handleFriendOverlapsChange}
                />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Clock3 className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 font-semibold">No gaps in this term</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your scheduled classes are back to back, or there is only one class on each day.
          </p>
        </div>
      ) : null}

      {groups.map((group) => {
        const selectedId = selectedByDay[group.weekday] ?? group.gaps[0]!.id;
        const selectedGap = group.gaps.find((gap) => gap.id === selectedId) ?? group.gaps[0]!;
        const selectedResult = assessments.get(selectedGap.id)!;
        return (
          <section
            key={group.weekday}
            aria-labelledby={`gaps-${group.weekday}`}
            className="min-w-0 rounded-lg border border-border bg-background/30 p-4 sm:p-5"
          >
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <h3
                id={`gaps-${group.weekday}`}
                className="truncate font-display text-lg font-medium"
              >
                {group.weekday}
              </h3>
              <span className="shrink-0 text-xs text-muted-foreground">
                {group.gaps.length} gap{group.gaps.length === 1 ? "" : "s"}
              </span>
            </div>

            <div
              className="mt-3 grid min-w-0 gap-2"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(13rem, 100%), 1fr))" }}
            >
              {group.gaps.map((gap) => (
                <GapOption
                  key={gap.id}
                  gap={gap}
                  result={assessments.get(gap.id)!}
                  selected={gap.id === selectedGap.id}
                  onSelect={() =>
                    setSelectedByDay((current) => ({ ...current, [group.weekday]: gap.id }))
                  }
                />
              ))}
            </div>

            <GapInspector
              gap={selectedGap}
              result={selectedResult}
              friendOverlaps={friendOverlapsByGapId.get(selectedGap.id) ?? EMPTY_FRIEND_OVERLAPS}
              selectedRecommendationId={recommendationByGap[selectedGap.id] ?? null}
              onRecommendationChange={(id) =>
                setRecommendationByGap((current) => ({ ...current, [selectedGap.id]: id }))
              }
              onOpenFriends={() => setActiveOverlay("friends")}
            />
          </section>
        );
      })}
    </div>
  );
});

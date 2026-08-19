import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Coffee,
  Home,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GapAction, GapAssessment, GapRecommendation } from "@/features/gaps/types";
import { formatCompactDuration, formatTime } from "@/lib/timetable-types";

const OPTION_META: Record<GapAction, { label: string; icon: LucideIcon }> = {
  "tight-transition": { label: "Transition", icon: ArrowRight },
  "quick-reset": { label: "Reset", icon: Coffee },
  "focus-sprint": { label: "Focus", icon: Brain },
  "meal-window": { label: "Eat", icon: Utensils },
  "study-block": { label: "Study", icon: Brain },
  "deep-work-block": { label: "Deep work", icon: Sparkles },
  "flexible-long-gap": { label: "Focus + reset", icon: Sparkles },
  "leave-campus-candidate": { label: "Leave campus", icon: Home },
  "go-home": { label: "Go home", icon: Home },
  "location-dependent": { label: "Stay flexible", icon: AlertTriangle },
};

function recommendationOptions(assessment: GapAssessment) {
  const labels = new Set<string>();
  return [assessment.primary, ...assessment.alternatives].filter((recommendation) => {
    const label = OPTION_META[recommendation.action].label;
    if (labels.has(label)) return false;
    labels.add(label);
    return true;
  });
}

function routeStatusLabel(status: GapAssessment["routeStatus"]) {
  switch (status) {
    case "same-room":
      return "Same room";
    case "routed":
      return "Routed";
    case "approximate":
      return "Estimated";
    case "unavailable":
      return "Unavailable";
  }
}

function isRoundTripRecommendation(recommendation: GapRecommendation) {
  return recommendation.action === "go-home" || recommendation.action === "leave-campus-candidate";
}

export function GapPlannerPreview({
  assessment,
  onOpenGapPlan,
  className = "",
}: {
  assessment: GapAssessment;
  onOpenGapPlan: () => void;
  className?: string;
}) {
  const options = useMemo(() => recommendationOptions(assessment), [assessment]);
  const [selectedId, setSelectedId] = useState(assessment.primary.id);

  useEffect(() => {
    setSelectedId(assessment.primary.id);
  }, [assessment.primary.id]);

  const selected = options.find((option) => option.id === selectedId) ?? assessment.primary;
  const selectedMeta = OPTION_META[selected.action];
  const SelectedIcon = selectedMeta.icon;
  const protectedMinutes = selected.timeline
    .filter((segment) => segment.kind === "travel" || segment.kind === "buffer")
    .reduce((total, segment) => total + segment.minutes, 0);
  const roundTrip = isRoundTripRecommendation(selected);
  const warning = assessment.warnings[0] ?? null;

  return (
    <section
      className={`rounded-xl border border-accent/20 bg-accent/[0.045] p-4 sm:p-5 ${className}`}
      aria-label="Gapwise intelligent gap plan"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-accent">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Gapwise intelligence
        </p>
        <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Deterministic
        </span>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-background/70 text-accent">
          <SelectedIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-medium tracking-tight">{selected.title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{selected.summary}</p>
        </div>
      </div>

      {options.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Gap plan alternatives">
          {options.map((option) => {
            const meta = OPTION_META[option.action];
            const active = option.id === selected.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(option.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background/65 text-muted-foreground hover:border-accent/50 hover:text-foreground"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-background/55 px-3 py-2.5">
          <dt className="text-[0.65rem] font-medium text-muted-foreground">Usable</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
            {formatCompactDuration(selected.activityMinutes)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background/55 px-3 py-2.5">
          <dt className="text-[0.65rem] font-medium text-muted-foreground">
            {roundTrip ? "Plan" : "Leave by"}
          </dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
            {roundTrip ? "Round trip" : formatTime(assessment.leaveByMinutes)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background/55 px-3 py-2.5">
          <dt className="text-[0.65rem] font-medium text-muted-foreground">Protected</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
            {formatCompactDuration(protectedMinutes)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background/55 px-3 py-2.5">
          <dt className="text-[0.65rem] font-medium text-muted-foreground">Confidence</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
            {Math.round(assessment.confidence * 100)}%
          </dd>
        </div>
      </dl>

      <ol className="mt-4 grid gap-1.5" aria-label="Gap plan timeline">
        {selected.timeline.map((segment, index) => (
          <li
            key={`${selected.id}-${segment.label}-${index}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-background/45 px-3 py-2 text-xs"
          >
            <span className="min-w-0 truncate text-muted-foreground">{segment.label}</span>
            <span className="shrink-0 font-mono font-semibold tabular-nums text-foreground">
              {formatCompactDuration(segment.minutes)}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-xs leading-5 text-muted-foreground">
          <p>
            {routeStatusLabel(assessment.routeStatus)} · {assessment.routeAccuracy}
          </p>
          {warning ? (
            <p className="mt-1 flex items-start gap-1.5">
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                aria-hidden="true"
              />
              <span>{warning}</span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onOpenGapPlan}
          className="button-primary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 px-3.5 text-xs font-semibold"
        >
          Full gap plan
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

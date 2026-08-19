import { AlertTriangle, MapPin, Route } from "lucide-react";
import { useMemo, useState } from "react";
import { UTM_BUILDINGS } from "@/data/utm/building-registry";
import { assessGapDestination, type DestinationLeg } from "@/features/gaps/destination-feasibility";
import type { GapPreferences } from "@/features/gaps/types";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Gap } from "@/lib/timetable-types";
import { formatCompactDuration, formatTime } from "@/lib/timetable-types";

function legStatusLabel(leg: DestinationLeg) {
  switch (leg.status) {
    case "routed":
      return "Routed";
    case "approximate":
      return "Estimated";
    case "same-building":
      return "Same building";
    case "unavailable":
      return "Unavailable";
  }
}

function travelLabel(leg: DestinationLeg) {
  if (leg.travelMinutes === null) return "Unknown";
  if (leg.travelMinutes === 0) return "0 min";
  return formatCompactDuration(leg.travelMinutes);
}

export function GapDestinationChecker({
  gap,
  preferences,
  gapPreferences,
  planTransition,
  className = "",
}: {
  gap: Gap;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
  className?: string;
}) {
  const [destinationCode, setDestinationCode] = useState("");
  const buildings = useMemo(
    () => [...UTM_BUILDINGS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const feasibility = useMemo(
    () =>
      destinationCode
        ? assessGapDestination({
            gap,
            destinationBuildingCode: destinationCode,
            preferences,
            gapPreferences,
            planTransition,
          })
        : null,
    [destinationCode, gap, gapPreferences, planTransition, preferences],
  );

  const summary = feasibility
    ? feasibility.status === "feasible"
      ? `${formatCompactDuration(feasibility.activityMinutes)} usable at ${feasibility.destination.code}`
      : feasibility.status === "tight"
        ? "Not enough protected time at this destination"
        : "Gapwise can't verify both legs"
    : null;

  return (
    <section
      className={`rounded-xl border border-border bg-background/45 p-4 sm:p-5 ${className}`}
      aria-labelledby="gap-destination-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-accent">
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3
            id="gap-destination-title"
            className="font-display text-lg font-medium tracking-tight"
          >
            Can I go there?
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Choose a canonical UTM building. Gapwise checks both legs of this gap with the same
            deterministic routing engine and fails closed where routing coverage is missing.
          </p>
        </div>
      </div>

      <label
        className="mt-4 block text-xs font-semibold text-muted-foreground"
        htmlFor="gap-destination"
      >
        Destination building
      </label>
      <select
        id="gap-destination"
        value={destinationCode}
        onChange={(event) => setDestinationCode(event.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Choose a building</option>
        {buildings.map((building) => (
          <option key={building.code} value={building.code}>
            {building.code} — {building.name}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        Travel feasibility only — no amenity or building-access claim.
      </p>

      {feasibility ? (
        <div className="mt-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <div>
              <p className="font-semibold">{summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {feasibility.destination.name} · {Math.round(feasibility.confidence * 100)}%
                confidence
              </p>
            </div>
            <span className="rounded-full border border-border bg-secondary/45 px-2.5 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {feasibility.status}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-background/70 px-3 py-2.5">
              <dt className="text-[0.65rem] text-muted-foreground">Outbound</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                {travelLabel(feasibility.outbound)}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/70 px-3 py-2.5">
              <dt className="text-[0.65rem] text-muted-foreground">At destination</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                {formatCompactDuration(feasibility.activityMinutes)}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/70 px-3 py-2.5">
              <dt className="text-[0.65rem] text-muted-foreground">Return</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                {travelLabel(feasibility.inbound)}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/70 px-3 py-2.5">
              <dt className="text-[0.65rem] text-muted-foreground">Leave destination</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                {feasibility.leaveDestinationByMinutes === null
                  ? "Unknown"
                  : formatTime(feasibility.leaveDestinationByMinutes)}
              </dd>
            </div>
          </dl>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["From previous class", feasibility.outbound],
              ["To next class", feasibility.inbound],
            ].map(([label, leg]) => {
              const typedLeg = leg as DestinationLeg;
              return (
                <div key={label as string} className="rounded-lg border border-border px-3 py-2.5">
                  <p className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Route className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                      {label as string}
                    </span>
                    <span>{legStatusLabel(typedLeg)}</span>
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    {typedLeg.accuracy}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Protected buffer: {formatCompactDuration(feasibility.bufferMinutes)}
          </p>

          {feasibility.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1.5" aria-label="Destination feasibility warnings">
              {feasibility.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"
                >
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

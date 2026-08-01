import { ArrowRight, Clock, MapPin } from "lucide-react";
import { groupGapsByDay, calculateGapTiming } from "@/lib/gaps";
import type { Gap, GapKind } from "@/lib/timetable-types";
import { formatDuration, formatTime, locationLabel } from "@/lib/timetable-types";
import { planMeetingTransition } from "@/features/routing/transition";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import type { UserPreferences } from "@/features/sync/preferences";

const KIND_STYLES: Record<GapKind, string> = {
  "Transition only": "bg-muted text-muted-foreground",
  "Short break": "bg-tut/15 text-tut",
  "Useful study gap": "bg-lec/15 text-lec",
  "Long campus gap": "bg-pra/15 text-pra",
};

function GapCard({ gap, preferences }: { gap: Gap; preferences: UserPreferences }) {
  const route = planMeetingTransition(gap.previous, gap.next, UTM_ROUTING_GRAPH, preferences);
  const timing = calculateGapTiming(
    gap,
    route.status === "routed" || route.status === "same-room" ? route.result : null,
    preferences.transitionBufferMinutes,
  );
  return (
    <article className="surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
          {formatTime(gap.startTime)} – {formatTime(gap.endTime)}
        </p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${KIND_STYLES[gap.kind]}`}>
          {gap.kind}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total gap</dt>
          <dd className="font-semibold">{formatDuration(gap.durationMinutes)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Estimated usable
          </dt>
          <dd className="font-semibold">{formatDuration(timing.usableMinutes)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Estimated travel
          </dt>
          <dd className="font-semibold">
            {timing.travelSeconds === null
              ? "Unavailable"
              : formatDuration(Math.ceil(timing.travelSeconds / 60))}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Recommended buffer
          </dt>
          <dd className="font-semibold">{formatDuration(timing.bufferMinutes)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Leave by</dt>
          <dd className="font-semibold">{formatTime(timing.leaveByMinutes)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Arrival estimate
          </dt>
          <dd className="font-semibold">
            {timing.arrivalMinutes === null ? "Unavailable" : formatTime(timing.arrivalMinutes)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
        {timing.fallback
          ? `Fallback estimate: ${formatDuration(timing.bufferMinutes)} is reserved because a verified route is unavailable. ${route.accuracy}.`
          : route.accuracy}
      </p>

      <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
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
      </div>
    </article>
  );
}

export function GapPlan({ gaps, preferences }: { gaps: Gap[]; preferences: UserPreferences }) {
  const groups = groupGapsByDay(gaps);

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
      <p className="text-sm text-muted-foreground">
        Verified routes use calculated travel plus your transition buffer. When route data is
        missing, the original 15-minute combined fallback is shown explicitly.
      </p>
      {groups.map((group) => (
        <section key={group.weekday} aria-labelledby={`gaps-${group.weekday}`}>
          <h3 id={`gaps-${group.weekday}`} className="text-base font-semibold">
            {group.weekday}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {group.gaps.length} gap{group.gaps.length === 1 ? "" : "s"}
            </span>
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.gaps.map((gap) => (
              <GapCard key={gap.id} gap={gap} preferences={preferences} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

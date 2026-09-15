import { AlertTriangle, Clock3, Footprints, LocateFixed, Navigation } from "lucide-react";
import { getCampusLocationDisplay } from "@/features/routing/location-presentation";
import { classTiming, type LiveClassOrigin } from "@/features/routing/live-class-route";
import type { TransitionRoute } from "@/features/routing/types";
import type { UserPreferences } from "@/features/sync/preferences";
import { formatTime, locationLabel, type Meeting } from "@/lib/timetable-types";

function clock(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function distance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

const fallbackCopy: Record<Extract<LiveClassOrigin, { kind: "fallback" }>["reason"], string> = {
  disabled: "Tap “Route from me” on the map to use a foreground-only location fix.",
  requesting: "Getting a fresh on-campus location fix…",
  stale: "Your last location fix is stale. Waiting for a fresh fix.",
  "off-campus": "You appear to be off campus.",
  "permission-denied": "Location permission was denied in this browser.",
  unavailable: "A current location fix is unavailable.",
};

export function LiveClassRouteCard({
  meeting,
  origin,
  route,
  fallbackRoute,
  preferences,
  now,
}: {
  meeting: Meeting | null;
  origin: LiveClassOrigin;
  route: TransitionRoute | null;
  fallbackRoute: TransitionRoute | null;
  preferences: UserPreferences;
  now: Date;
}) {
  if (!meeting) return null;
  const destination = getCampusLocationDisplay(meeting);
  const activeRoute = origin.kind === "live" ? route : fallbackRoute;
  const seconds = activeRoute?.result?.estimatedSeconds ?? activeRoute?.approximateSeconds ?? null;
  const meters =
    activeRoute?.result?.totalDistanceMeters ?? activeRoute?.approximateDistanceMeters ?? null;
  const timing =
    seconds === null
      ? null
      : classTiming(
          meeting.startTime,
          meeting.weekday,
          seconds,
          preferences.transitionBufferMinutes,
          now,
        );
  const live = origin.kind === "live";

  return (
    <section
      className="surface border-accent/25 p-4"
      aria-live="polite"
      data-testid="live-class-route"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-accent">Route to this class</p>
          <h2 className="mt-1 truncate font-display text-lg font-semibold">
            {meeting.courseCode} · {destination?.buildingName ?? locationLabel(meeting)}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {locationLabel(meeting)} · starts {formatTime(meeting.startTime)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-accent/12 px-2.5 py-1 text-[0.68rem] font-semibold text-accent">
          {live ? "From you" : "Fallback"}
        </span>
      </div>
      {!live ? (
        <div className="mt-3 rounded-xl border border-border bg-background/45 p-3 text-xs leading-5 text-muted-foreground">
          <p className="font-semibold text-foreground">Live origin unavailable</p>
          <p>
            {fallbackCopy[origin.reason]} Existing between-class or campus-arrival routing remains
            available.
          </p>
        </div>
      ) : null}
      {timing && seconds !== null && meters !== null ? (
        <>
          <div
            className={`mt-3 rounded-xl border p-3 ${timing.state === "on-time" ? "border-lec/25 bg-lec/8" : "border-destructive/35 bg-destructive/10"}`}
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Leave by
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {timing.state === "late"
                ? "Class has started"
                : timing.state === "leave-now"
                  ? "Leave now"
                  : clock(timing.leaveBy)}
            </p>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Metric
              icon={Clock3}
              label="Walk"
              value={`${Math.max(1, Math.ceil(seconds / 60))} min`}
            />
            <Metric icon={Footprints} label="Distance" value={distance(meters)} />
            <Metric icon={LocateFixed} label="Arrive" value={clock(timing.arrival)} />
          </dl>
        </>
      ) : (
        <div className="mt-3 flex gap-2 rounded-xl border border-accent/25 bg-accent/8 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <p>{activeRoute?.message ?? "Select a mapped physical class to calculate the route."}</p>
        </div>
      )}
      {live && route?.warnings.length ? (
        <p className="mt-3 flex gap-2 text-xs leading-5 text-muted-foreground">
          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          {route.warnings[0]}
        </p>
      ) : null}
      <p className="mt-3 border-t border-border pt-3 text-[0.68rem] leading-4 text-muted-foreground">
        Precise location is used only in this open browser view and is not saved.
      </p>
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
    <div className="rounded-xl border border-border bg-background/40 p-2.5">
      <dt className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

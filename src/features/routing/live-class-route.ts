import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { WEEKDAYS, type Meeting, type Weekday } from "@/lib/timetable-types";
import { findBestRoute } from "./engine";
import { LIVE_LOCATION_MAX_AGE_MS, type LiveLocationState } from "./live-location";
import { resolveMeetingLocation } from "./location-resolver";
import { haversineMeters } from "./transition";
import type { RoutePreferences, RoutingGraph, RoutingNode, TransitionRoute } from "./types";

export type LiveClassOrigin =
  | {
      kind: "live";
      point: NonNullable<Extract<LiveLocationState, { status: "on-campus" }>["point"]>;
    }
  | {
      kind: "fallback";
      reason:
        "disabled" | "requesting" | "stale" | "off-campus" | "permission-denied" | "unavailable";
    };

export function selectLiveClassOrigin(
  state: LiveLocationState | { status: "disabled"; point: null },
  nowMs = Date.now(),
): LiveClassOrigin {
  if (state.status !== "on-campus") return { kind: "fallback", reason: state.status };
  if (nowMs - state.observedAtMs > LIVE_LOCATION_MAX_AGE_MS) {
    return { kind: "fallback", reason: "stale" };
  }
  return { kind: "live", point: state.point };
}

export function liveLocationMateriallyChanged(
  previous: LiveClassOrigin,
  next: LiveClassOrigin,
  thresholdMeters = 15,
): boolean {
  if (previous.kind !== next.kind) return true;
  if (previous.kind === "fallback" && next.kind === "fallback")
    return previous.reason !== next.reason;
  if (previous.kind === "live" && next.kind === "live") {
    return (
      haversineMeters(
        [previous.point.longitude, previous.point.latitude],
        [next.point.longitude, next.point.latitude],
      ) >= thresholdMeters
    );
  }
  return false;
}

function eligibleDestination(node: RoutingNode, buildingCode: string) {
  return (
    node.kind === "building-entrance" &&
    node.buildingCode === buildingCode &&
    node.access !== "restricted" &&
    node.access !== "emergency_only" &&
    node.direction !== "exit"
  );
}

export function planLiveClassRoute(
  meeting: Meeting,
  origin: Extract<LiveClassOrigin, { kind: "live" }>,
  preferences: RoutePreferences,
  graph: RoutingGraph = UTM_ROUTING_GRAPH,
): TransitionRoute {
  const destination = resolveMeetingLocation(meeting);
  if (destination.status !== "known" || !destination.buildingCode) {
    return unavailable("This class does not have a mapped physical destination.");
  }
  const ends = graph.nodes.filter((node) => eligibleDestination(node, destination.buildingCode!));
  const candidates = graph.nodes
    .filter(
      (node) =>
        (node.kind === "path-intersection" || node.kind === "crosswalk") &&
        node.longitude !== undefined &&
        node.latitude !== undefined,
    )
    .map((node) => ({
      node,
      distance: haversineMeters(
        [origin.point.longitude, origin.point.latitude],
        [node.longitude!, node.latitude!],
      ),
    }))
    .filter(({ distance }) => distance <= 90)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
  if (ends.length === 0 || candidates.length === 0) {
    return unavailable("A mapped campus-path connection is unavailable from your current fix.");
  }

  let best: { route: NonNullable<TransitionRoute["result"]>; connector: number } | null = null;
  for (const candidate of candidates) {
    const route = findBestRoute(
      graph,
      [candidate.node.id],
      ends.map(({ id }) => id),
      preferences,
    );
    if (!route) continue;
    const seconds = route.estimatedSeconds + candidate.distance / preferences.walkingSpeedMps;
    if (
      !best ||
      seconds < best.route.estimatedSeconds + best.connector / preferences.walkingSpeedMps
    ) {
      best = { route, connector: candidate.distance };
    }
  }
  if (!best) return unavailable("No route to an eligible mapped building entrance was found.");

  const result = {
    ...best.route,
    totalDistanceMeters: best.route.totalDistanceMeters + best.connector,
    outdoorDistanceMeters: best.route.outdoorDistanceMeters + best.connector,
    estimatedSeconds: best.route.estimatedSeconds + best.connector / preferences.walkingSpeedMps,
    coordinates: [
      [origin.point.longitude, origin.point.latitude] as [number, number],
      ...best.route.coordinates,
    ],
  };
  return {
    status: "routed",
    message: "Route calculated from your current location to the best mapped entrance.",
    accuracy: "Mapped campus path, indoor estimate",
    result,
    displayCoordinates: result.coordinates,
    warnings: [
      `Continue inside to ${destination.room ? `room ${destination.room}` : destination.buildingCode}; indoor room paths are not mapped.`,
      "Your precise location stays in this browser and is discarded when live location is turned off.",
    ],
    approximateDistanceMeters: null,
    approximateSeconds: null,
  };
}

function unavailable(message: string): TransitionRoute {
  return {
    status: "unavailable",
    message,
    accuracy: "Location unavailable",
    result: null,
    displayCoordinates: [],
    warnings: [],
    approximateDistanceMeters: null,
    approximateSeconds: null,
  };
}

export function classTiming(
  startMinutes: number,
  weekday: Weekday,
  routeSeconds: number,
  bufferMinutes: number,
  now: Date,
) {
  const arrival = new Date(now.getTime() + routeSeconds * 1000);
  const classStart = new Date(now);
  const weekdayIndex = WEEKDAYS.indexOf(weekday) + 1;
  const targetDay = weekdayIndex === 7 ? 0 : weekdayIndex;
  classStart.setDate(classStart.getDate() + ((targetDay - now.getDay() + 7) % 7));
  classStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  const leaveBy = new Date(classStart.getTime() - routeSeconds * 1000 - bufferMinutes * 60_000);
  return {
    arrival,
    leaveBy,
    state:
      now.getTime() >= classStart.getTime()
        ? ("late" as const)
        : now.getTime() >= leaveBy.getTime()
          ? ("leave-now" as const)
          : ("on-time" as const),
  };
}

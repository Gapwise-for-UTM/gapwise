import { ROUTING_DEFAULTS } from "@/config/routing";
import { getCampusBuilding } from "@/data/utm/campus";
import type { Meeting } from "@/lib/timetable-types";
import { resolveMeetingLocation } from "./location-resolver";
import { findRoute } from "./engine";
import type { RoutePreferences, RoutingGraph, RoutingNode, TransitionRoute } from "./types";

export type TransitionPlanner = (
  from: Meeting,
  to: Meeting,
  preferences: RoutePreferences,
) => TransitionRoute;

export function haversineMeters(a: [number, number], b: [number, number]): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function findRoomNode(graph: RoutingGraph, buildingCode: string, room: string | null) {
  if (!room) return null;
  return (
    graph.nodes.find(
      (node) =>
        node.kind === "room" &&
        node.buildingCode === buildingCode &&
        node.room?.toUpperCase() === room.toUpperCase(),
    ) ?? null
  );
}

function findEntranceNode(graph: RoutingGraph, buildingCode: string): RoutingNode | null {
  return (
    graph.nodes.find(
      (node) => node.kind === "building-entrance" && node.buildingCode === buildingCode,
    ) ?? null
  );
}

function locationUnavailable(message: string, warnings: string[] = []): TransitionRoute {
  return {
    status: "unavailable",
    message,
    accuracy: "Location unavailable",
    result: null,
    displayCoordinates: [],
    warnings,
    approximateDistanceMeters: null,
    approximateSeconds: null,
  };
}

export function planMeetingTransition(
  from: Meeting,
  to: Meeting,
  graph: RoutingGraph,
  preferences: RoutePreferences,
): TransitionRoute {
  const origin = resolveMeetingLocation(from);
  const destination = resolveMeetingLocation(to);
  const locationWarnings = [origin.warning, destination.warning].filter(
    (warning): warning is string => Boolean(warning),
  );
  if (origin.status !== "known" || destination.status !== "known") {
    return locationUnavailable(
      "A physical route cannot be generated for an online, TBA, or unknown location.",
      locationWarnings,
    );
  }
  if (!origin.buildingCode || !destination.buildingCode) {
    return locationUnavailable("A building code is required to calculate this transition.");
  }

  const sameBuilding = origin.buildingCode === destination.buildingCode;
  const sameRoom =
    sameBuilding &&
    Boolean(origin.room) &&
    origin.room?.toUpperCase() === destination.room?.toUpperCase();
  if (sameRoom) {
    return {
      status: "same-room",
      message: "You are already at your next class.",
      accuracy: "Verified indoor + outdoor route",
      result: {
        nodes: [],
        edges: [],
        totalDistanceMeters: 0,
        indoorDistanceMeters: 0,
        outdoorDistanceMeters: 0,
        estimatedSeconds: 0,
        floorChanges: 0,
        warnings: [],
      },
      displayCoordinates: [],
      warnings: [],
      approximateDistanceMeters: 0,
      approximateSeconds: 0,
    };
  }

  const originRoom = findRoomNode(graph, origin.buildingCode, origin.room);
  const destinationRoom = findRoomNode(graph, destination.buildingCode, destination.room);
  const originEntrance = findEntranceNode(graph, origin.buildingCode);
  const destinationEntrance = findEntranceNode(graph, destination.buildingCode);
  const start = originRoom ?? originEntrance;
  const end = destinationRoom ?? destinationEntrance;

  if (sameBuilding && (!originRoom || !destinationRoom)) {
    return locationUnavailable(`Indoor room routing not yet mapped for ${origin.buildingCode}.`, [
      "The app will not guess an indoor hallway route.",
    ]);
  }

  if (start && end) {
    const result = findRoute(graph, start.id, end.id, preferences);
    if (result) {
      const displayCoordinates = result.nodes
        .filter(
          (node): node is RoutingNode & { longitude: number; latitude: number } =>
            typeof node.longitude === "number" && typeof node.latitude === "number",
        )
        .map((node) => [node.longitude, node.latitude] as [number, number]);
      const indoorComplete = Boolean(originRoom && destinationRoom);
      const warnings = [...result.warnings];
      if (!originRoom)
        warnings.push(`Indoor room routing not yet mapped for ${origin.buildingCode}.`);
      if (!destinationRoom) {
        warnings.push(`Indoor room routing not yet mapped for ${destination.buildingCode}.`);
      }
      return {
        status: "routed",
        message: "Route calculated from verified graph records.",
        accuracy: indoorComplete
          ? "Verified indoor + outdoor route"
          : "Verified outdoor route, indoor estimate",
        result,
        displayCoordinates,
        warnings,
        approximateDistanceMeters: null,
        approximateSeconds: null,
      };
    }
    if (preferences.mode === "step-free") {
      return locationUnavailable("No verified accessible route exists in the current dataset.", [
        "Step-free mode never falls back to stairs or unverified entrances.",
      ]);
    }
  }

  const fromBuilding = getCampusBuilding(origin.buildingCode);
  const toBuilding = getCampusBuilding(destination.buildingCode);
  if (!fromBuilding || !toBuilding) {
    return locationUnavailable(
      "Verified map coordinates are unavailable for one or both buildings.",
      locationWarnings,
    );
  }
  if (preferences.mode === "step-free") {
    return locationUnavailable("No verified accessible route exists in the current dataset.", [
      "Entrance accessibility and connecting paths have not been verified.",
    ]);
  }

  const distance = haversineMeters(fromBuilding.navigationPoint, toBuilding.navigationPoint);
  const seconds =
    distance / preferences.walkingSpeedMps + ROUTING_DEFAULTS.buildingEntryExitSeconds * 2;
  return {
    status: "approximate",
    message: "Approximate travel estimate — verified walking path unavailable.",
    accuracy: "Approximate building-to-building estimate",
    result: null,
    displayCoordinates: [],
    warnings: [
      `Indoor room routing not yet mapped for ${origin.buildingCode}.`,
      `Indoor room routing not yet mapped for ${destination.buildingCode}.`,
      "Distance and time use a straight-line estimate; no path is drawn until a walking route is verified.",
    ],
    approximateDistanceMeters: distance,
    approximateSeconds: seconds,
  };
}

function meetingCacheKey(meeting: Meeting): string {
  return [
    meeting.id,
    meeting.buildingCode ?? "",
    meeting.room ?? "",
    meeting.locationUnknown ? "unknown" : "known",
  ].join("|");
}

function preferenceCacheKey(preferences: RoutePreferences): string {
  return [preferences.mode, preferences.walkingSpeedMps, preferences.transitionBufferMinutes].join(
    "|",
  );
}

/** Keeps pure transition work stable while a timetable remains in memory. */
export function createMemoizedTransitionPlanner(
  graph: RoutingGraph,
  calculate: typeof planMeetingTransition = planMeetingTransition,
  maxEntries = 1_000,
): TransitionPlanner {
  const cache = new Map<string, TransitionRoute>();
  return (from, to, preferences) => {
    const key = `${meetingCacheKey(from)}>${meetingCacheKey(to)}@${preferenceCacheKey(preferences)}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const route = calculate(from, to, graph, preferences);
    if (cache.size >= maxEntries) cache.clear();
    cache.set(key, route);
    return route;
  };
}

/** Scopes cached transitions to one loaded timetable and bounds retained results. */
export function createScheduleTransitionPlanner(
  graph: RoutingGraph,
  meetings: readonly Meeting[],
): TransitionPlanner {
  const maxEntries = Math.max(100, Math.min(2_000, meetings.length * 10));
  return createMemoizedTransitionPlanner(graph, planMeetingTransition, maxEntries);
}

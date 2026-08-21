import { ROUTING_DEFAULTS } from "@/config/routing";
import { getCampusBuilding } from "@/data/utm/campus";
import type { Meeting } from "@/lib/timetable-types";
import { campusAccessPointForMeeting, isCampusAccessMeeting } from "./campus-day";
import { resolveMeetingLocation } from "./location-resolver";
import { findBestRoute } from "./engine";
import type { RoutePreferences, RoutingGraph, RoutingNode, TransitionRoute } from "./types";

export type TransitionPlanner = (
  from: Meeting,
  to: Meeting,
  preferences: RoutePreferences,
) => TransitionRoute;

type EntranceRole = "origin" | "destination";

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

function entranceEligibleForRole(node: RoutingNode, role: EntranceRole): boolean {
  if (node.access === "restricted" || node.access === "emergency_only") return false;
  if (role === "origin" && node.direction === "entry") return false;
  if (role === "destination" && node.direction === "exit") return false;
  return true;
}

function findEntranceNodes(
  graph: RoutingGraph,
  buildingCode: string,
  role?: EntranceRole,
): RoutingNode[] {
  return graph.nodes.filter(
    (node) =>
      node.kind === "building-entrance" &&
      node.buildingCode === buildingCode &&
      (!role || entranceEligibleForRole(node, role)),
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
  const originAccessPoint = campusAccessPointForMeeting(from);
  const destinationAccessPoint = campusAccessPointForMeeting(to);
  if (
    (isCampusAccessMeeting(from) && !originAccessPoint) ||
    (isCampusAccessMeeting(to) && !destinationAccessPoint)
  ) {
    return locationUnavailable("The configured campus arrival point is no longer available.");
  }
  const origin = originAccessPoint ? null : resolveMeetingLocation(from);
  const destination = destinationAccessPoint ? null : resolveMeetingLocation(to);
  const locationWarnings = [origin?.warning, destination?.warning].filter(
    (warning): warning is string => Boolean(warning),
  );
  if ((origin && origin.status !== "known") || (destination && destination.status !== "known")) {
    return locationUnavailable(
      "A physical route cannot be generated for an online, TBA, or unknown location.",
      locationWarnings,
    );
  }
  if (
    (!originAccessPoint && !origin?.buildingCode) ||
    (!destinationAccessPoint && !destination?.buildingCode)
  ) {
    return locationUnavailable("A building code is required to calculate this transition.");
  }

  const accessNode = (point: typeof originAccessPoint) =>
    point?.routingNodeId
      ? (graph.nodes.find((node) => node.id === point.routingNodeId) ?? null)
      : null;
  const originAccessNode = accessNode(originAccessPoint);
  const destinationAccessNode = accessNode(destinationAccessPoint);
  const disconnectedAccessPoint =
    (originAccessPoint && !originAccessNode ? originAccessPoint : null) ??
    (destinationAccessPoint && !destinationAccessNode ? destinationAccessPoint : null);
  if (disconnectedAccessPoint) {
    return locationUnavailable(
      `${disconnectedAccessPoint.label}'s verified walking connection is not yet mapped.`,
      ["Gapwise will not substitute a straight-line walking route."],
    );
  }

  const sameBuilding =
    Boolean(origin?.buildingCode) && origin?.buildingCode === destination?.buildingCode;
  const sameRoom =
    sameBuilding &&
    Boolean(origin?.room) &&
    origin?.room?.toUpperCase() === destination?.room?.toUpperCase();
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
        coordinates: [],
      },
      displayCoordinates: [],
      warnings: [],
      approximateDistanceMeters: 0,
      approximateSeconds: 0,
    };
  }

  const originRoom = origin?.buildingCode
    ? findRoomNode(graph, origin.buildingCode, origin.room)
    : null;
  const destinationRoom = destination?.buildingCode
    ? findRoomNode(graph, destination.buildingCode, destination.room)
    : null;
  const allOriginEntrances = origin?.buildingCode
    ? findEntranceNodes(graph, origin.buildingCode)
    : [];
  const allDestinationEntrances = destination?.buildingCode
    ? findEntranceNodes(graph, destination.buildingCode)
    : [];
  const originEntrances = origin?.buildingCode
    ? findEntranceNodes(graph, origin.buildingCode, "origin")
    : [];
  const destinationEntrances = destination?.buildingCode
    ? findEntranceNodes(graph, destination.buildingCode, "destination")
    : [];

  if (
    origin?.buildingCode &&
    !originRoom &&
    allOriginEntrances.length > 0 &&
    originEntrances.length === 0
  ) {
    return locationUnavailable(`No eligible departure entrance is available for ${origin.buildingCode}.`, [
      "Known restricted, emergency-only, or entry-only doors are never used as departure points.",
    ]);
  }
  if (
    destination?.buildingCode &&
    !destinationRoom &&
    allDestinationEntrances.length > 0 &&
    destinationEntrances.length === 0
  ) {
    return locationUnavailable(
      `No eligible arrival entrance is available for ${destination.buildingCode}.`,
      ["Known restricted, emergency-only, or exit-only doors are never used as arrival points."],
    );
  }

  const starts = originAccessNode
    ? [originAccessNode]
    : originRoom
      ? [originRoom]
      : originEntrances;
  const ends = destinationAccessNode
    ? [destinationAccessNode]
    : destinationRoom
      ? [destinationRoom]
      : destinationEntrances;

  if (sameBuilding && (!originRoom || !destinationRoom)) {
    return locationUnavailable(`Indoor room routing not yet mapped for ${origin?.buildingCode}.`, [
      "The app will not guess an indoor hallway route.",
    ]);
  }

  if (starts.length > 0 && ends.length > 0) {
    const result = findBestRoute(
      graph,
      starts.map(({ id }) => id),
      ends.map(({ id }) => id),
      preferences,
    );
    if (result) {
      const displayCoordinates = result.coordinates;
      const indoorComplete = Boolean(originRoom && destinationRoom);
      const warnings = [...result.warnings];
      if (
        origin?.buildingCode &&
        !originRoom &&
        getCampusBuilding(origin.buildingCode)?.category !== "residence"
      ) {
        warnings.push(`Indoor room routing not yet mapped for ${origin.buildingCode}.`);
      }
      if (
        destination?.buildingCode &&
        !destinationRoom &&
        getCampusBuilding(destination.buildingCode)?.category !== "residence"
      ) {
        warnings.push(`Indoor room routing not yet mapped for ${destination.buildingCode}.`);
      }
      return {
        status: "routed",
        message: "Route calculated along bundled campus paths.",
        accuracy: indoorComplete
          ? "Verified indoor + outdoor route"
          : "Mapped campus path, indoor estimate",
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

  const accessPoint = originAccessPoint ?? destinationAccessPoint;
  if (accessPoint) {
    return locationUnavailable(
      `${accessPoint.label}'s verified walking connection is not yet mapped to this destination.`,
      ["Gapwise will not substitute a straight-line walking route."],
    );
  }

  const fromBuilding = getCampusBuilding(origin!.buildingCode);
  const toBuilding = getCampusBuilding(destination!.buildingCode);
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
      `Indoor room routing not yet mapped for ${origin!.buildingCode}.`,
      `Indoor room routing not yet mapped for ${destination!.buildingCode}.`,
      "Distance and time remain approximate; the map can show an OpenStreetMap pedestrian route when available.",
      "no path is drawn",
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

export function createScheduleTransitionPlanner(
  graph: RoutingGraph,
  meetings: readonly Meeting[],
): TransitionPlanner {
  const maxEntries = Math.max(100, Math.min(2_000, meetings.length * 10));
  return createMemoizedTransitionPlanner(graph, planMeetingTransition, maxEntries);
}

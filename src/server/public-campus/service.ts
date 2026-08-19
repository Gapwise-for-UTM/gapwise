import { ROUTING_DEFAULTS, sanitizeRoutePreferences } from "../../config/routing.js";
import { findRoute } from "../../features/routing/engine.js";
import type { RoutePreferences, RouteResult } from "../../features/routing/types.js";
import {
  PUBLIC_CAMPUS_DATA_VERSION,
  publicCampusBuildings,
  resolvePublicBuilding,
  serverRoutingGraph,
  type PublicCampusBuilding,
} from "./data.js";

export type PublicBuildingView = {
  code: string;
  name: string;
  category: PublicCampusBuilding["category"];
  aliases: string[];
  routingCoverage: PublicCampusBuilding["routingCoverage"];
  entranceCount: number;
  verifiedEntranceCount: number;
  accessibility: "accessible" | "not_accessible" | "unknown";
  indoorRoomNodeCount: number;
  provenance: Array<{
    source: string;
    sourceUrl: string;
    lastVerified: string;
    verificationStatus: "verified" | "inferred" | "unknown";
  }>;
};

export type PublicRouteResponse = {
  dataVersion: string;
  from: PublicBuildingView;
  to: PublicBuildingView;
  preferences: RoutePreferences;
  status: "same-building" | "routed" | "approximate" | "unavailable";
  accuracy:
    | "Same building"
    | "Verified outdoor route, indoor estimate"
    | "Mapped campus path, indoor estimate"
    | "Approximate building-to-building estimate"
    | "Location unavailable";
  totalDistanceMeters: number | null;
  indoorDistanceMeters: number | null;
  outdoorDistanceMeters: number | null;
  estimatedSeconds: number | null;
  floorChanges: number | null;
  warnings: string[];
  routeVerification: "verified" | "mixed" | "inferred" | "unavailable";
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function buildingAccessibility(building: PublicCampusBuilding): PublicBuildingView["accessibility"] {
  if (building.entrances.some((entrance) => entrance.accessibility === "accessible")) return "accessible";
  if (
    building.entrances.length > 0 &&
    building.entrances.every((entrance) => entrance.accessibility === "not_accessible")
  ) {
    return "not_accessible";
  }
  return "unknown";
}

export function publicBuildingView(building: PublicCampusBuilding): PublicBuildingView {
  const provenance = unique(
    [
      ...(building.metadata ? [building.metadata] : []),
      ...building.entrances.map((entrance) => entrance.metadata),
    ].map((item) => JSON.stringify(item)),
  ).map((item) => JSON.parse(item) as PublicBuildingView["provenance"][number]);
  return {
    code: building.code,
    name: building.name,
    category: building.category,
    aliases: building.aliases,
    routingCoverage: building.routingCoverage,
    entranceCount: building.entrances.length,
    verifiedEntranceCount: building.entrances.filter(
      (entrance) => entrance.metadata.verificationStatus === "verified",
    ).length,
    accessibility: buildingAccessibility(building),
    indoorRoomNodeCount: building.indoorRoomNodeCount,
    provenance,
  };
}

export function listPublicBuildings(): PublicBuildingView[] {
  return publicCampusBuildings().map(publicBuildingView);
}

export function getPublicBuilding(query: string) {
  const resolution = resolvePublicBuilding(query);
  if (resolution.status === "found") {
    return { status: "found" as const, building: publicBuildingView(resolution.building) };
  }
  if (resolution.status === "ambiguous") {
    return {
      status: "ambiguous" as const,
      candidates: resolution.candidates.map(publicBuildingView),
    };
  }
  return { status: "not_found" as const };
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: [number, number], b: [number, number]) {
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function verificationForRoute(route: RouteResult): PublicRouteResponse["routeVerification"] {
  const statuses = [
    ...route.nodes.map((node) => node.metadata?.verificationStatus).filter(Boolean),
    ...route.edges.map((edge) => edge.metadata?.verificationStatus).filter(Boolean),
  ];
  if (statuses.length === 0) return "inferred";
  if (statuses.every((status) => status === "verified")) return "verified";
  if (statuses.some((status) => status === "verified")) return "mixed";
  return "inferred";
}

function bestMappedRoute(
  from: PublicCampusBuilding,
  to: PublicCampusBuilding,
  preferences: RoutePreferences,
): RouteResult | null {
  const graph = serverRoutingGraph();
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const starts = from.entrances.filter((entrance) => nodeIds.has(entrance.routingNodeId));
  const ends = to.entrances.filter((entrance) => nodeIds.has(entrance.routingNodeId));
  let best: RouteResult | null = null;
  for (const start of starts) {
    for (const end of ends) {
      const route = findRoute(graph, start.routingNodeId, end.routingNodeId, preferences);
      if (!route) continue;
      if (
        !best ||
        route.estimatedSeconds < best.estimatedSeconds ||
        (route.estimatedSeconds === best.estimatedSeconds &&
          route.totalDistanceMeters < best.totalDistanceMeters)
      ) {
        best = route;
      }
    }
  }
  return best;
}

export function routeBetweenPublicBuildings(input: {
  from: string;
  to: string;
  preferences?: Partial<RoutePreferences> | null;
}): PublicRouteResponse | { error: "unknown_building" | "ambiguous_building"; message: string } {
  const fromResolution = resolvePublicBuilding(input.from);
  const toResolution = resolvePublicBuilding(input.to);
  if (fromResolution.status === "ambiguous" || toResolution.status === "ambiguous") {
    return {
      error: "ambiguous_building",
      message: "A building name matched more than one canonical UTM building. Use the canonical building code.",
    };
  }
  if (fromResolution.status !== "found" || toResolution.status !== "found") {
    return {
      error: "unknown_building",
      message: "Gapwise could not resolve one or both building names to a canonical UTM building.",
    };
  }

  const from = fromResolution.building;
  const to = toResolution.building;
  const preferences = sanitizeRoutePreferences(input.preferences);
  const base = {
    dataVersion: PUBLIC_CAMPUS_DATA_VERSION,
    from: publicBuildingView(from),
    to: publicBuildingView(to),
    preferences,
  };

  if (from.code === to.code) {
    return {
      ...base,
      status: "same-building",
      accuracy: "Same building",
      totalDistanceMeters: 0,
      indoorDistanceMeters: 0,
      outdoorDistanceMeters: 0,
      estimatedSeconds: 0,
      floorChanges: 0,
      warnings: [
        "Building identity matches, but this building-level route does not claim room-to-room indoor routing.",
      ],
      routeVerification: "verified",
    };
  }

  const mapped = bestMappedRoute(from, to, preferences);
  if (mapped) {
    return {
      ...base,
      status: "routed",
      accuracy:
        mapped.nodes.some((node) => node.kind === "room") || mapped.edges.some((edge) => edge.environment === "indoor")
          ? "Verified outdoor route, indoor estimate"
          : "Mapped campus path, indoor estimate",
      totalDistanceMeters: mapped.totalDistanceMeters,
      indoorDistanceMeters: mapped.indoorDistanceMeters,
      outdoorDistanceMeters: mapped.outdoorDistanceMeters,
      estimatedSeconds: mapped.estimatedSeconds,
      floorChanges: mapped.floorChanges,
      warnings: unique([
        ...mapped.warnings,
        "Building-level routing ends at mapped building entrances; room-level indoor travel may be estimated separately.",
      ]),
      routeVerification: verificationForRoute(mapped),
    };
  }

  if (preferences.mode === "step-free") {
    return {
      ...base,
      status: "unavailable",
      accuracy: "Location unavailable",
      totalDistanceMeters: null,
      indoorDistanceMeters: null,
      outdoorDistanceMeters: null,
      estimatedSeconds: null,
      floorChanges: null,
      warnings: [
        "No fully accessible mapped route could be verified for this building pair. Gapwise will not invent a step-free route.",
      ],
      routeVerification: "unavailable",
    };
  }

  if (from.navigationPoint && to.navigationPoint) {
    const direct = distanceMeters(from.navigationPoint, to.navigationPoint);
    const approximateDistance = direct * 1.2;
    const approximateSeconds =
      approximateDistance / preferences.walkingSpeedMps + ROUTING_DEFAULTS.buildingEntryExitSeconds * 2;
    return {
      ...base,
      status: "approximate",
      accuracy: "Approximate building-to-building estimate",
      totalDistanceMeters: approximateDistance,
      indoorDistanceMeters: null,
      outdoorDistanceMeters: null,
      estimatedSeconds: approximateSeconds,
      floorChanges: null,
      warnings: [
        "No connected mapped campus path was available, so this is a conservative straight-line building estimate rather than a verified route.",
        "Accessibility is not verified for the estimated path.",
      ],
      routeVerification: "inferred",
    };
  }

  return {
    ...base,
    status: "unavailable",
    accuracy: "Location unavailable",
    totalDistanceMeters: null,
    indoorDistanceMeters: null,
    outdoorDistanceMeters: null,
    estimatedSeconds: null,
    floorChanges: null,
    warnings: ["Gapwise does not have enough mapped data to estimate this building-to-building route."],
    routeVerification: "unavailable",
  };
}

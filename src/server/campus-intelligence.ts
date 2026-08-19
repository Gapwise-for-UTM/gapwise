import { readFileSync } from "node:fs";

import { DEFAULT_ROUTE_PREFERENCES, sanitizeRoutePreferences } from "../config/routing.js";
import { UTM_BUILDINGS, type BuildingConfiguration } from "../data/utm/building-registry.js";
import { findRoute } from "../features/routing/engine.js";
import type {
  RoutePreferences,
  RouteResult,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
  SourceMetadata,
} from "../features/routing/types.js";

export type PublicCampusBuilding = {
  code: string;
  name: string;
  category: BuildingConfiguration["category"];
  aliases: string[];
  routing: {
    mappedEntrances: number;
    graphConnectedEntrances: number;
    hasMappedRouteAccess: boolean;
    indoorMapped: boolean;
  };
  provenance: SourceMetadata[];
};

export type PublicCampusRoute = {
  from: PublicCampusBuilding;
  to: PublicCampusBuilding;
  preferences: RoutePreferences;
  status: "routed" | "approximate" | "same-building" | "unavailable";
  accuracy:
    | "Mapped campus path, indoor estimate"
    | "Approximate building-to-building estimate"
    | "Same building"
    | "Location unavailable";
  distanceMeters: number | null;
  estimatedSeconds: number | null;
  indoorDistanceMeters: number | null;
  outdoorDistanceMeters: number | null;
  floorChanges: number | null;
  warnings: string[];
  provenance: SourceMetadata[];
};

type EntranceFeature = {
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    buildingCode: string;
    label: string;
    osmNodeId: number;
    accessibility: "accessible" | "not_accessible" | "unknown";
    source: string;
    sourceUrl: string;
    lastVerified: string;
    verificationStatus: "verified" | "inferred" | "unknown";
  };
};

type OutdoorNodeFeature = {
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Omit<RoutingNode, "id" | "longitude" | "latitude">;
};

type Entrance = {
  id: string;
  buildingCode: string;
  coordinates: [number, number];
  osmNodeId: number;
  accessibility: "accessible" | "not_accessible" | "unknown";
  metadata: SourceMetadata;
};

function readJson<T>(relativePath: string): T {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

const entranceFeatures = readJson<{ features: EntranceFeature[] }>(
  "../data/utm/entrances.geojson",
).features;
const outdoorNodeFeatures = readJson<{ features: OutdoorNodeFeature[] }>(
  "../data/utm/outdoor-nodes.geojson",
).features;
const outdoorEdges = readJson<{ metadata?: SourceMetadata; edges: RoutingEdge[] }>(
  "../data/utm/outdoor-edges.json",
);
const surveyGraph = readJson<RoutingGraph>("../data/utm/generated/survey-routing.json");

const entrances: Entrance[] = entranceFeatures.map((feature) => ({
  id: feature.id,
  buildingCode: feature.properties.buildingCode.toUpperCase(),
  coordinates: feature.geometry.coordinates,
  osmNodeId: feature.properties.osmNodeId,
  accessibility: feature.properties.accessibility,
  metadata: {
    source: feature.properties.source,
    sourceUrl: feature.properties.sourceUrl,
    lastVerified: feature.properties.lastVerified,
    verificationStatus: feature.properties.verificationStatus,
  },
}));

const graph: RoutingGraph = {
  nodes: [
    ...outdoorNodeFeatures.map((feature) => ({
      id: feature.id,
      ...feature.properties,
      longitude: feature.geometry.coordinates[0],
      latitude: feature.geometry.coordinates[1],
    })),
    ...surveyGraph.nodes,
  ],
  edges: [...outdoorEdges.edges, ...surveyGraph.edges],
};

const graphNodeIds = new Set(graph.nodes.map((node) => node.id));

function normalize(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function uniqueMetadata(values: Array<SourceMetadata | undefined>): SourceMetadata[] {
  const byKey = new Map<string, SourceMetadata>();
  for (const value of values) {
    if (!value) continue;
    byKey.set(`${value.source}|${value.sourceUrl}|${value.lastVerified}|${value.verificationStatus}`, value);
  }
  return [...byKey.values()];
}

function buildingEntrances(code: string) {
  return entrances.filter((entrance) => entrance.buildingCode === code);
}

function connectedEntranceNodes(code: string, preferences?: RoutePreferences): RoutingNode[] {
  return buildingEntrances(code)
    .filter((entrance) => {
      if (!graphNodeIds.has(`osm-node-${entrance.osmNodeId}`)) return false;
      if (preferences?.mode === "step-free" && entrance.accessibility !== "accessible") return false;
      return true;
    })
    .map((entrance) => graph.nodes.find((node) => node.id === `osm-node-${entrance.osmNodeId}`)!)
    .filter(Boolean);
}

function publicBuilding(building: BuildingConfiguration): PublicCampusBuilding {
  const mapped = buildingEntrances(building.code);
  const connected = connectedEntranceNodes(building.code);
  return {
    code: building.code,
    name: building.name,
    category: building.category,
    aliases: building.aliases ?? [],
    routing: {
      mappedEntrances: mapped.length,
      graphConnectedEntrances: connected.length,
      hasMappedRouteAccess: connected.length > 0,
      indoorMapped: surveyGraph.nodes.some((node) => node.buildingCode === building.code),
    },
    provenance: uniqueMetadata([building.metadata, ...mapped.map((entrance) => entrance.metadata)]),
  };
}

export function listCampusBuildings(): PublicCampusBuilding[] {
  return UTM_BUILDINGS.map(publicBuilding).sort((a, b) => a.code.localeCompare(b.code));
}

export function resolveCampusBuilding(query: string): PublicCampusBuilding | null {
  const target = normalize(query);
  if (!target) return null;
  const matches = UTM_BUILDINGS.filter((building) =>
    [building.code, building.name, ...(building.aliases ?? [])].some(
      (candidate) => normalize(candidate) === target,
    ),
  );
  return matches.length === 1 ? publicBuilding(matches[0]!) : null;
}

function haversineMeters(a: [number, number], b: [number, number]) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function navigationPoint(code: string): [number, number] | null {
  return buildingEntrances(code)[0]?.coordinates ?? null;
}

function bestRoute(fromCode: string, toCode: string, preferences: RoutePreferences): RouteResult | null {
  const starts = connectedEntranceNodes(fromCode, preferences);
  const ends = connectedEntranceNodes(toCode, preferences);
  return starts
    .flatMap((start) =>
      ends.map((end) => ({
        start,
        end,
        result: findRoute(graph, start.id, end.id, preferences),
      })),
    )
    .filter((candidate): candidate is typeof candidate & { result: RouteResult } => candidate.result !== null)
    .sort(
      (a, b) =>
        a.result.estimatedSeconds - b.result.estimatedSeconds ||
        a.start.id.localeCompare(b.start.id) ||
        a.end.id.localeCompare(b.end.id),
    )[0]?.result ?? null;
}

export function routeBetweenCampusBuildings(
  fromQuery: string,
  toQuery: string,
  requestedPreferences?: Partial<RoutePreferences> | null,
): PublicCampusRoute | null {
  const from = resolveCampusBuilding(fromQuery);
  const to = resolveCampusBuilding(toQuery);
  if (!from || !to) return null;
  const preferences = sanitizeRoutePreferences(requestedPreferences ?? DEFAULT_ROUTE_PREFERENCES);
  const provenance = uniqueMetadata([
    ...from.provenance,
    ...to.provenance,
    outdoorEdges.metadata,
  ]);

  if (from.code === to.code) {
    return {
      from,
      to,
      preferences,
      status: "same-building",
      accuracy: "Same building",
      distanceMeters: 0,
      estimatedSeconds: 0,
      indoorDistanceMeters: null,
      outdoorDistanceMeters: null,
      floorChanges: null,
      warnings: ["Room-to-room indoor routing is not implied by a building-level route."],
      provenance,
    };
  }

  const route = bestRoute(from.code, to.code, preferences);
  if (route) {
    return {
      from,
      to,
      preferences,
      status: "routed",
      accuracy: "Mapped campus path, indoor estimate",
      distanceMeters: route.totalDistanceMeters,
      estimatedSeconds: route.estimatedSeconds,
      indoorDistanceMeters: route.indoorDistanceMeters,
      outdoorDistanceMeters: route.outdoorDistanceMeters,
      floorChanges: route.floorChanges,
      warnings: [
        ...route.warnings,
        `Indoor room routing is not included for ${from.code} or ${to.code}.`,
      ],
      provenance,
    };
  }

  if (preferences.mode === "step-free") {
    return {
      from,
      to,
      preferences,
      status: "unavailable",
      accuracy: "Location unavailable",
      distanceMeters: null,
      estimatedSeconds: null,
      indoorDistanceMeters: null,
      outdoorDistanceMeters: null,
      floorChanges: null,
      warnings: [
        "No verified step-free route is available in the current Gapwise dataset.",
        "Gapwise will not substitute stairs or an unverified entrance in step-free mode.",
      ],
      provenance,
    };
  }

  const fromPoint = navigationPoint(from.code);
  const toPoint = navigationPoint(to.code);
  if (!fromPoint || !toPoint) {
    return {
      from,
      to,
      preferences,
      status: "unavailable",
      accuracy: "Location unavailable",
      distanceMeters: null,
      estimatedSeconds: null,
      indoorDistanceMeters: null,
      outdoorDistanceMeters: null,
      floorChanges: null,
      warnings: ["Verified map coordinates are unavailable for one or both buildings."],
      provenance,
    };
  }

  const distanceMeters = haversineMeters(fromPoint, toPoint);
  return {
    from,
    to,
    preferences,
    status: "approximate",
    accuracy: "Approximate building-to-building estimate",
    distanceMeters,
    estimatedSeconds: distanceMeters / preferences.walkingSpeedMps + 20,
    indoorDistanceMeters: null,
    outdoorDistanceMeters: null,
    floorChanges: null,
    warnings: [
      "Verified walking path unavailable; this is a straight-line building-to-building estimate.",
      "No path geometry is returned for approximate routes.",
    ],
    provenance,
  };
}

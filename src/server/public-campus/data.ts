import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UTM_BUILDINGS, type BuildingConfiguration } from "../../data/utm/building-registry.js";
import type {
  AccessibilityStatus,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
  SourceMetadata,
  VerificationStatus,
} from "../../features/routing/types.js";

const DATA_ROOT = resolve(process.cwd(), "src/data/utm");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(DATA_ROOT, path), "utf8")) as T;
}

type EntranceFeature = {
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    buildingCode: string;
    label: string;
    kind: "entrance" | "approach";
    osmNodeId: number;
    accessibility: AccessibilityStatus;
    notes?: string;
    source: string;
    sourceUrl: string;
    lastVerified: string;
    verificationStatus: VerificationStatus;
  };
};

type OutdoorNodeFeature = {
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Omit<RoutingNode, "id" | "longitude" | "latitude">;
};

type SurveyGraphFile = RoutingGraph & { schemaVersion?: number; surveyDate?: string };
type OutdoorEdgesFile = { edges: RoutingEdge[]; metadata?: SourceMetadata };
type FeatureCollection<T> = { features: T[]; metadata?: SourceMetadata };

export type PublicBuildingEntrance = {
  id: string;
  label: string;
  kind: "entrance" | "approach";
  coordinates: [number, number];
  routingNodeId: string;
  accessibility: AccessibilityStatus;
  notes: string | null;
  metadata: SourceMetadata;
};

export type PublicCampusBuilding = {
  code: string;
  name: string;
  category: BuildingConfiguration["category"];
  aliases: string[];
  entrances: PublicBuildingEntrance[];
  navigationPoint: [number, number] | null;
  routingCoverage: "mapped" | "identity-only";
  indoorRoomNodeCount: number;
  metadata: SourceMetadata | null;
};

let graphCache: RoutingGraph | null = null;
let buildingsCache: PublicCampusBuilding[] | null = null;

function entranceFeatures(): EntranceFeature[] {
  return readJson<FeatureCollection<EntranceFeature>>("entrances.geojson").features;
}

export function serverRoutingGraph(): RoutingGraph {
  if (graphCache) return graphCache;
  const outdoor = readJson<FeatureCollection<OutdoorNodeFeature>>("outdoor-nodes.geojson");
  const edges = readJson<OutdoorEdgesFile>("outdoor-edges.json");
  const survey = readJson<SurveyGraphFile>("generated/survey-routing.json");
  const outdoorNodes: RoutingNode[] = outdoor.features.map((feature) => ({
    id: feature.id,
    ...feature.properties,
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
  }));
  graphCache = {
    nodes: [...outdoorNodes, ...survey.nodes],
    edges: [...edges.edges, ...survey.edges],
  };
  return graphCache;
}

function toPublicEntrance(feature: EntranceFeature): PublicBuildingEntrance {
  return {
    id: feature.id,
    label: feature.properties.label,
    kind: feature.properties.kind,
    coordinates: feature.geometry.coordinates,
    routingNodeId: `osm-node-${feature.properties.osmNodeId}`,
    accessibility: feature.properties.accessibility,
    notes: feature.properties.notes ?? null,
    metadata: {
      source: feature.properties.source,
      sourceUrl: feature.properties.sourceUrl,
      lastVerified: feature.properties.lastVerified,
      verificationStatus: feature.properties.verificationStatus,
    },
  };
}

export function publicCampusBuildings(): PublicCampusBuilding[] {
  if (buildingsCache) return buildingsCache;
  const entrances = entranceFeatures();
  const graph = serverRoutingGraph();
  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  buildingsCache = UTM_BUILDINGS.map((building) => {
    const buildingEntrances = entrances
      .filter((feature) => feature.properties.buildingCode === building.code)
      .map(toPublicEntrance);
    const routableEntrances = buildingEntrances.filter((entrance) => nodeIds.has(entrance.routingNodeId));
    const indoorRoomNodeCount = graph.nodes.filter(
      (node) => node.kind === "room" && node.buildingCode === building.code,
    ).length;
    return {
      code: building.code,
      name: building.name,
      category: building.category,
      aliases: building.aliases ?? [],
      entrances: buildingEntrances,
      navigationPoint: buildingEntrances[0]?.coordinates ?? null,
      routingCoverage: routableEntrances.length > 0 ? "mapped" : "identity-only",
      indoorRoomNodeCount,
      metadata: building.metadata ?? null,
    };
  });
  return buildingsCache;
}

function normalize(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^A-Z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export type BuildingResolution =
  | { status: "found"; building: PublicCampusBuilding }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: PublicCampusBuilding[] };

export function resolvePublicBuilding(input: string): BuildingResolution {
  const query = normalize(input);
  if (!query) return { status: "not_found" };
  const buildings = publicCampusBuildings();
  const code = buildings.find((building) => normalize(building.code) === query);
  if (code) return { status: "found", building: code };

  const matches = buildings.filter((building) =>
    [building.name, ...building.aliases].some((value) => normalize(value) === query),
  );
  if (matches.length === 1) return { status: "found", building: matches[0]! };
  if (matches.length > 1) return { status: "ambiguous", candidates: matches };
  return { status: "not_found" };
}

export const PUBLIC_CAMPUS_DATA_VERSION = "2026-08-10";

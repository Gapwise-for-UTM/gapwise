import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UTM_BUILDINGS } from "../src/data/utm/building-registry";

const OSM_MAP_ENDPOINT = "https://api.openstreetmap.org/api/0.6/map";
const CAMPUS_BOUNDS = "-79.6715,43.5450,-79.6600,43.5524";
const DEFAULT_OUTPUT = "src/data/utm/building-footprints.geojson";
const DEFAULT_REPORT = "artifacts/utm-building-footprint-report.json";
const VERIFIED_AT = new Date().toISOString().slice(0, 10);

type Coordinate = [number, number];
type OsmTags = Record<string, string | undefined>;
type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: OsmTags };
type OsmWay = { type: "way"; id: number; nodes: number[]; tags?: OsmTags };
type OsmRelation = {
  type: "relation";
  id: number;
  members: Array<{ type: "node" | "way" | "relation"; ref: number; role: string }>;
  tags?: OsmTags;
};
type OsmElement = OsmNode | OsmWay | OsmRelation | { type: string; id?: number };
type OsmPayload = { elements: OsmElement[] };
type EntranceFeature = {
  id: string;
  geometry: { type: "Point"; coordinates: Coordinate };
  properties: { buildingCode: string; osmNodeId: number; kind: "entrance" | "approach" };
};
type Overrides = {
  version: 1;
  ways: Record<string, string>;
  relations?: Record<string, string>;
};
type PolygonGeometry = { type: "Polygon"; coordinates: Coordinate[][] };
type MultiPolygonGeometry = { type: "MultiPolygon"; coordinates: Coordinate[][][] };
type BuildingFeature = {
  type: "Feature";
  id: string;
  properties: {
    buildingCode: string;
    name: string;
    category: "academic" | "residence";
    source: "OpenStreetMap";
    sourceIds: string[];
    matchMethods: string[];
    lastVerified: string;
    verificationStatus: "verified";
  };
  geometry: PolygonGeometry | MultiPolygonGeometry;
};

type AssignmentMethod =
  | "override"
  | "reviewed-relation"
  | "exact-label"
  | "entrance-membership";
type AssignedGeometry = {
  code: string;
  method: AssignmentMethod;
  polygons: Coordinate[][][];
  sourceId: string;
  sourceType: "way" | "relation";
  osmId: number;
  tags: OsmTags | undefined;
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entrancePath = resolve(repositoryRoot, "src/data/utm/entrances.geojson");
const overridePath = resolve(repositoryRoot, "src/data/utm/building-footprint-overrides.json");

function argValue(flag: string, fallback: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

function normalizeLabel(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const codeByLabel = new Map(
  UTM_BUILDINGS.flatMap((building) =>
    [building.code, building.name, ...(building.aliases ?? [])].map(
      (label) => [normalizeLabel(label), building.code] as const,
    ),
  ),
);

function exactCodeForTags(tags: OsmTags | undefined) {
  if (!tags) return null;
  for (const value of [
    tags["ref"],
    tags["name"],
    tags["official_name"],
    tags["short_name"],
    tags["alt_name"],
  ]) {
    if (!value) continue;
    const code = codeByLabel.get(normalizeLabel(value));
    if (code) return code;
  }
  return null;
}

function isBuildingWay(way: OsmWay) {
  const building = way.tags?.["building"];
  const buildingPart = way.tags?.["building:part"];
  return Boolean((building && building !== "no") || (buildingPart && buildingPart !== "no"));
}

function isBuildingRelation(relation: OsmRelation, overrideCode: string | undefined) {
  const building = relation.tags?.["building"];
  const buildingPart = relation.tags?.["building:part"];
  return Boolean(
    overrideCode ||
      exactCodeForTags(relation.tags) ||
      ((relation.tags?.["type"] === "multipolygon" || relation.tags?.["type"] === "building") &&
        ((building && building !== "no") || (buildingPart && buildingPart !== "no"))),
  );
}

function polygonCenter(coordinates: Coordinate[]) {
  if (coordinates.length === 0) return null;
  const [longitude, latitude] = coordinates.reduce(
    ([x, y], [nextX, nextY]) => [x + nextX, y + nextY] as Coordinate,
    [0, 0] as Coordinate,
  );
  return [longitude / coordinates.length, latitude / coordinates.length] as Coordinate;
}

function closedRing(way: OsmWay, nodes: Map<number, OsmNode>): Coordinate[] | null {
  const coordinates = way.nodes.flatMap((id) => {
    const node = nodes.get(id);
    return node ? ([[node.lon, node.lat]] as Coordinate[]) : [];
  });
  if (coordinates.length < 4 || coordinates.length !== way.nodes.length) return null;
  const first = coordinates[0]!;
  const last = coordinates.at(-1)!;
  if (first[0] !== last[0] || first[1] !== last[1]) return null;
  return coordinates;
}

function nodeRingCoordinates(nodeIds: number[], nodes: Map<number, OsmNode>) {
  const coordinates = nodeIds.flatMap((id) => {
    const node = nodes.get(id);
    return node ? ([[node.lon, node.lat]] as Coordinate[]) : [];
  });
  if (coordinates.length !== nodeIds.length || coordinates.length < 4) return null;
  const first = coordinates[0]!;
  const last = coordinates.at(-1)!;
  return first[0] === last[0] && first[1] === last[1] ? coordinates : null;
}

function stitchMemberRings(memberWays: OsmWay[], nodes: Map<number, OsmNode>) {
  const remaining = memberWays.map((way) => [...way.nodes]);
  const rings: Coordinate[][] = [];

  while (remaining.length > 0) {
    const chain = remaining.shift()!;
    if (chain.length < 2) return null;

    while (chain[0] !== chain.at(-1)) {
      const first = chain[0]!;
      const last = chain.at(-1)!;
      const index = remaining.findIndex((candidate) => {
        const candidateFirst = candidate[0];
        const candidateLast = candidate.at(-1);
        return (
          candidateFirst === last ||
          candidateLast === last ||
          candidateLast === first ||
          candidateFirst === first
        );
      });
      if (index < 0) return null;
      const next = remaining.splice(index, 1)[0]!;
      const nextFirst = next[0]!;
      const nextLast = next.at(-1)!;
      if (nextFirst === last) chain.push(...next.slice(1));
      else if (nextLast === last) chain.push(...next.slice(0, -1).reverse());
      else if (nextLast === first) chain.unshift(...next.slice(0, -1));
      else if (nextFirst === first) chain.unshift(...next.slice(1).reverse());
    }

    const coordinates = nodeRingCoordinates(chain, nodes);
    if (!coordinates) return null;
    rings.push(coordinates);
  }

  return rings;
}

function pointInRing(point: Coordinate, ring: Coordinate[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index]!;
    const [xj, yj] = ring[previous]!;
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function relationPolygons(
  relation: OsmRelation,
  waysById: Map<number, OsmWay>,
  nodes: Map<number, OsmNode>,
) {
  const outerWays: OsmWay[] = [];
  const innerWays: OsmWay[] = [];
  for (const member of relation.members) {
    if (member.type !== "way") continue;
    const way = waysById.get(member.ref);
    if (!way) return null;
    if (member.role === "inner") innerWays.push(way);
    else if (member.role === "outer" || member.role === "") outerWays.push(way);
  }
  if (outerWays.length === 0) return null;
  const outerRings = stitchMemberRings(outerWays, nodes);
  const innerRings = innerWays.length > 0 ? stitchMemberRings(innerWays, nodes) : [];
  if (!outerRings || !innerRings) return null;

  const polygons = outerRings.map((outer) => [outer]);
  for (const inner of innerRings) {
    const sample = inner[0]!;
    const parentIndex = outerRings.findIndex((outer) => pointInRing(sample, outer));
    if (parentIndex < 0) return null;
    polygons[parentIndex]!.push(inner);
  }
  return polygons;
}

function relationMemberNodeIds(relation: OsmRelation, waysById: Map<number, OsmWay>) {
  return relation.members.flatMap((member) =>
    member.type === "way" ? (waysById.get(member.ref)?.nodes ?? []) : [],
  );
}

function resolveCandidates(
  overrideCode: string | undefined,
  exactCode: string | null,
  nodeIds: number[],
  entranceCodeByNode: Map<number, string>,
) {
  const candidates = new Set<string>();
  if (overrideCode) candidates.add(overrideCode);
  if (exactCode) candidates.add(exactCode);
  for (const nodeId of nodeIds) {
    const entranceCode = entranceCodeByNode.get(nodeId);
    if (entranceCode) candidates.add(entranceCode);
  }
  return [...candidates];
}

async function fetchOsmSnapshot(): Promise<OsmPayload> {
  const url = new URL(OSM_MAP_ENDPOINT);
  url.searchParams.set("bbox", CAMPUS_BOUNDS);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Gapwise-UTM canonical building footprint generator",
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap map API returned HTTP ${response.status}.`);
  const payload = (await response.json()) as OsmPayload;
  if (!Array.isArray(payload.elements))
    throw new Error("OpenStreetMap response is missing elements.");
  return payload;
}

async function main() {
  const outputPath = resolve(repositoryRoot, argValue("--output", DEFAULT_OUTPUT));
  const reportPath = resolve(repositoryRoot, argValue("--report", DEFAULT_REPORT));
  const requireComplete = process.argv.includes("--require-complete");
  const failOnAmbiguity = process.argv.includes("--fail-on-ambiguity");
  const [payload, entranceRaw, overrideRaw] = await Promise.all([
    fetchOsmSnapshot(),
    readFile(entrancePath, "utf8"),
    readFile(overridePath, "utf8"),
  ]);
  const entrances = (JSON.parse(entranceRaw) as { features: EntranceFeature[] }).features;
  const overrides = JSON.parse(overrideRaw) as Overrides;
  if (overrides.version !== 1)
    throw new Error(`Unsupported footprint override version ${overrides.version}.`);

  const nodes = new Map(
    payload.elements
      .filter((element): element is OsmNode => element.type === "node" && "lat" in element)
      .map((node) => [node.id, node]),
  );
  const ways = payload.elements.filter(
    (element): element is OsmWay => element.type === "way" && "nodes" in element,
  );
  const waysById = new Map(ways.map((way) => [way.id, way]));
  const relations = payload.elements.filter(
    (element): element is OsmRelation => element.type === "relation" && "members" in element,
  );
  const entranceCodeByNode = new Map(
    entrances
      .filter((entrance) => entrance.properties.kind === "entrance")
      .map((entrance) => [entrance.properties.osmNodeId, entrance.properties.buildingCode]),
  );
  const recognizedCodes = new Set(UTM_BUILDINGS.map((building) => building.code));
  const assigned: AssignedGeometry[] = [];
  const ambiguous: unknown[] = [];
  const unassigned: unknown[] = [];
  const assignedRelationMemberWays = new Set<number>();

  for (const relation of relations) {
    const overrideCode = overrides.relations?.[String(relation.id)]?.toUpperCase();
    if (!isBuildingRelation(relation, overrideCode)) continue;
    if (overrideCode && !recognizedCodes.has(overrideCode)) {
      throw new Error(
        `Footprint override for OSM relation ${relation.id} uses unknown building code ${overrideCode}.`,
      );
    }
    const polygons = relationPolygons(relation, waysById, nodes);
    if (!polygons) {
      unassigned.push({
        osmRelationId: relation.id,
        name: relation.tags?.["name"] ?? null,
        ref: relation.tags?.["ref"] ?? null,
        reason: "relation-rings-unavailable-or-invalid",
      });
      continue;
    }
    const exactCode = exactCodeForTags(relation.tags);
    const memberNodeIds = relationMemberNodeIds(relation, waysById);
    const candidateCodes = resolveCandidates(
      overrideCode,
      exactCode,
      memberNodeIds,
      entranceCodeByNode,
    );
    if (candidateCodes.length > 1) {
      ambiguous.push({
        osmRelationId: relation.id,
        name: relation.tags?.["name"] ?? null,
        ref: relation.tags?.["ref"] ?? null,
        candidateCodes,
        center: polygonCenter(polygons[0]?.[0] ?? []),
      });
      continue;
    }
    const code = candidateCodes[0];
    if (!code) {
      unassigned.push({
        osmRelationId: relation.id,
        name: relation.tags?.["name"] ?? null,
        ref: relation.tags?.["ref"] ?? null,
        reason: "no-canonical-building-code",
        center: polygonCenter(polygons[0]?.[0] ?? []),
      });
      continue;
    }
    const method: AssignmentMethod = overrideCode
      ? "reviewed-relation"
      : exactCode
        ? "exact-label"
        : "entrance-membership";
    assigned.push({
      code,
      method,
      polygons,
      sourceId: `relation/${relation.id}`,
      sourceType: "relation",
      osmId: relation.id,
      tags: relation.tags,
    });
    for (const member of relation.members) {
      if (member.type === "way") assignedRelationMemberWays.add(member.ref);
    }
  }

  for (const way of ways) {
    if (!isBuildingWay(way) || assignedRelationMemberWays.has(way.id)) continue;
    const coordinates = closedRing(way, nodes);
    if (!coordinates) continue;
    const overrideCode = overrides.ways[String(way.id)]?.toUpperCase();
    if (overrideCode && !recognizedCodes.has(overrideCode)) {
      throw new Error(
        `Footprint override for OSM way ${way.id} uses unknown building code ${overrideCode}.`,
      );
    }
    const exactCode = exactCodeForTags(way.tags);
    const candidateCodes = resolveCandidates(
      overrideCode,
      exactCode,
      way.nodes,
      entranceCodeByNode,
    );
    if (candidateCodes.length > 1) {
      ambiguous.push({
        osmWayId: way.id,
        name: way.tags?.["name"] ?? null,
        ref: way.tags?.["ref"] ?? null,
        candidateCodes,
        center: polygonCenter(coordinates),
      });
      continue;
    }
    const code = candidateCodes[0];
    if (!code) {
      unassigned.push({
        osmWayId: way.id,
        name: way.tags?.["name"] ?? null,
        ref: way.tags?.["ref"] ?? null,
        building: way.tags?.["building"] ?? null,
        buildingPart: way.tags?.["building:part"] ?? null,
        center: polygonCenter(coordinates),
      });
      continue;
    }
    const method: AssignmentMethod = overrideCode
      ? "override"
      : exactCode
        ? "exact-label"
        : "entrance-membership";
    assigned.push({
      code,
      method,
      polygons: [[coordinates]],
      sourceId: `way/${way.id}`,
      sourceType: "way",
      osmId: way.id,
      tags: way.tags,
    });
  }

  const grouped = new Map<string, AssignedGeometry[]>();
  for (const record of assigned) {
    const list = grouped.get(record.code) ?? [];
    list.push(record);
    grouped.set(record.code, list);
  }

  const features: BuildingFeature[] = UTM_BUILDINGS.flatMap((building) => {
    const records = grouped.get(building.code) ?? [];
    if (records.length === 0) return [];
    const polygons = records.flatMap((record) => record.polygons);
    return [
      {
        type: "Feature",
        id: building.code,
        properties: {
          buildingCode: building.code,
          name: building.name,
          category: building.category,
          source: "OpenStreetMap",
          sourceIds: [...new Set(records.map((record) => record.sourceId))].sort(),
          matchMethods: [...new Set(records.map((record) => record.method))].sort(),
          lastVerified: VERIFIED_AT,
          verificationStatus: "verified",
        },
        geometry:
          polygons.length === 1
            ? { type: "Polygon", coordinates: polygons[0]! }
            : { type: "MultiPolygon", coordinates: polygons },
      } satisfies BuildingFeature,
    ];
  });

  const missingCodes = UTM_BUILDINGS.map((building) => building.code).filter(
    (code) => !grouped.has(code),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    source: OSM_MAP_ENDPOINT,
    bbox: CAMPUS_BOUNDS,
    resolvedCodes: features.map((feature) => feature.properties.buildingCode),
    missingCodes,
    ambiguous,
    unassigned,
    assignedSources: assigned.map((record) => ({
      sourceId: record.sourceId,
      sourceType: record.sourceType,
      osmId: record.osmId,
      buildingCode: record.code,
      method: record.method,
      name: record.tags?.["name"] ?? null,
      ref: record.tags?.["ref"] ?? null,
      center: polygonCenter(record.polygons[0]?.[0] ?? []),
    })),
  };
  const collection = {
    type: "FeatureCollection" as const,
    metadata: {
      description:
        "Canonical UTM building footprint geometry used for Gapwise hit-testing and camera focus.",
      source: "OpenStreetMap",
      sourceUrl: "https://www.openstreetmap.org/",
      generatedAt: report.generatedAt,
      verificationStatus: "verified",
      matchingPolicy:
        "Exact registry labels, explicit reviewed OSM way/relation overrides, or topological membership of a verified entrance node. Proximity guessing is forbidden.",
    },
    features,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Generated ${features.length} canonical building footprints.`);
  console.log(`Missing registry codes: ${missingCodes.join(", ") || "none"}.`);
  console.log(`Ambiguous building geometries: ${ambiguous.length}.`);
  console.log(`Report: ${reportPath}`);

  if (failOnAmbiguity && ambiguous.length > 0) {
    throw new Error(
      "Ambiguous UTM building geometry was found. Resolve it with explicit reviewed OSM overrides before accepting the generated dataset.",
    );
  }
  if (requireComplete && missingCodes.length > 0) {
    throw new Error(`Canonical footprint coverage is incomplete: ${missingCodes.join(", ")}.`);
  }
}

await main();

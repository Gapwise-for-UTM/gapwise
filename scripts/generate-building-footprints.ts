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

type AssignedWay = {
  way: OsmWay;
  code: string;
  method: "override" | "exact-label" | "entrance-membership";
  coordinates: Coordinate[];
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
  if (coordinates.length < 3 || coordinates.length !== way.nodes.length) return null;
  const first = coordinates[0]!;
  const last = coordinates.at(-1)!;
  if (first[0] !== last[0] || first[1] !== last[1]) coordinates.push([...first] as Coordinate);
  return coordinates.length >= 4 ? coordinates : null;
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
  if (!Array.isArray(payload.elements)) throw new Error("OpenStreetMap response is missing elements.");
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
  if (overrides.version !== 1) throw new Error(`Unsupported footprint override version ${overrides.version}.`);

  const nodes = new Map(
    payload.elements
      .filter((element): element is OsmNode => element.type === "node" && "lat" in element)
      .map((node) => [node.id, node]),
  );
  const ways = payload.elements.filter(
    (element): element is OsmWay => element.type === "way" && "nodes" in element,
  );
  const entranceCodeByNode = new Map(
    entrances
      .filter((entrance) => entrance.properties.kind === "entrance")
      .map((entrance) => [entrance.properties.osmNodeId, entrance.properties.buildingCode]),
  );
  const recognizedCodes = new Set(UTM_BUILDINGS.map((building) => building.code));
  const assigned: AssignedWay[] = [];
  const ambiguous: unknown[] = [];
  const unassigned: unknown[] = [];

  for (const way of ways) {
    if (!isBuildingWay(way)) continue;
    const coordinates = closedRing(way, nodes);
    if (!coordinates) continue;
    const overrideCode = overrides.ways[String(way.id)]?.toUpperCase();
    if (overrideCode && !recognizedCodes.has(overrideCode)) {
      throw new Error(`Footprint override for OSM way ${way.id} uses unknown building code ${overrideCode}.`);
    }
    const exactCode = exactCodeForTags(way.tags);
    const entranceCodes = new Set(
      way.nodes.flatMap((nodeId) => {
        const code = entranceCodeByNode.get(nodeId);
        return code ? [code] : [];
      }),
    );

    const candidates = new Set<string>();
    if (overrideCode) candidates.add(overrideCode);
    if (exactCode) candidates.add(exactCode);
    for (const code of entranceCodes) candidates.add(code);
    const candidateCodes = [...candidates];
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
    const method: AssignedWay["method"] = overrideCode
      ? "override"
      : exactCode
        ? "exact-label"
        : "entrance-membership";
    assigned.push({ way, code, method, coordinates });
  }

  const grouped = new Map<string, AssignedWay[]>();
  for (const record of assigned) {
    const list = grouped.get(record.code) ?? [];
    list.push(record);
    grouped.set(record.code, list);
  }

  const features: BuildingFeature[] = UTM_BUILDINGS.flatMap((building) => {
    const records = grouped.get(building.code) ?? [];
    if (records.length === 0) return [];
    const polygons = records.map((record) => [record.coordinates]);
    return [
      {
        type: "Feature",
        id: building.code,
        properties: {
          buildingCode: building.code,
          name: building.name,
          category: building.category,
          source: "OpenStreetMap",
          sourceIds: records.map((record) => `way/${record.way.id}`).sort(),
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
    assignedWays: assigned.map((record) => ({
      osmWayId: record.way.id,
      buildingCode: record.code,
      method: record.method,
      name: record.way.tags?.["name"] ?? null,
      ref: record.way.tags?.["ref"] ?? null,
      center: polygonCenter(record.coordinates),
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
        "Exact registry labels, explicit reviewed OSM-way overrides, or topological membership of a verified entrance node. Proximity guessing is forbidden.",
    },
    features,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Generated ${features.length} canonical building footprints.`);
  console.log(`Missing registry codes: ${missingCodes.join(", ") || "none"}.`);
  console.log(`Ambiguous building ways: ${ambiguous.length}.`);
  console.log(`Report: ${reportPath}`);

  if (failOnAmbiguity && ambiguous.length > 0) {
    throw new Error(
      "Ambiguous UTM building geometry was found. Resolve it with explicit reviewed OSM-way overrides before accepting the generated dataset.",
    );
  }
  if (requireComplete && missingCodes.length > 0) {
    throw new Error(`Canonical footprint coverage is incomplete: ${missingCodes.join(", ")}.`);
  }
}

await main();

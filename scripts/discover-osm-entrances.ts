import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPUS_BUILDING_FOOTPRINTS } from "../src/data/utm/building-footprints";

const OSM_MAP_ENDPOINT = "https://api.openstreetmap.org/api/0.6/map";
const CAMPUS_BOUNDS = "-79.6715,43.5450,-79.6600,43.5524";
const MATCH_DISTANCE_METERS = 2.0;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type Tags = Record<string, string | undefined>;
type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: Tags };
type OsmPayload = { elements: Array<OsmNode | { type: string }> };
type Ring = [number, number][];
type Geometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

type Match = {
  buildingCode: string;
  buildingName: string;
  inside: boolean;
  boundaryDistanceMeters: number;
};

type Candidate = {
  osmNodeId: number;
  coordinates: [number, number];
  entrance: string;
  tags: Tags;
  existingGapwiseRecord: boolean;
  matches: Match[];
  recommendedBuildingCode: string | null;
  reviewStatus: "unique_boundary_match" | "ambiguous" | "unmatched";
};

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function projectMeters([lon, lat]: [number, number], referenceLat: number): [number, number] {
  const earth = 6_371_000;
  return [earth * radians(lon) * Math.cos(radians(referenceLat)), earth * radians(lat)];
}

function pointSegmentDistanceMeters(
  point: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const referenceLat = point[1];
  const p = projectMeters(point, referenceLat);
  const pa = projectMeters(a, referenceLat);
  const pb = projectMeters(b, referenceLat);
  const vx = pb[0] - pa[0];
  const vy = pb[1] - pa[1];
  const wx = p[0] - pa[0];
  const wy = p[1] - pa[1];
  const denominator = vx * vx + vy * vy;
  const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / denominator));
  return Math.hypot(p[0] - (pa[0] + t * vx), p[1] - (pa[1] + t * vy));
}

function pointInRing(point: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: [number, number], polygon: Ring[]): boolean {
  const [outer, ...holes] = polygon;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

function polygons(geometry: Geometry): Ring[][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function boundaryDistanceMeters(point: [number, number], geometry: Geometry): number {
  let best = Number.POSITIVE_INFINITY;
  for (const polygon of polygons(geometry)) {
    for (const ring of polygon) {
      for (let index = 0; index < ring.length - 1; index += 1) {
        best = Math.min(best, pointSegmentDistanceMeters(point, ring[index]!, ring[index + 1]!));
      }
    }
  }
  return best;
}

function insideGeometry(point: [number, number], geometry: Geometry): boolean {
  return polygons(geometry).some((polygon) => pointInPolygon(point, polygon));
}

async function fetchOsm(): Promise<OsmPayload> {
  const url = new URL(OSM_MAP_ENDPOINT);
  url.searchParams.set("bbox", CAMPUS_BOUNDS);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Gapwise-UTM entrance discovery audit",
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap map API returned HTTP ${response.status}.`);
  return (await response.json()) as OsmPayload;
}

async function main() {
  const payload = await fetchOsm();
  const existingRaw = await readFile(resolve(root, "src/data/utm/entrances.geojson"), "utf8");
  const existing = JSON.parse(existingRaw) as {
    features: Array<{ properties: { osmNodeId?: number } }>;
  };
  const existingIds = new Set(
    existing.features.flatMap((feature) =>
      feature.properties.osmNodeId === undefined ? [] : [feature.properties.osmNodeId],
    ),
  );

  const entranceNodes = payload.elements
    .filter(
      (element): element is OsmNode =>
        element.type === "node" && "lat" in element && "lon" in element,
    )
    .filter((node) => Boolean(node.tags?.["entrance"]) && node.tags?.["entrance"] !== "no")
    .sort((a, b) => a.id - b.id);

  const candidates: Candidate[] = entranceNodes.map((node) => {
    const point: [number, number] = [node.lon, node.lat];
    const matches = CAMPUS_BUILDING_FOOTPRINTS.features
      .map((feature): Match => ({
        buildingCode: feature.properties.buildingCode,
        buildingName: feature.properties.name,
        inside: insideGeometry(point, feature.geometry),
        boundaryDistanceMeters: boundaryDistanceMeters(point, feature.geometry),
      }))
      .filter((match) => match.inside || match.boundaryDistanceMeters <= MATCH_DISTANCE_METERS)
      .sort(
        (a, b) =>
          a.boundaryDistanceMeters - b.boundaryDistanceMeters ||
          a.buildingCode.localeCompare(b.buildingCode),
      );
    const unique = matches.length === 1 && matches[0]!.boundaryDistanceMeters <= MATCH_DISTANCE_METERS;
    return {
      osmNodeId: node.id,
      coordinates: point,
      entrance: node.tags?.["entrance"] ?? "yes",
      tags: node.tags ?? {},
      existingGapwiseRecord: existingIds.has(node.id),
      matches,
      recommendedBuildingCode: unique ? matches[0]!.buildingCode : null,
      reviewStatus: unique
        ? "unique_boundary_match"
        : matches.length > 0
          ? "ambiguous"
          : "unmatched",
    };
  });

  const outputDir = resolve(root, "artifacts");
  await mkdir(outputDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    source: OSM_MAP_ENDPOINT,
    campusBounds: CAMPUS_BOUNDS,
    matchDistanceMeters: MATCH_DISTANCE_METERS,
    totalEntranceNodes: candidates.length,
    existingEntranceNodes: candidates.filter((candidate) => candidate.existingGapwiseRecord).length,
    newUniqueBoundaryMatches: candidates.filter(
      (candidate) =>
        !candidate.existingGapwiseRecord && candidate.reviewStatus === "unique_boundary_match",
    ).length,
    ambiguous: candidates.filter((candidate) => candidate.reviewStatus === "ambiguous").length,
    unmatched: candidates.filter((candidate) => candidate.reviewStatus === "unmatched").length,
    candidates,
  };
  await writeFile(
    resolve(outputDir, "utm-osm-entrance-candidates.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const rows = candidates.map((candidate) => {
    const best = candidate.matches[0];
    return `| ${candidate.osmNodeId} | ${candidate.entrance} | ${candidate.coordinates[1].toFixed(7)}, ${candidate.coordinates[0].toFixed(7)} | ${candidate.existingGapwiseRecord ? "yes" : "no"} | ${candidate.reviewStatus} | ${best ? `${best.buildingCode} (${best.boundaryDistanceMeters.toFixed(2)} m)` : "—"} |`;
  });
  const markdown = [
    "# Current OSM UTM entrance candidates",
    "",
    `Generated from the OpenStreetMap map API for campus bounds \`${CAMPUS_BOUNDS}\`. A \`unique_boundary_match\` means an entrance-tagged OSM node lies inside or within ${MATCH_DISTANCE_METERS.toFixed(1)} m of exactly one canonical Gapwise building footprint. This is a review candidate, not an automatic public-access or accessibility claim.`,
    "",
    `- entrance-tagged nodes: ${report.totalEntranceNodes}`,
    `- already represented in Gapwise: ${report.existingEntranceNodes}`,
    `- new unique building-boundary matches: ${report.newUniqueBoundaryMatches}`,
    `- ambiguous: ${report.ambiguous}`,
    `- unmatched: ${report.unmatched}`,
    "",
    "| OSM node | entrance tag | coordinate | existing | review | nearest canonical building |",
    "| ---: | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  await writeFile(resolve(outputDir, "utm-osm-entrance-candidates.md"), markdown);
  console.log(
    JSON.stringify({
      total: report.totalEntranceNodes,
      existing: report.existingEntranceNodes,
      newUnique: report.newUniqueBoundaryMatches,
      ambiguous: report.ambiguous,
      unmatched: report.unmatched,
    }),
  );
}

await main();

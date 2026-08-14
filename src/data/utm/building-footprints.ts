import { getRecognizedBuilding } from "./building-registry";
import footprintDataRaw from "./building-footprints.geojson?raw";

export type FootprintCoordinate = [longitude: number, latitude: number];
export type FootprintPolygon = { type: "Polygon"; coordinates: FootprintCoordinate[][] };
export type FootprintMultiPolygon = {
  type: "MultiPolygon";
  coordinates: FootprintCoordinate[][][];
};
export type CampusBuildingFootprint = {
  type: "Feature";
  id: string;
  properties: {
    buildingCode: string;
    name: string;
    category: "academic" | "residence";
    source: string;
    sourceIds: string[];
    matchMethods: string[];
    lastVerified: string;
    verificationStatus: "verified";
  };
  geometry: FootprintPolygon | FootprintMultiPolygon;
};
export type CampusBuildingFootprintCollection = {
  type: "FeatureCollection";
  metadata: Record<string, unknown>;
  features: CampusBuildingFootprint[];
};

const parsed = JSON.parse(footprintDataRaw) as CampusBuildingFootprintCollection;

function assertCoordinate([longitude, latitude]: FootprintCoordinate) {
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(`Invalid canonical building footprint coordinate ${longitude},${latitude}.`);
  }
}

function geometryRings(geometry: CampusBuildingFootprint["geometry"]) {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

function validateCollection(collection: CampusBuildingFootprintCollection) {
  if (collection.type !== "FeatureCollection") {
    throw new Error("Canonical UTM building footprints must be a GeoJSON FeatureCollection.");
  }
  const seen = new Set<string>();
  for (const feature of collection.features) {
    const code = feature.properties.buildingCode.toUpperCase();
    if (!getRecognizedBuilding(code)) {
      throw new Error(`Canonical building footprint uses unknown code ${code}.`);
    }
    if (seen.has(code)) throw new Error(`Duplicate canonical building footprint for ${code}.`);
    seen.add(code);
    if (feature.id !== code) throw new Error(`Canonical building footprint ${code} has mismatched id.`);
    for (const ring of geometryRings(feature.geometry)) {
      if (ring.length < 4) throw new Error(`Canonical building footprint ${code} has an invalid ring.`);
      for (const coordinate of ring) assertCoordinate(coordinate);
      const first = ring[0]!;
      const last = ring.at(-1)!;
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error(`Canonical building footprint ${code} contains an open ring.`);
      }
    }
  }
}

validateCollection(parsed);

export const CAMPUS_BUILDING_FOOTPRINTS = parsed;
const footprintByCode = new Map(
  CAMPUS_BUILDING_FOOTPRINTS.features.map((feature) => [
    feature.properties.buildingCode.toUpperCase(),
    feature,
  ]),
);

export function getCampusBuildingFootprint(code: string | null) {
  return code ? (footprintByCode.get(code.toUpperCase()) ?? null) : null;
}

export function footprintGeometryPoints(geometry: CampusBuildingFootprint["geometry"]) {
  return geometryRings(geometry).flat() as FootprintCoordinate[];
}

export function getCampusBuildingFootprintBounds(code: string | null) {
  const feature = getCampusBuildingFootprint(code);
  if (!feature) return null;
  const points = footprintGeometryPoints(feature.geometry);
  if (points.length === 0) return null;
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  }
  return [
    [west, south],
    [east, north],
  ] as [FootprintCoordinate, FootprintCoordinate];
}

function pointInRing(point: FootprintCoordinate, ring: FootprintCoordinate[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index]!;
    const previousPoint = ring[previous]!;
    const [x, y] = point;
    const [xi, yi] = currentPoint;
    const [xj, yj] = previousPoint;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: FootprintCoordinate, rings: FootprintCoordinate[][]) {
  const outer = rings[0];
  if (!outer || !pointInRing(point, outer)) return false;
  return !rings.slice(1).some((hole) => pointInRing(point, hole));
}

export function pointInBuildingFootprint(
  point: FootprintCoordinate,
  feature: CampusBuildingFootprint,
) {
  if (feature.geometry.type === "Polygon") {
    return pointInPolygon(point, feature.geometry.coordinates);
  }
  return feature.geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
}

export function buildingCodeAtCoordinate(point: FootprintCoordinate) {
  const matches = CAMPUS_BUILDING_FOOTPRINTS.features.filter((feature) =>
    pointInBuildingFootprint(point, feature),
  );
  return matches.length === 1 ? matches[0]!.properties.buildingCode : null;
}

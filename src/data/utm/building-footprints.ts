import { getRecognizedBuilding, UTM_BUILDINGS } from "./building-registry";
import { CANONICAL_FOOTPRINT_FRAGMENT_RAW } from "./footprint-fragments";

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
    category: "academic" | "residence" | "facility";
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

type FootprintFragment = CampusBuildingFootprint;
const fragments = CANONICAL_FOOTPRINT_FRAGMENT_RAW.map(
  (raw) => JSON.parse(raw) as FootprintFragment,
);

function geometryPolygons(
  geometry: CampusBuildingFootprint["geometry"],
): FootprintCoordinate[][][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function geometryRings(geometry: CampusBuildingFootprint["geometry"]) {
  return geometryPolygons(geometry).flat();
}

function validateGeometry(code: string, geometry: CampusBuildingFootprint["geometry"]) {
  const polygons = geometryPolygons(geometry);
  if (polygons.length === 0)
    throw new Error(`Canonical building footprint ${code} has no polygons.`);
  for (const polygon of polygons) {
    if (polygon.length === 0)
      throw new Error(`Canonical building footprint ${code} has an empty polygon.`);
    for (const ring of polygon) {
      if (ring.length < 4)
        throw new Error(`Canonical building footprint ${code} has an invalid ring.`);
      for (const [longitude, latitude] of ring) {
        if (
          !Number.isFinite(longitude) ||
          !Number.isFinite(latitude) ||
          longitude < -180 ||
          longitude > 180 ||
          latitude < -90 ||
          latitude > 90
        ) {
          throw new Error(
            `Invalid canonical building footprint coordinate ${longitude},${latitude}.`,
          );
        }
      }
      const first = ring[0]!;
      const last = ring.at(-1)!;
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error(`Canonical building footprint ${code} contains an open ring.`);
      }
    }
  }
}

function mergeFragments(): CampusBuildingFootprint[] {
  const grouped = new Map<string, FootprintFragment[]>();
  for (const fragment of fragments) {
    const code = fragment.properties.buildingCode.toUpperCase();
    if (!getRecognizedBuilding(code)) {
      throw new Error(`Canonical building footprint fragment uses unknown code ${code}.`);
    }
    validateGeometry(code, fragment.geometry);
    const records = grouped.get(code) ?? [];
    records.push(fragment);
    grouped.set(code, records);
  }

  return UTM_BUILDINGS.map((building) => {
    const records = grouped.get(building.code) ?? [];
    if (records.length === 0) {
      throw new Error(`Canonical UTM footprint coverage is missing ${building.code}.`);
    }
    const polygons = records.flatMap((record) => geometryPolygons(record.geometry));
    const feature: CampusBuildingFootprint = {
      type: "Feature",
      id: building.code,
      properties: {
        buildingCode: building.code,
        name: building.name,
        category: building.category,
        source: "OpenStreetMap",
        sourceIds: [...new Set(records.flatMap((record) => record.properties.sourceIds))].sort(),
        matchMethods: [
          ...new Set(records.flatMap((record) => record.properties.matchMethods)),
        ].sort(),
        lastVerified: records
          .map((record) => record.properties.lastVerified)
          .sort()
          .at(-1)!,
        verificationStatus: "verified",
      },
      geometry:
        polygons.length === 1
          ? { type: "Polygon", coordinates: polygons[0]! }
          : { type: "MultiPolygon", coordinates: polygons },
    };
    validateGeometry(building.code, feature.geometry);
    return feature;
  });
}

/**
 * UTM Facilities treats Kaneff Centre and Innovation Complex as distinct named
 * buildings at one shared public code/address. Current OSM geometry has the
 * Innovation footprint nested inside the broader Kaneff envelope, so make the
 * canonical interaction geometries mutually exclusive by cutting the exact
 * Innovation outer ring out of the exact Kaneff polygon as a hole. Both source
 * boundaries and source IDs remain authoritative; only hit-testing ownership is
 * partitioned.
 */
function partitionSharedKaneffComplex(features: CampusBuildingFootprint[]) {
  const kaneff = features.find((feature) => feature.properties.buildingCode === "KN");
  const innovation = features.find((feature) => feature.properties.buildingCode === "IC");
  if (!kaneff || !innovation) return features;

  const innovationPolygons = geometryPolygons(innovation.geometry);
  const kaneffPolygons = geometryPolygons(kaneff.geometry).map((polygon) => {
    const outer = polygon[0];
    if (!outer) return polygon;
    const nestedRings = innovationPolygons
      .map((candidate) => candidate[0])
      .filter((ring): ring is FootprintCoordinate[] => Boolean(ring?.[0]))
      .filter((ring) => pointInRing(ring[0]!, outer));
    return nestedRings.length > 0 ? [...polygon, ...nestedRings] : polygon;
  });

  const partitionedKaneff: CampusBuildingFootprint = {
    ...kaneff,
    geometry:
      kaneffPolygons.length === 1
        ? { type: "Polygon", coordinates: kaneffPolygons[0]! }
        : { type: "MultiPolygon", coordinates: kaneffPolygons },
  };
  validateGeometry("KN", partitionedKaneff.geometry);
  return features.map((feature) =>
    feature.properties.buildingCode === "KN" ? partitionedKaneff : feature,
  );
}

export const CAMPUS_BUILDING_FOOTPRINTS: CampusBuildingFootprintCollection = {
  type: "FeatureCollection",
  metadata: {
    description:
      "Canonical UTM geometry used for building identity, hit-testing, highlighting, and camera focus.",
    source: "OpenStreetMap",
    matchingPolicy:
      "Exact source identity or explicitly reviewed relation/way geometry only. Proximity matching is forbidden.",
  },
  features: partitionSharedKaneffComplex(mergeFragments()),
};

const footprintByCode = new Map(
  CAMPUS_BUILDING_FOOTPRINTS.features.map((feature) => [feature.properties.buildingCode, feature]),
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

function pointOnSegment(
  point: FootprintCoordinate,
  start: FootprintCoordinate,
  end: FootprintCoordinate,
) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const squaredLength = dx * dx + dy * dy;
  if (squaredLength <= 1e-24) {
    const pointDx = point[0] - start[0];
    const pointDy = point[1] - start[1];
    return pointDx * pointDx + pointDy * pointDy <= 1e-24;
  }
  const cross = (point[1] - start[1]) * dx - (point[0] - start[0]) * dy;
  if (Math.abs(cross) > 1e-11) return false;
  const dot = (point[0] - start[0]) * dx + (point[1] - start[1]) * dy;
  if (dot < 0) return false;
  return dot <= squaredLength;
}

function pointInRing(point: FootprintCoordinate, ring: FootprintCoordinate[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index]!;
    const previousPoint = ring[previous]!;
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
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
  return geometryPolygons(feature.geometry).some((polygon) => pointInPolygon(point, polygon));
}

export function buildingCodeAtCoordinate(point: FootprintCoordinate) {
  const matches = CAMPUS_BUILDING_FOOTPRINTS.features.filter((feature) =>
    pointInBuildingFootprint(point, feature),
  );
  return matches.length === 1 ? matches[0]!.properties.buildingCode : null;
}

export function representativePointForFootprint(feature: CampusBuildingFootprint) {
  const bounds = getCampusBuildingFootprintBounds(feature.properties.buildingCode);
  if (!bounds) return null;
  const [[west, south], [east, north]] = bounds;
  const code = feature.properties.buildingCode;
  for (let row = 1; row < 40; row += 1) {
    for (let column = 1; column < 40; column += 1) {
      const point: FootprintCoordinate = [
        west + ((east - west) * column) / 40,
        south + ((north - south) * row) / 40,
      ];
      if (pointInBuildingFootprint(point, feature) && buildingCodeAtCoordinate(point) === code) {
        return point;
      }
    }
  }
  return null;
}

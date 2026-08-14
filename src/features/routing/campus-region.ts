import type { RoutingGraph } from "./types";

export type CampusCoordinate = [longitude: number, latitude: number];
export type CampusBounds = [southWest: CampusCoordinate, northEast: CampusCoordinate];
export type CampusSegment = [start: CampusCoordinate, end: CampusCoordinate];

export const CAMPUS_LOCATION_MAX_NETWORK_DISTANCE_METERS = 110;
export const CAMPUS_CAMERA_PADDING_METERS = 140;

export type CompiledCampusRegion = {
  hull: CampusCoordinate[];
  nodes: CampusCoordinate[];
  segments: CampusSegment[];
  bounds: CampusBounds;
};

const compiledRegions = new WeakMap<RoutingGraph, CompiledCampusRegion>();

function cross(origin: CampusCoordinate, a: CampusCoordinate, b: CampusCoordinate) {
  return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
}

export function convexHull(points: CampusCoordinate[]): CampusCoordinate[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = sorted.filter(
    (point, index) =>
      index === 0 || point[0] !== sorted[index - 1]![0] || point[1] !== sorted[index - 1]![1],
  );
  if (unique.length <= 2) return unique;

  const lower: CampusCoordinate[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }

  const upper: CampusCoordinate[] = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

export function pointInPolygon(point: CampusCoordinate, polygon: CampusCoordinate[]) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function distanceMeters(a: CampusCoordinate, b: CampusCoordinate) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const radius = 6_371_000;
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const latA = radians(a[1]);
  const latB = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

/** Distance to a short campus routing segment using a local equirectangular projection. */
export function distanceToSegmentMeters(
  point: CampusCoordinate,
  start: CampusCoordinate,
  end: CampusCoordinate,
) {
  const latitudeRadians = (point[1] * Math.PI) / 180;
  const metresPerLatitudeDegree = 111_320;
  const metresPerLongitudeDegree = Math.max(1, 111_320 * Math.cos(latitudeRadians));
  const toLocal = ([longitude, latitude]: CampusCoordinate) => [
    (longitude - point[0]) * metresPerLongitudeDegree,
    (latitude - point[1]) * metresPerLatitudeDegree,
  ] as const;
  const [sx, sy] = toLocal(start);
  const [ex, ey] = toLocal(end);
  const dx = ex - sx;
  const dy = ey - sy;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-12) return Math.hypot(sx, sy);
  const t = Math.max(0, Math.min(1, -(sx * dx + sy * dy) / lengthSquared));
  return Math.hypot(sx + t * dx, sy + t * dy);
}

function boundsForCoordinates(coordinates: CampusCoordinate[]): CampusBounds {
  if (coordinates.length === 0) {
    throw new Error("Cannot compute UTM campus bounds without routing coordinates.");
  }
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [longitude, latitude] of coordinates) {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  }
  return [
    [west, south],
    [east, north],
  ];
}

export function compileCampusRegion(graph: RoutingGraph): CompiledCampusRegion {
  const existing = compiledRegions.get(graph);
  if (existing) return existing;

  const nodeCoordinates = new Map<string, CampusCoordinate>();
  for (const node of graph.nodes) {
    if (typeof node.longitude !== "number" || typeof node.latitude !== "number") continue;
    nodeCoordinates.set(node.id, [node.longitude, node.latitude]);
  }
  const nodes = [...nodeCoordinates.values()];
  const segments: CampusSegment[] = graph.edges.flatMap((edge) => {
    const start = nodeCoordinates.get(edge.from);
    const end = nodeCoordinates.get(edge.to);
    return start && end ? ([[start, end]] as CampusSegment[]) : [];
  });
  const region = {
    hull: convexHull(nodes),
    nodes,
    segments,
    bounds: boundsForCoordinates(nodes),
  } satisfies CompiledCampusRegion;
  compiledRegions.set(graph, region);
  return region;
}

/**
 * The shared semantic definition used by live location: inside the routing-graph hull and close
 * enough to the actual pedestrian network that a point in the hull's empty exterior corners does
 * not count as on campus.
 */
export function isCoordinateInsideCampus(
  coordinate: CampusCoordinate,
  graph: RoutingGraph,
  maxNetworkDistanceMeters = CAMPUS_LOCATION_MAX_NETWORK_DISTANCE_METERS,
) {
  const { hull, nodes, segments } = compileCampusRegion(graph);
  if (nodes.length < 3 || !pointInPolygon(coordinate, hull)) return false;
  if (
    segments.some(
      ([start, end]) => distanceToSegmentMeters(coordinate, start, end) <= maxNetworkDistanceMeters,
    )
  ) {
    return true;
  }
  return nodes.some((node) => distanceMeters(coordinate, node) <= maxNetworkDistanceMeters);
}

/**
 * MapLibre maxBounds is rectangular, so this returns a padded rectangle around the same routing
 * geometry used by the live-location campus test. The semantic campus test remains polygonal.
 */
export function getCampusCameraBounds(
  graph: RoutingGraph,
  paddingMeters = CAMPUS_CAMERA_PADDING_METERS,
): CampusBounds {
  const { bounds } = compileCampusRegion(graph);
  const [[west, south], [east, north]] = bounds;
  const meanLatitudeRadians = (((south + north) / 2) * Math.PI) / 180;
  const latitudePadding = paddingMeters / 111_320;
  const longitudeMetersPerDegree = Math.max(1, 111_320 * Math.cos(meanLatitudeRadians));
  const longitudePadding = paddingMeters / longitudeMetersPerDegree;
  return [
    [west - longitudePadding, south - latitudePadding],
    [east + longitudePadding, north + latitudePadding],
  ];
}

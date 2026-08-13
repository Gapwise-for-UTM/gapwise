import type { RoutingGraph } from "./types";

export type MapPoint = {
  longitude: number;
  latitude: number;
  accuracyMeters: number;
};

const MAX_ACCURACY_METERS = 75;
const MAX_NETWORK_DISTANCE_METERS = 110;
type Coordinate = [number, number];
type CompiledCampusRegion = { hull: Coordinate[]; nodes: Coordinate[] };
const compiledRegions = new WeakMap<RoutingGraph, CompiledCampusRegion>();

function cross(origin: Coordinate, a: Coordinate, b: Coordinate) {
  return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
}

function convexHull(points: Coordinate[]): Coordinate[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = sorted.filter(
    (point, index) =>
      index === 0 || point[0] !== sorted[index - 1]![0] || point[1] !== sorted[index - 1]![1],
  );
  if (unique.length <= 2) return unique;
  const lower: Coordinate[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Coordinate[] = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function pointInPolygon(point: Coordinate, polygon: Coordinate[]) {
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

function distanceMeters(a: Coordinate, b: Coordinate) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const radius = 6_371_000;
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const latA = radians(a[1]);
  const latB = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function isPointConfidentlyInsideCampus(point: MapPoint, graph: RoutingGraph): boolean {
  if (
    !Number.isFinite(point.longitude) ||
    !Number.isFinite(point.latitude) ||
    point.longitude < -180 ||
    point.longitude > 180 ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    !Number.isFinite(point.accuracyMeters) ||
    point.accuracyMeters < 0 ||
    point.accuracyMeters > MAX_ACCURACY_METERS
  ) {
    return false;
  }
  let region = compiledRegions.get(graph);
  if (!region) {
    const nodes: Coordinate[] = graph.nodes.flatMap((node) =>
      typeof node.longitude === "number" && typeof node.latitude === "number"
        ? [[node.longitude, node.latitude] as Coordinate]
        : [],
    );
    region = { hull: convexHull(nodes), nodes };
    compiledRegions.set(graph, region);
  }
  const { hull, nodes } = region;
  if (nodes.length < 3) return false;
  const coordinate: Coordinate = [point.longitude, point.latitude];
  if (!pointInPolygon(coordinate, hull)) return false;
  return nodes.some((node) => distanceMeters(coordinate, node) <= MAX_NETWORK_DISTANCE_METERS);
}

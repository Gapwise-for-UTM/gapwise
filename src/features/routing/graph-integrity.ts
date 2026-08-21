import type { AccessibilityStatus, RoutingGraph } from "./types";

function haversineMeters(a: [number, number], b: [number, number]): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

const ACCESSIBILITY = new Set<AccessibilityStatus>(["accessible", "not_accessible", "unknown"]);
const NODE_KINDS = new Set([
  "room",
  "hallway",
  "building-entrance",
  "path-intersection",
  "crosswalk",
  "stairs",
  "elevator",
  "door",
]);
const ENVIRONMENTS = new Set(["indoor", "outdoor", "covered"]);

export function routingGraphIssues(graph: RoutingGraph): string[] {
  const issues: string[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  graph.nodes.forEach((node, index) => {
    if (!node.id.trim()) issues.push(`nodes[${index}].id must not be empty.`);
    if (nodeIds.has(node.id)) issues.push(`Duplicate node ID “${node.id}”.`);
    nodeIds.add(node.id);
    if (!NODE_KINDS.has(node.kind))
      issues.push(`Node “${node.id}” has invalid kind “${node.kind}”.`);
    if (!ACCESSIBILITY.has(node.accessibility)) {
      issues.push(`Node “${node.id}” has invalid accessibility “${node.accessibility}”.`);
    }
    if (node.floor !== null && node.buildingCode === null) {
      issues.push(`Node “${node.id}” cannot reference a floor without a building.`);
    }
    if ((node.longitude === undefined) !== (node.latitude === undefined)) {
      issues.push(`Node “${node.id}” must provide longitude and latitude together.`);
    }
    if ((node.indoorX === undefined) !== (node.indoorY === undefined)) {
      issues.push(`Node “${node.id}” must provide indoorX and indoorY together.`);
    }
    for (const [name, coordinate] of [
      ["longitude", node.longitude],
      ["latitude", node.latitude],
      ["indoorX", node.indoorX],
      ["indoorY", node.indoorY],
    ] as const) {
      if (coordinate !== undefined && !Number.isFinite(coordinate)) {
        issues.push(`Node “${node.id}” ${name} must be finite.`);
      }
    }
    if (node.longitude !== undefined && (node.longitude < -180 || node.longitude > 180)) {
      issues.push(`Node “${node.id}” longitude must be between -180 and 180.`);
    }
    if (node.latitude !== undefined && (node.latitude < -90 || node.latitude > 90)) {
      issues.push(`Node “${node.id}” latitude must be between -90 and 90.`);
    }
  });

  graph.edges.forEach((edge, index) => {
    if (!edge.id.trim()) issues.push(`edges[${index}].id must not be empty.`);
    if (edgeIds.has(edge.id)) issues.push(`Duplicate edge ID “${edge.id}”.`);
    if (nodeIds.has(edge.id)) issues.push(`ID “${edge.id}” is used by both a node and an edge.`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from)) {
      issues.push(`Edge “${edge.id}” references missing from endpoint “${edge.from}”.`);
    }
    if (!nodeIds.has(edge.to)) {
      issues.push(`Edge “${edge.id}” references missing to endpoint “${edge.to}”.`);
    }
    if (edge.from === edge.to) issues.push(`Edge “${edge.id}” cannot connect a node to itself.`);
    if (!ENVIRONMENTS.has(edge.environment)) {
      issues.push(`Edge “${edge.id}” has invalid environment “${edge.environment}”.`);
    }
    if (
      !Number.isFinite(edge.distanceMeters) ||
      edge.distanceMeters <= 0 ||
      edge.distanceMeters > 5_000
    ) {
      issues.push(`Edge “${edge.id}” distance must be greater than 0 and at most 5000 metres.`);
    }
    if (!ACCESSIBILITY.has(edge.accessibility)) {
      issues.push(`Edge “${edge.id}” has invalid accessibility “${edge.accessibility}”.`);
    }
    if (edge.stairs && edge.accessibility === "accessible") {
      issues.push(`Edge “${edge.id}” cannot be both stairs and accessible.`);
    }
    if (typeof edge.stairs !== "boolean") issues.push(`Edge “${edge.id}” stairs must be boolean.`);
    if (typeof edge.bidirectional !== "boolean") {
      issues.push(`Edge “${edge.id}” bidirectional must be boolean.`);
    }
    if (
      edge.estimatedDelaySeconds !== undefined &&
      (!Number.isFinite(edge.estimatedDelaySeconds) || edge.estimatedDelaySeconds < 0)
    ) {
      issues.push(`Edge “${edge.id}” estimated delay must be a non-negative finite number.`);
    }
    if (edge.geometry) {
      if (
        edge.geometry.length < 2 ||
        edge.geometry.some(
          ([longitude, latitude]) =>
            !Number.isFinite(longitude) ||
            !Number.isFinite(latitude) ||
            longitude < -180 ||
            longitude > 180 ||
            latitude < -90 ||
            latitude > 90,
        )
      ) {
        issues.push(`Edge “${edge.id}” geometry must contain at least two valid WGS84 positions.`);
      } else {
        const length = edge.geometry
          .slice(1)
          .reduce(
            (sum, point, pointIndex) => sum + haversineMeters(edge.geometry![pointIndex]!, point),
            0,
          );
        const tolerance = Math.max(0.5, length * 0.02);
        if (
          Math.abs(length - edge.distanceMeters) > tolerance &&
          !edge.notes?.includes("measured distance")
        ) {
          issues.push(
            `Edge “${edge.id}” geometry length differs from distanceMeters by more than 2% or 0.5 m.`,
          );
        }
      }
    }
  });

  return issues;
}

export function assertRoutingGraphIntegrity(graph: RoutingGraph): void {
  const issues = routingGraphIssues(graph);
  if (issues.length > 0) {
    throw new Error(`Routing graph validation failed:\n- ${issues.join("\n- ")}`);
  }
}

import { ROUTING_DEFAULTS } from "@/config/routing";
import type {
  RoutePreferences,
  RouteResult,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from "./types";

type Traversal = { edge: RoutingEdge; from: string; to: string };

function numericFloor(floor: string | null): number | null {
  if (!floor) return null;
  const value = Number.parseInt(floor, 10);
  return Number.isFinite(value) ? value : null;
}

function floorDelta(a: RoutingNode, b: RoutingNode): number {
  if (!a.buildingCode || a.buildingCode !== b.buildingCode) return 0;
  const from = numericFloor(a.floor);
  const to = numericFloor(b.floor);
  return from === null || to === null ? 0 : Math.abs(to - from);
}

function traversalCost(
  traversal: Traversal,
  nodes: Map<string, RoutingNode>,
  preferences: RoutePreferences,
): number {
  const { edge } = traversal;
  if (preferences.mode === "step-free" && (edge.stairs || !edge.accessible)) {
    return Number.POSITIVE_INFINITY;
  }

  const from = nodes.get(traversal.from)!;
  const to = nodes.get(traversal.to)!;
  let seconds = edge.distanceMeters / preferences.walkingSpeedMps;

  if (edge.environment === "outdoor" && preferences.mode === "prefer-indoor") {
    seconds *= ROUTING_DEFAULTS.preferIndoorOutdoorMultiplier;
  }
  if (from.buildingCode !== to.buildingCode && (!from.buildingCode || !to.buildingCode)) {
    seconds += ROUTING_DEFAULTS.buildingEntryExitSeconds;
  }
  if (from.kind === "crosswalk" || to.kind === "crosswalk") {
    seconds += ROUTING_DEFAULTS.crosswalkDelaySeconds;
  }

  const floors = floorDelta(from, to);
  if (edge.stairs) seconds += floors * ROUTING_DEFAULTS.stairsPerFloorSeconds;
  if ((from.kind === "elevator" || to.kind === "elevator") && floors > 0) {
    seconds += ROUTING_DEFAULTS.elevatorWaitSeconds;
  }
  return seconds + (edge.estimatedDelaySeconds ?? 0);
}

function buildAdjacency(graph: RoutingGraph): Map<string, Traversal[]> {
  const adjacency = new Map<string, Traversal[]>();
  const push = (traversal: Traversal) => {
    const entries = adjacency.get(traversal.from) ?? [];
    entries.push(traversal);
    adjacency.set(traversal.from, entries);
  };
  for (const edge of graph.edges) {
    push({ edge, from: edge.from, to: edge.to });
    if (edge.bidirectional) push({ edge, from: edge.to, to: edge.from });
  }
  for (const entries of adjacency.values()) {
    entries.sort((a, b) => a.edge.id.localeCompare(b.edge.id) || a.to.localeCompare(b.to));
  }
  return adjacency;
}

/** Deterministic Dijkstra routing. Edge IDs break equal-cost ties for stable tests and UI. */
export function findRoute(
  graph: RoutingGraph,
  startNodeId: string,
  endNodeId: string,
  preferences: RoutePreferences,
): RouteResult | null {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  if (!nodes.has(startNodeId) || !nodes.has(endNodeId)) return null;

  if (startNodeId === endNodeId) {
    return {
      nodes: [nodes.get(startNodeId)!],
      edges: [],
      totalDistanceMeters: 0,
      indoorDistanceMeters: 0,
      outdoorDistanceMeters: 0,
      estimatedSeconds: 0,
      floorChanges: 0,
      warnings: [],
    };
  }

  const adjacency = buildAdjacency(graph);
  const distances = new Map<string, number>([[startNodeId, 0]]);
  const previous = new Map<string, Traversal>();
  const unsettled = new Set<string>([startNodeId]);

  while (unsettled.size > 0) {
    const current = [...unsettled].sort((a, b) => {
      const difference = (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity);
      return difference || a.localeCompare(b);
    })[0]!;
    unsettled.delete(current);
    if (current === endNodeId) break;

    for (const traversal of adjacency.get(current) ?? []) {
      const cost = traversalCost(traversal, nodes, preferences);
      if (!Number.isFinite(cost)) continue;
      const candidate = (distances.get(current) ?? Infinity) + cost;
      const known = distances.get(traversal.to) ?? Infinity;
      const knownEdgeId = previous.get(traversal.to)?.edge.id ?? "\uffff";
      if (candidate < known || (candidate === known && traversal.edge.id < knownEdgeId)) {
        distances.set(traversal.to, candidate);
        previous.set(traversal.to, traversal);
        unsettled.add(traversal.to);
      }
    }
  }

  if (!previous.has(endNodeId)) return null;
  const traversals: Traversal[] = [];
  let cursor = endNodeId;
  while (cursor !== startNodeId) {
    const traversal = previous.get(cursor);
    if (!traversal) return null;
    traversals.unshift(traversal);
    cursor = traversal.from;
  }

  const routeNodes = [nodes.get(startNodeId)!];
  for (const traversal of traversals) routeNodes.push(nodes.get(traversal.to)!);
  const routeEdges = traversals.map((item) => item.edge);
  const indoorDistanceMeters = routeEdges
    .filter((edge) => edge.environment === "indoor" || edge.environment === "covered")
    .reduce((sum, edge) => sum + edge.distanceMeters, 0);
  const outdoorDistanceMeters = routeEdges
    .filter((edge) => edge.environment === "outdoor")
    .reduce((sum, edge) => sum + edge.distanceMeters, 0);
  const floorChanges = routeNodes
    .slice(1)
    .reduce((total, node, index) => total + floorDelta(routeNodes[index]!, node), 0);
  const warnings: string[] = [];
  if (routeEdges.some((edge) => edge.stairs)) warnings.push("Route includes stairs.");
  if (routeEdges.some((edge) => !edge.accessible)) {
    warnings.push("Accessibility has not been verified for every part of this route.");
  }

  return {
    nodes: routeNodes,
    edges: routeEdges,
    totalDistanceMeters: routeEdges.reduce((sum, edge) => sum + edge.distanceMeters, 0),
    indoorDistanceMeters,
    outdoorDistanceMeters,
    estimatedSeconds: distances.get(endNodeId) ?? 0,
    floorChanges,
    warnings,
  };
}

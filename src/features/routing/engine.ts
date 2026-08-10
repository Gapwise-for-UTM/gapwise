import { ROUTING_DEFAULTS } from "@/config/routing";
import type {
  RoutePreferences,
  RouteResult,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from "./types";

type Traversal = { edge: RoutingEdge; from: string; to: string };
type QueueEntry = { id: string; priority: number };

class MinPriorityQueue {
  private readonly entries: QueueEntry[] = [];

  get size() {
    return this.entries.length;
  }

  push(entry: QueueEntry) {
    this.entries.push(entry);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.precedes(this.entries[index]!, this.entries[parent]!)) break;
      [this.entries[index], this.entries[parent]] = [this.entries[parent]!, this.entries[index]!];
      index = parent;
    }
  }

  pop(): QueueEntry | null {
    const first = this.entries[0];
    if (!first) return null;
    const last = this.entries.pop()!;
    if (this.entries.length === 0) return first;
    this.entries[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let next = index;
      if (left < this.entries.length && this.precedes(this.entries[left]!, this.entries[next]!)) {
        next = left;
      }
      if (right < this.entries.length && this.precedes(this.entries[right]!, this.entries[next]!)) {
        next = right;
      }
      if (next === index) break;
      [this.entries[index], this.entries[next]] = [this.entries[next]!, this.entries[index]!];
      index = next;
    }
    return first;
  }

  private precedes(a: QueueEntry, b: QueueEntry) {
    return a.priority < b.priority || (a.priority === b.priority && a.id < b.id);
  }
}

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
  if (preferences.mode === "step-free" && (edge.stairs || edge.accessibility !== "accessible")) {
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

// Compilation is cached by object identity; replace a graph object instead of mutating it in place.
const compiledGraphs = new WeakMap<
  RoutingGraph,
  { nodes: Map<string, RoutingNode>; adjacency: Map<string, Traversal[]> }
>();

function compileGraph(graph: RoutingGraph) {
  const cached = compiledGraphs.get(graph);
  if (cached) return cached;
  const compiled = {
    nodes: new Map(graph.nodes.map((node) => [node.id, node])),
    adjacency: buildAdjacency(graph),
  };
  compiledGraphs.set(graph, compiled);
  return compiled;
}

function straightLineMeters(a: RoutingNode, b: RoutingNode): number {
  if (
    a.longitude === undefined ||
    a.latitude === undefined ||
    b.longitude === undefined ||
    b.latitude === undefined
  ) {
    return 0;
  }
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Deterministic A* routing. Edge IDs break equal-cost ties for stable tests and UI. */
export function findRoute(
  graph: RoutingGraph,
  startNodeId: string,
  endNodeId: string,
  preferences: RoutePreferences,
): RouteResult | null {
  const { nodes, adjacency } = compileGraph(graph);
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

  const distances = new Map<string, number>([[startNodeId, 0]]);
  const previous = new Map<string, Traversal>();
  const frontier = new MinPriorityQueue();
  const destination = nodes.get(endNodeId)!;
  const heuristic = (nodeId: string) =>
    straightLineMeters(nodes.get(nodeId)!, destination) / preferences.walkingSpeedMps;
  frontier.push({ id: startNodeId, priority: heuristic(startNodeId) });

  while (frontier.size > 0) {
    const entry = frontier.pop();
    if (!entry) break;
    const current = entry.id;
    const expectedPriority = (distances.get(current) ?? Infinity) + heuristic(current);
    if (entry.priority > expectedPriority) continue;
    if (current === endNodeId) break;

    for (const traversal of adjacency.get(current) ?? []) {
      const cost = traversalCost(traversal, nodes, preferences);
      if (!Number.isFinite(cost) || cost <= 0) continue;
      const candidate = (distances.get(current) ?? Infinity) + cost;
      const known = distances.get(traversal.to) ?? Infinity;
      const knownEdgeId = previous.get(traversal.to)?.edge.id ?? "\uffff";
      if (candidate < known || (candidate === known && traversal.edge.id < knownEdgeId)) {
        distances.set(traversal.to, candidate);
        previous.set(traversal.to, traversal);
        frontier.push({ id: traversal.to, priority: candidate + heuristic(traversal.to) });
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
  if (routeEdges.some((edge) => edge.accessibility !== "accessible")) {
    warnings.push("Accessibility has not been verified for every part of this route.");
  }
  if (
    routeNodes.some((node) => node.metadata?.verificationStatus === "inferred") ||
    routeEdges.some((edge) => edge.metadata?.verificationStatus === "inferred")
  ) {
    warnings.push("One or more short building approaches still await field verification.");
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

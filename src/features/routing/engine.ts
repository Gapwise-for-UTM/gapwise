import { ROUTING_DEFAULTS } from "../../config/routing.js";
import type {
  RoutePreferences,
  RouteResult,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from "./types.js";

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

function orientedEdgeCoordinates(
  traversal: Traversal,
  nodes: Map<string, RoutingNode>,
): [number, number][] {
  const from = nodes.get(traversal.from)!;
  const to = nodes.get(traversal.to)!;
  const fallback: [number, number][] =
    from.longitude === undefined ||
    from.latitude === undefined ||
    to.longitude === undefined ||
    to.latitude === undefined
      ? []
      : [
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ];
  const shape = traversal.edge.geometry ?? fallback;
  return traversal.from === traversal.edge.from ? shape : [...shape].reverse();
}

function buildResult(
  traversals: Traversal[],
  startNodeId: string,
  nodes: Map<string, RoutingNode>,
  estimatedSeconds: number,
): RouteResult {
  const routeNodes = [nodes.get(startNodeId)!];
  for (const traversal of traversals) routeNodes.push(nodes.get(traversal.to)!);
  const routeEdges = traversals.map((item) => item.edge);
  const coordinates = traversals.flatMap((traversal, index) =>
    orientedEdgeCoordinates(traversal, nodes).slice(index === 0 ? 0 : 1),
  );
  const indoorDistanceMeters = routeEdges
    .filter((edge) => edge.environment !== "outdoor")
    .reduce((sum, edge) => sum + edge.distanceMeters, 0);
  const outdoorDistanceMeters = routeEdges
    .filter((edge) => edge.environment === "outdoor")
    .reduce((sum, edge) => sum + edge.distanceMeters, 0);
  const warnings: string[] = [];
  if (routeEdges.some((edge) => edge.stairs)) warnings.push("Route includes stairs.");
  if (routeEdges.some((edge) => edge.accessibility !== "accessible"))
    warnings.push("Accessibility has not been verified for every part of this route.");
  if (
    routeNodes.some((node) => node.metadata?.verificationStatus === "inferred") ||
    routeEdges.some((edge) => edge.metadata?.verificationStatus === "inferred")
  )
    warnings.push("One or more short route connections still await field verification.");
  return {
    nodes: routeNodes,
    edges: routeEdges,
    coordinates,
    totalDistanceMeters: routeEdges.reduce((sum, edge) => sum + edge.distanceMeters, 0),
    indoorDistanceMeters,
    outdoorDistanceMeters,
    estimatedSeconds,
    floorChanges: routeNodes
      .slice(1)
      .reduce((total, node, index) => total + floorDelta(routeNodes[index]!, node), 0),
    warnings,
  };
}

/** Deterministic A* routing. Edge IDs break equal-cost ties for stable tests and UI. */
export function findRoute(
  graph: RoutingGraph,
  startNodeId: string,
  endNodeId: string,
  preferences: RoutePreferences,
): RouteResult | null {
  return findBestRoute(graph, [startNodeId], [endNodeId], preferences);
}

/** One deterministic A* search over all eligible origins and destinations. */
export function findBestRoute(
  graph: RoutingGraph,
  startNodeIds: readonly string[],
  endNodeIds: readonly string[],
  preferences: RoutePreferences,
): RouteResult | null {
  const { nodes, adjacency } = compileGraph(graph);
  const starts = [...new Set(startNodeIds)].filter((id) => nodes.has(id)).sort();
  const targets = [...new Set(endNodeIds)].filter((id) => nodes.has(id)).sort();
  if (
    starts.length === 0 ||
    targets.length === 0 ||
    !Number.isFinite(preferences.walkingSpeedMps) ||
    preferences.walkingSpeedMps <= 0
  )
    return null;
  const targetSet = new Set(targets);

  const shared = starts.find((id) => targetSet.has(id));
  if (shared) {
    return {
      nodes: [nodes.get(shared)!],
      edges: [],
      coordinates: [],
      totalDistanceMeters: 0,
      indoorDistanceMeters: 0,
      outdoorDistanceMeters: 0,
      estimatedSeconds: 0,
      floorChanges: 0,
      warnings: [],
    };
  }

  const distances = new Map<string, number>(starts.map((id) => [id, 0]));
  const previous = new Map<string, Traversal>();
  const frontier = new MinPriorityQueue();
  // The metric heuristic is used only when every geographic edge affirms that its
  // routing distance is at least endpoint geodesic distance. Otherwise h=0 gives Dijkstra.
  const metricSafe = graph.edges.every((edge) => {
    const a = nodes.get(edge.from);
    const b = nodes.get(edge.to);
    return !a || !b || straightLineMeters(a, b) <= edge.distanceMeters + 1e-6;
  });
  const heuristic = (nodeId: string) =>
    metricSafe
      ? Math.min(
          ...targets.map(
            (target) =>
              straightLineMeters(nodes.get(nodeId)!, nodes.get(target)!) /
              preferences.walkingSpeedMps,
          ),
        )
      : 0;
  for (const start of starts) frontier.push({ id: start, priority: heuristic(start) });
  let reached: string | null = null;

  while (frontier.size > 0) {
    const entry = frontier.pop();
    if (!entry) break;
    const current = entry.id;
    const expectedPriority = (distances.get(current) ?? Infinity) + heuristic(current);
    if (entry.priority > expectedPriority) continue;
    if (targetSet.has(current)) {
      reached = current;
      break;
    }

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

  if (!reached) return null;
  const traversals: Traversal[] = [];
  let cursor = reached;
  while (!starts.includes(cursor)) {
    const traversal = previous.get(cursor);
    if (!traversal) return null;
    traversals.unshift(traversal);
    cursor = traversal.from;
  }
  return buildResult(traversals, cursor, nodes, distances.get(reached) ?? 0);
}

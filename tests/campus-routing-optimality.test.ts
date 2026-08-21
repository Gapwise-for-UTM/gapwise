import { describe, expect, test } from "bun:test";
import { DEFAULT_ROUTE_PREFERENCES, ROUTING_DEFAULTS } from "@/config/routing";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { findBestRoute, findRoute } from "@/features/routing/engine";
import type {
  RoutePreferences,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
} from "@/features/routing/types";

type OracleTraversal = { edge: RoutingEdge; from: string; to: string };
type HeapEntry = { id: string; cost: number };

class OracleMinHeap {
  private readonly items: HeapEntry[] = [];

  get size() {
    return this.items.length;
  }

  push(entry: HeapEntry) {
    this.items.push(entry);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent]!.cost <= this.items[index]!.cost) break;
      [this.items[parent], this.items[index]] = [this.items[index]!, this.items[parent]!];
      index = parent;
    }
  }

  pop(): HeapEntry | null {
    const first = this.items[0];
    if (!first) return null;
    const last = this.items.pop()!;
    if (this.items.length === 0) return first;
    this.items[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let next = index;
      if (left < this.items.length && this.items[left]!.cost < this.items[next]!.cost) next = left;
      if (right < this.items.length && this.items[right]!.cost < this.items[next]!.cost)
        next = right;
      if (next === index) break;
      [this.items[index], this.items[next]] = [this.items[next]!, this.items[index]!];
      index = next;
    }
    return first;
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

function entranceTraversalAllowed(from: RoutingNode, to: RoutingNode): boolean {
  const blocked = (node: RoutingNode) =>
    node.kind === "building-entrance" &&
    (node.access === "restricted" || node.access === "emergency_only");
  if (blocked(from) || blocked(to)) return false;
  if (
    from.kind === "building-entrance" &&
    from.buildingCode !== to.buildingCode &&
    from.direction === "entry"
  )
    return false;
  if (
    to.kind === "building-entrance" &&
    to.buildingCode !== from.buildingCode &&
    to.direction === "exit"
  )
    return false;
  return true;
}

function oracleCost(
  traversal: OracleTraversal,
  nodes: ReadonlyMap<string, RoutingNode>,
  preferences: RoutePreferences,
): number {
  const from = nodes.get(traversal.from)!;
  const to = nodes.get(traversal.to)!;
  const { edge } = traversal;
  if (!entranceTraversalAllowed(from, to)) return Number.POSITIVE_INFINITY;
  if (
    preferences.mode === "step-free" &&
    (edge.stairs ||
      edge.accessibility !== "accessible" ||
      (from.kind === "building-entrance" && from.accessibility !== "accessible") ||
      (to.kind === "building-entrance" && to.accessibility !== "accessible"))
  )
    return Number.POSITIVE_INFINITY;

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

function oracleAdjacency(graph: RoutingGraph): Map<string, OracleTraversal[]> {
  const adjacency = new Map<string, OracleTraversal[]>();
  const add = (traversal: OracleTraversal) => {
    adjacency.set(traversal.from, [...(adjacency.get(traversal.from) ?? []), traversal]);
  };
  for (const edge of graph.edges) {
    add({ edge, from: edge.from, to: edge.to });
    if (edge.bidirectional) add({ edge, from: edge.to, to: edge.from });
  }
  return adjacency;
}

function dijkstraDistances(
  graph: RoutingGraph,
  startId: string,
  preferences: RoutePreferences,
): Map<string, number> {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = oracleAdjacency(graph);
  const distances = new Map<string, number>([[startId, 0]]);
  const queue = new OracleMinHeap();
  queue.push({ id: startId, cost: 0 });

  while (queue.size > 0) {
    const current = queue.pop()!;
    if (current.cost !== distances.get(current.id)) continue;
    for (const traversal of adjacency.get(current.id) ?? []) {
      const cost = oracleCost(traversal, nodes, preferences);
      if (!Number.isFinite(cost) || cost <= 0) continue;
      const candidate = current.cost + cost;
      if (candidate >= (distances.get(traversal.to) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(traversal.to, candidate);
      queue.push({ id: traversal.to, cost: candidate });
    }
  }
  return distances;
}

const endpointNodes = UTM_ROUTING_GRAPH.nodes.filter(
  (node) => node.kind === "building-entrance" && Boolean(node.buildingCode),
);
const preferenceMatrix: RoutePreferences[] = (
  ["fastest", "prefer-indoor", "step-free"] as const
).flatMap((mode) =>
  [0.8, DEFAULT_ROUTE_PREFERENCES.walkingSpeedMps, 2].map((walkingSpeedMps) => ({
    ...DEFAULT_ROUTE_PREFERENCES,
    mode,
    walkingSpeedMps,
  })),
);
const EXHAUSTIVE_ORACLE_TIMEOUT_MS = 15_000;

describe("campus routing optimality oracle", () => {
  test(
    "matches an independent Dijkstra oracle for every exterior endpoint pair and routing mode",
    () => {
      expect(endpointNodes.length).toBeGreaterThan(20);
      for (const preferences of preferenceMatrix) {
        for (const origin of endpointNodes) {
          const oracle = dijkstraDistances(UTM_ROUTING_GRAPH, origin.id, preferences);
          for (const destination of endpointNodes) {
            const expected = oracle.get(destination.id) ?? Number.POSITIVE_INFINITY;
            const actual = findRoute(UTM_ROUTING_GRAPH, origin.id, destination.id, preferences);
            if (!Number.isFinite(expected)) {
              expect(actual).toBeNull();
            } else {
              expect(actual).not.toBeNull();
              expect(Math.abs(actual!.estimatedSeconds - expected)).toBeLessThan(1e-7);
            }
          }
        }
      }
    },
    EXHAUSTIVE_ORACLE_TIMEOUT_MS,
  );

  test("chooses the globally optimal eligible entrance pair for every routable building pair", () => {
    const byBuilding = new Map<string, string[]>();
    for (const node of endpointNodes) {
      const code = node.buildingCode!;
      byBuilding.set(code, [...(byBuilding.get(code) ?? []), node.id]);
    }
    const codes = [...byBuilding.keys()].sort();

    for (const mode of ["fastest", "prefer-indoor", "step-free"] as const) {
      const preferences = { ...DEFAULT_ROUTE_PREFERENCES, mode };
      const oracleByStart = new Map<string, Map<string, number>>();
      for (const ids of byBuilding.values()) {
        for (const start of ids) {
          oracleByStart.set(start, dijkstraDistances(UTM_ROUTING_GRAPH, start, preferences));
        }
      }

      for (const originCode of codes) {
        for (const destinationCode of codes) {
          if (originCode === destinationCode) continue;
          const starts = byBuilding.get(originCode)!;
          const targets = byBuilding.get(destinationCode)!;
          let expected = Number.POSITIVE_INFINITY;
          for (const start of starts) {
            const distances = oracleByStart.get(start)!;
            for (const target of targets) {
              expected = Math.min(expected, distances.get(target) ?? Number.POSITIVE_INFINITY);
            }
          }

          const actual = findBestRoute(UTM_ROUTING_GRAPH, starts, targets, preferences);
          if (!Number.isFinite(expected)) {
            expect(actual).toBeNull();
          } else {
            expect(actual).not.toBeNull();
            expect(Math.abs(actual!.estimatedSeconds - expected)).toBeLessThan(1e-7);
            expect(actual!.nodes[0]!.buildingCode).toBe(originCode);
            expect(actual!.nodes.at(-1)!.buildingCode).toBe(destinationCode);
          }
        }
      }
    }
  });
});

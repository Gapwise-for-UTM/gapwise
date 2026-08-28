import { describe, expect, test } from "bun:test";
import { DEFAULT_ROUTE_PREFERENCES, ROUTING_DEFAULTS } from "@/config/routing";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { findBestRoute } from "@/features/routing/engine";
import { assertRoutingGraphIntegrity } from "@/features/routing/graph-integrity";
import type {
  RoutePreferences,
  RouteResult,
  RoutingEdge,
  RoutingNode,
} from "@/features/routing/types";
import { ROUTING_GOLDEN_CORPUS } from "./fixtures/routing-golden-corpus";

type Role = "origin" | "destination";

function eligibleEntrances(buildingCode: string, role: Role): RoutingNode[] {
  return UTM_ROUTING_GRAPH.nodes.filter(
    (node) =>
      node.kind === "building-entrance" &&
      node.buildingCode === buildingCode &&
      node.access !== "restricted" &&
      node.access !== "emergency_only" &&
      (role !== "origin" || node.direction !== "entry") &&
      (role !== "destination" || node.direction !== "exit"),
  );
}

function route(from: string, to: string, preferences: RoutePreferences) {
  return findBestRoute(
    UTM_ROUTING_GRAPH,
    eligibleEntrances(from, "origin").map(({ id }) => id),
    eligibleEntrances(to, "destination").map(({ id }) => id),
    preferences,
  );
}

function floorDelta(from: RoutingNode, to: RoutingNode): number {
  if (!from.buildingCode || from.buildingCode !== to.buildingCode) return 0;
  const a = Number.parseInt(from.floor ?? "", 10);
  const b = Number.parseInt(to.floor ?? "", 10);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) : 0;
}

function accountedCost(result: RouteResult, preferences: RoutePreferences): number {
  return result.edges.reduce((total, edge, index) => {
    const from = result.nodes[index]!;
    const to = result.nodes[index + 1]!;
    let cost = edge.distanceMeters / preferences.walkingSpeedMps;
    if (edge.environment === "outdoor" && preferences.mode === "prefer-indoor") {
      cost *= ROUTING_DEFAULTS.preferIndoorOutdoorMultiplier;
    }
    if (from.buildingCode !== to.buildingCode && (!from.buildingCode || !to.buildingCode)) {
      cost += ROUTING_DEFAULTS.buildingEntryExitSeconds;
    }
    if (from.kind === "crosswalk" || to.kind === "crosswalk") {
      cost += ROUTING_DEFAULTS.crosswalkDelaySeconds;
    }
    const floors = floorDelta(from, to);
    if (edge.stairs) cost += floors * ROUTING_DEFAULTS.stairsPerFloorSeconds;
    if ((from.kind === "elevator" || to.kind === "elevator") && floors > 0) {
      cost += ROUTING_DEFAULTS.elevatorWaitSeconds;
    }
    return total + cost + (edge.estimatedDelaySeconds ?? 0);
  }, 0);
}

function assertContinuous(result: RouteResult): void {
  expect(result.nodes).toHaveLength(result.edges.length + 1);
  result.edges.forEach((edge, index) => {
    const from = result.nodes[index]!.id;
    const to = result.nodes[index + 1]!.id;
    expect(
      (edge.from === from && edge.to === to) ||
        (edge.bidirectional && edge.from === to && edge.to === from),
    ).toBe(true);
  });
  expect(result.totalDistanceMeters).toBe(
    result.edges.reduce((sum, edge) => sum + edge.distanceMeters, 0),
  );
}

function traversalsAreReversible(result: RouteResult): boolean {
  return result.edges.every((edge) => edge.bidirectional);
}

describe("UTM routing golden corpus", () => {
  test("the bundled graph passes structural and geometry integrity checks", () => {
    expect(() => assertRoutingGraphIntegrity(UTM_ROUTING_GRAPH)).not.toThrow();
  });

  for (const golden of ROUTING_GOLDEN_CORPUS) {
    test(`${golden.id}: preserves its evidence-bounded graph contract`, () => {
      const preferences = { ...DEFAULT_ROUTE_PREFERENCES, mode: golden.mode };
      const origins = eligibleEntrances(golden.from, "origin");
      const destinations = eligibleEntrances(golden.to, "destination");
      expect(origins.length).toBeGreaterThan(0);
      expect(destinations.length).toBeGreaterThan(0);

      const result = route(golden.from, golden.to, preferences);
      if (golden.expected === "unavailable") {
        // Unknown accessibility is deliberately ineligible; absence must not become a guessed path.
        expect(result).toBeNull();
        return;
      }

      expect(result).not.toBeNull();
      const resolved = result!;
      expect(origins.map(({ id }) => id)).toContain(resolved.nodes[0]!.id);
      expect(destinations.map(({ id }) => id)).toContain(resolved.nodes.at(-1)!.id);
      expect(resolved.totalDistanceMeters).toBeGreaterThan(0);
      expect(resolved.totalDistanceMeters).toBeLessThanOrEqual(golden.maxGraphDistanceMeters!);
      expect(Number.isFinite(resolved.estimatedSeconds)).toBe(true);
      expect(resolved.estimatedSeconds).toBeGreaterThan(0);
      expect(
        Math.abs(resolved.estimatedSeconds - accountedCost(resolved, preferences)),
      ).toBeLessThan(1e-7);
      assertContinuous(resolved);
      for (const edgeId of golden.requiredEdgeIds ?? []) {
        expect(resolved.edges.map(({ id }) => id)).toContain(edgeId);
      }

      const comparator = route(golden.from, golden.to, {
        ...preferences,
        mode: "prefer-indoor",
      });
      expect(comparator).not.toBeNull();
      expect(resolved.estimatedSeconds).toBeLessThanOrEqual(
        accountedCost(comparator!, { ...preferences, mode: "fastest" }) + 1e-7,
      );

      if (golden.checkReverse && traversalsAreReversible(resolved)) {
        const reverse = route(golden.to, golden.from, preferences);
        expect(reverse).not.toBeNull();
        assertContinuous(reverse!);
        expect(Math.abs(reverse!.totalDistanceMeters - resolved.totalDistanceMeters)).toBeLessThan(
          1e-7,
        );
      }
    });
  }

  test("missing campus truth remains explicitly unavailable", () => {
    expect(route("NOT-A-BUILDING", "MN", DEFAULT_ROUTE_PREFERENCES)).toBeNull();
    expect(route("MN", "NOT-A-BUILDING", DEFAULT_ROUTE_PREFERENCES)).toBeNull();
  });

  test("step-free results cannot promote unknown evidence", () => {
    const preferences = { ...DEFAULT_ROUTE_PREFERENCES, mode: "step-free" as const };
    for (const origin of UTM_ROUTING_GRAPH.nodes) {
      if (origin.kind !== "building-entrance") continue;
      for (const destination of UTM_ROUTING_GRAPH.nodes) {
        if (destination.kind !== "building-entrance" || destination.id === origin.id) continue;
        const result = findBestRoute(UTM_ROUTING_GRAPH, [origin.id], [destination.id], preferences);
        if (!result) continue;
        expect(result.nodes.filter((node) => node.kind === "building-entrance")).toSatisfy(
          (nodes: RoutingNode[]) => nodes.every((node) => node.accessibility === "accessible"),
        );
        expect(result.edges).toSatisfy((edges: RoutingEdge[]) =>
          edges.every((edge) => edge.accessibility === "accessible" && !edge.stairs),
        );
      }
    }
  });
});

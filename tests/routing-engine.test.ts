import { describe, expect, test } from "bun:test";
import { DEFAULT_ROUTE_PREFERENCES } from "@/config/routing";
import { findRoute } from "@/features/routing/engine";
import type { RoutingGraph } from "@/features/routing/types";
import { edge, node } from "./fixtures";

describe("deterministic graph routing", () => {
  test("finds the shortest path", () => {
    const graph: RoutingGraph = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [edge("direct", "a", "c", 80), edge("ab", "a", "b", 20), edge("bc", "b", "c", 20)],
    };
    expect(
      findRoute(graph, "a", "c", DEFAULT_ROUTE_PREFERENCES)?.edges.map((item) => item.id),
    ).toEqual(["ab", "bc"]);
  });

  test("prefer-indoor weighting can select a longer indoor path", () => {
    const graph: RoutingGraph = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [
        edge("outdoor", "a", "c", 100),
        edge("inside-a", "a", "b", 70, { environment: "indoor" }),
        edge("inside-b", "b", "c", 70, { environment: "indoor" }),
      ],
    };
    expect(findRoute(graph, "a", "c", DEFAULT_ROUTE_PREFERENCES)?.edges[0]?.id).toBe("outdoor");
    expect(
      findRoute(graph, "a", "c", {
        ...DEFAULT_ROUTE_PREFERENCES,
        mode: "prefer-indoor",
      })?.edges.map((item) => item.id),
    ).toEqual(["inside-a", "inside-b"]);
  });

  test("step-free routing excludes stairs and prefers an accessible elevator", () => {
    const graph: RoutingGraph = {
      nodes: [
        node("room-1", { kind: "room", buildingCode: "MN", floor: "1" }),
        node("stairs-2", { kind: "stairs", buildingCode: "MN", floor: "2" }),
        node("elevator-2", { kind: "elevator", buildingCode: "MN", floor: "2" }),
        node("room-2", { kind: "room", buildingCode: "MN", floor: "2" }),
      ],
      edges: [
        edge("stairs", "room-1", "stairs-2", 8, {
          environment: "indoor",
          stairs: true,
          accessibility: "not_accessible",
        }),
        edge("stairs-room", "stairs-2", "room-2", 4, {
          environment: "indoor",
          stairs: true,
          accessibility: "not_accessible",
        }),
        edge("elevator", "room-1", "elevator-2", 18, { environment: "indoor" }),
        edge("elevator-room", "elevator-2", "room-2", 8, { environment: "indoor" }),
      ],
    };
    const result = findRoute(graph, "room-1", "room-2", {
      ...DEFAULT_ROUTE_PREFERENCES,
      mode: "step-free",
    });
    expect(result?.edges.some((item) => item.stairs)).toBe(false);
    expect(result?.edges[0]?.id).toBe("elevator");
  });

  test("reports no route when step-free data has only stairs", () => {
    const graph: RoutingGraph = {
      nodes: [node("a"), node("b")],
      edges: [
        edge("stairs", "a", "b", 10, {
          stairs: true,
          accessibility: "not_accessible",
        }),
      ],
    };
    expect(
      findRoute(graph, "a", "b", { ...DEFAULT_ROUTE_PREFERENCES, mode: "step-free" }),
    ).toBeNull();
  });

  test("rejects non-positive traversal costs", () => {
    const graph: RoutingGraph = {
      nodes: [node("a"), node("b")],
      edges: [edge("invalid-zero-cost", "a", "b", 0)],
    };
    expect(findRoute(graph, "a", "b", DEFAULT_ROUTE_PREFERENCES)).toBeNull();
  });

  test("calculates route time, delays, distance, and floor changes", () => {
    const graph: RoutingGraph = {
      nodes: [
        node("a", { kind: "room", buildingCode: "IB", floor: "1" }),
        node("b", { kind: "stairs", buildingCode: "IB", floor: "2" }),
      ],
      edges: [
        edge("stairs", "a", "b", 13.5, {
          environment: "indoor",
          stairs: true,
          accessibility: "not_accessible",
          estimatedDelaySeconds: 5,
        }),
      ],
    };
    const result = findRoute(graph, "a", "b", DEFAULT_ROUTE_PREFERENCES)!;
    expect(result.totalDistanceMeters).toBe(13.5);
    expect(result.indoorDistanceMeters).toBe(13.5);
    expect(result.floorChanges).toBe(1);
    expect(result.estimatedSeconds).toBe(35); // 10 seconds walking + 20 stairs + 5 explicit delay
  });
});

import { describe, expect, test } from "bun:test";
import { DEFAULT_ROUTE_PREFERENCES } from "@/config/routing";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { planMeetingTransition } from "@/features/routing/transition";
import type { RoutingGraph } from "@/features/routing/types";
import { edge, meeting, node } from "./fixtures";

describe("meeting transition routing", () => {
  test("handles a same-room transition", () => {
    const result = planMeetingTransition(
      meeting(),
      meeting({ id: "next" }),
      UTM_ROUTING_GRAPH,
      DEFAULT_ROUTE_PREFERENCES,
    );
    expect(result.status).toBe("same-room");
    expect(result.message).toBe("You are already at your next class.");
  });

  test("routes between rooms in the same mapped building", () => {
    const graph: RoutingGraph = {
      nodes: [
        node("mn-1270", { kind: "room", buildingCode: "MN", floor: "1", room: "1270" }),
        node("mn-hall", { kind: "hallway", buildingCode: "MN", floor: "1" }),
        node("mn-1290", { kind: "room", buildingCode: "MN", floor: "1", room: "1290" }),
      ],
      edges: [
        edge("leave", "mn-1270", "mn-hall", 10, { environment: "indoor" }),
        edge("arrive", "mn-hall", "mn-1290", 12, { environment: "indoor" }),
      ],
    };
    const result = planMeetingTransition(
      meeting(),
      meeting({ id: "next", room: "1290" }),
      graph,
      DEFAULT_ROUTE_PREFERENCES,
    );
    expect(result.status).toBe("routed");
    expect(result.result?.indoorDistanceMeters).toBe(22);
  });

  test("routes continuously across indoor and outdoor graph edges", () => {
    const graph: RoutingGraph = {
      nodes: [
        node("mn-room", {
          kind: "room",
          buildingCode: "MN",
          floor: "1",
          room: "1270",
          longitude: -79.666,
          latitude: 43.551,
        }),
        node("mn-exit", {
          kind: "building-entrance",
          buildingCode: "MN",
          floor: "1",
          longitude: -79.6658,
          latitude: 43.551,
        }),
        node("path", { longitude: -79.665, latitude: 43.551 }),
        node("ib-entry", {
          kind: "building-entrance",
          buildingCode: "IB",
          floor: "1",
          longitude: -79.664,
          latitude: 43.551,
        }),
        node("ib-room", {
          kind: "room",
          buildingCode: "IB",
          floor: "3",
          room: "340",
          longitude: -79.6638,
          latitude: 43.551,
        }),
      ],
      edges: [
        edge("mn-indoor", "mn-room", "mn-exit", 15, { environment: "indoor" }),
        edge("out-a", "mn-exit", "path", 80),
        edge("out-b", "path", "ib-entry", 70),
        edge("ib-indoor", "ib-entry", "ib-room", 25, { environment: "indoor" }),
      ],
    };
    const result = planMeetingTransition(
      meeting(),
      meeting({ id: "next", buildingCode: "IB", room: "340" }),
      graph,
      DEFAULT_ROUTE_PREFERENCES,
    );
    expect(result.status).toBe("routed");
    expect(result.result?.indoorDistanceMeters).toBe(40);
    expect(result.result?.outdoorDistanceMeters).toBe(150);
    expect(result.result?.nodes.map((item) => item.id)).toEqual([
      "mn-room",
      "mn-exit",
      "path",
      "ib-entry",
      "ib-room",
    ]);
  });

  test("does not invent same-building indoor routing", () => {
    const result = planMeetingTransition(
      meeting(),
      meeting({ id: "next", room: "1290" }),
      UTM_ROUTING_GRAPH,
      DEFAULT_ROUTE_PREFERENCES,
    );
    expect(result.status).toBe("unavailable");
    expect(result.message).toContain("Indoor room routing not yet mapped");
  });

  test("routes production buildings along bundled campus paths", () => {
    const result = planMeetingTransition(
      meeting(),
      meeting({ id: "next", buildingCode: "IB", room: "340" }),
      UTM_ROUTING_GRAPH,
      DEFAULT_ROUTE_PREFERENCES,
    );
    expect(result.status).toBe("routed");
    expect(result.message).toBe("Route calculated along bundled campus paths.");
    expect(result.accuracy).toBe("Mapped campus path, indoor estimate");
    expect(result.displayCoordinates.length).toBeGreaterThan(2);
  });

  test("never silently falls back in step-free mode", () => {
    const result = planMeetingTransition(
      meeting(),
      meeting({ id: "next", buildingCode: "IB", room: "340" }),
      UTM_ROUTING_GRAPH,
      { ...DEFAULT_ROUTE_PREFERENCES, mode: "step-free" },
    );
    expect(result.status).toBe("unavailable");
    expect(result.message).toContain("No verified accessible route");
  });

  test("uses an explicit approximation when a known pair is disconnected", () => {
    const disconnectedGraph: RoutingGraph = {
      nodes: [
        node("mn-entry", {
          kind: "building-entrance",
          buildingCode: "MN",
          longitude: -79.666,
          latitude: 43.551,
        }),
        node("ib-entry", {
          kind: "building-entrance",
          buildingCode: "IB",
          longitude: -79.664,
          latitude: 43.551,
        }),
      ],
      edges: [],
    };
    const result = planMeetingTransition(
      meeting(),
      meeting({ id: "next", buildingCode: "IB", room: "340" }),
      disconnectedGraph,
      DEFAULT_ROUTE_PREFERENCES,
    );

    expect(result.status).toBe("approximate");
    expect(result.message).toContain("verified walking path unavailable");
    expect(result.displayCoordinates).toEqual([]);
  });

  test("does not fabricate walking time for a TBA location", () => {
    const result = planMeetingTransition(
      meeting({
        buildingCode: null,
        room: null,
        locationUnknown: true,
        locationType: "tba",
      }),
      meeting({ id: "next" }),
      UTM_ROUTING_GRAPH,
      DEFAULT_ROUTE_PREFERENCES,
    );

    expect(result.status).toBe("unavailable");
    expect(result.approximateSeconds).toBeNull();
    expect(result.result).toBeNull();
  });
});

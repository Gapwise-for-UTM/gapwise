import { describe, expect, test } from "bun:test";
import { CAMPUS_BUILDINGS, UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  compileCampusRegion,
  getCampusCameraBounds,
  isCoordinateInsideCampus,
} from "@/features/routing/campus-region";

describe("shared campus region", () => {
  test("compiles finite routing bounds and hull geometry", () => {
    const region = compileCampusRegion(UTM_ROUTING_GRAPH);
    expect(region.nodes.length).toBeGreaterThan(100);
    expect(region.segments.length).toBeGreaterThan(100);
    expect(region.hull.length).toBeGreaterThanOrEqual(3);
    const [[west, south], [east, north]] = region.bounds;
    for (const value of [west, south, east, north]) expect(Number.isFinite(value)).toBe(true);
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    expect(east - west).toBeLessThan(0.05);
    expect(north - south).toBeLessThan(0.05);
  });

  test("camera bounds contain every routable node and mapped building entrance", () => {
    const [[west, south], [east, north]] = getCampusCameraBounds(UTM_ROUTING_GRAPH);
    const coordinates = [
      ...UTM_ROUTING_GRAPH.nodes.flatMap((node) =>
        typeof node.longitude === "number" && typeof node.latitude === "number"
          ? ([[node.longitude, node.latitude]] as [number, number][])
          : [],
      ),
      ...CAMPUS_BUILDINGS.flatMap((building) =>
        building.entrances.map((entrance) => entrance.coordinates),
      ),
    ];
    for (const [longitude, latitude] of coordinates) {
      expect(longitude).toBeGreaterThanOrEqual(west);
      expect(longitude).toBeLessThanOrEqual(east);
      expect(latitude).toBeGreaterThanOrEqual(south);
      expect(latitude).toBeLessThanOrEqual(north);
    }
  });

  test("semantic campus region accepts central UTM and rejects a nearby exterior point", () => {
    expect(isCoordinateInsideCampus([-79.66475, 43.55105], UTM_ROUTING_GRAPH)).toBe(true);
    expect(isCoordinateInsideCampus([-79.6725, 43.552], UTM_ROUTING_GRAPH)).toBe(false);
  });

  test("accepts points along a long routing edge, not only near its endpoint nodes", () => {
    const edge = UTM_ROUTING_GRAPH.edges.find((candidate) => candidate.id === "osm-way-38790768-0");
    expect(edge).toBeDefined();
    const start = UTM_ROUTING_GRAPH.nodes.find((node) => node.id === edge?.from);
    const end = UTM_ROUTING_GRAPH.nodes.find((node) => node.id === edge?.to);
    expect(start?.longitude).toBeNumber();
    expect(start?.latitude).toBeNumber();
    expect(end?.longitude).toBeNumber();
    expect(end?.latitude).toBeNumber();
    const midpoint: [number, number] = [
      (start!.longitude! + end!.longitude!) / 2,
      (start!.latitude! + end!.latitude!) / 2,
    ];
    expect(isCoordinateInsideCampus(midpoint, UTM_ROUTING_GRAPH)).toBe(true);
  });

  test("camera padding expands beyond the semantic routing bounds without becoming world scale", () => {
    const region = compileCampusRegion(UTM_ROUTING_GRAPH);
    const [[west, south], [east, north]] = getCampusCameraBounds(UTM_ROUTING_GRAPH);
    expect(west).toBeLessThan(region.bounds[0][0]);
    expect(south).toBeLessThan(region.bounds[0][1]);
    expect(east).toBeGreaterThan(region.bounds[1][0]);
    expect(north).toBeGreaterThan(region.bounds[1][1]);
    expect(east - west).toBeLessThan(0.05);
    expect(north - south).toBeLessThan(0.05);
  });
});

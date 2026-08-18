import { describe, expect, test } from "bun:test";
import {
  collisionFreeMarkerOffsets,
  groupedVerticalMarkerOffsets,
} from "@/features/routing/map-marker-layout";

describe("campus map marker layout", () => {
  test("separates generic stops with identical geographic screen anchors", () => {
    const points = Array.from({ length: 12 }, () => ({ x: 500, y: 300 }));
    const offsets = collisionFreeMarkerOffsets(points);
    const centres = offsets.map(([x, y]) => ({ x: 500 + x, y: 300 + y }));
    for (let a = 0; a < centres.length; a += 1) {
      for (let b = a + 1; b < centres.length; b += 1) {
        expect(
          Math.hypot(centres[a]!.x - centres[b]!.x, centres[a]!.y - centres[b]!.y),
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test("also separates generic anchors that project close together", () => {
    const points = [
      { x: 100, y: 100 },
      { x: 112, y: 106 },
      { x: 124, y: 112 },
      { x: 136, y: 118 },
    ];
    const offsets = collisionFreeMarkerOffsets(points);
    const centres = points.map((point, index) => ({
      x: point.x + offsets[index]![0],
      y: point.y + offsets[index]![1],
    }));
    for (let a = 0; a < centres.length; a += 1) {
      for (let b = a + 1; b < centres.length; b += 1) {
        expect(
          Math.hypot(centres[a]!.x - centres[b]!.x, centres[a]!.y - centres[b]!.y),
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test("stacks same-building classes vertically from earliest to latest at one entrance", () => {
    const points = [
      { x: 500, y: 300, groupKey: "MN", order: 14 * 60 },
      { x: 500, y: 300, groupKey: "MN", order: 9 * 60 },
      { x: 500, y: 300, groupKey: "MN", order: 11 * 60 },
    ];
    const offsets = groupedVerticalMarkerOffsets(points);
    const centres = points.map((point, index) => ({
      x: point.x + offsets[index]![0],
      y: point.y + offsets[index]![1],
      order: point.order,
    }));
    const chronological = [...centres].sort((a, b) => a.order - b.order);

    expect(new Set(centres.map((centre) => centre.x)).size).toBe(1);
    expect(chronological[0]!.y).toBeLessThan(chronological[1]!.y);
    expect(chronological[1]!.y).toBeLessThan(chronological[2]!.y);
  });

  test("keeps distinct entrances in the same building on their routed anchors", () => {
    const points = [
      { x: 100, y: 100, groupKey: "MN", order: 9 * 60 },
      { x: 132, y: 108, groupKey: "MN", order: 11 * 60 },
    ];

    expect(groupedVerticalMarkerOffsets(points)).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  test("still stacks near-identical projected entrances in the same building", () => {
    const points = [
      { x: 100, y: 100, groupKey: "MN", order: 9 * 60 },
      { x: 104, y: 103, groupKey: "MN", order: 11 * 60 },
    ];

    expect(groupedVerticalMarkerOffsets(points)).toEqual([
      [0, -22],
      [0, 22],
    ]);
  });

  test("does not relocate different buildings to avoid cross-building collisions", () => {
    const points = [
      { x: 100, y: 100, groupKey: "MN", order: 9 * 60 },
      { x: 100, y: 100, groupKey: "MN", order: 11 * 60 },
      { x: 118, y: 106, groupKey: "DV", order: 10 * 60 },
      { x: 118, y: 106, groupKey: "DV", order: 13 * 60 },
    ];
    const offsets = groupedVerticalMarkerOffsets(points);

    expect(offsets[0]![0]).toBe(0);
    expect(offsets[1]![0]).toBe(0);
    expect(offsets[2]![0]).toBe(0);
    expect(offsets[3]![0]).toBe(0);
    expect(offsets[0]![1]).toBe(-22);
    expect(offsets[1]![1]).toBe(22);
    expect(offsets[2]![1]).toBe(-22);
    expect(offsets[3]![1]).toBe(22);
  });

  test("keeps same-entrance offsets stable when projected coordinates change with zoom", () => {
    const near = [
      { x: 500, y: 300, groupKey: "IB", order: 9 * 60 },
      { x: 500, y: 300, groupKey: "IB", order: 11 * 60 },
      { x: 700, y: 430, groupKey: "MN", order: 14 * 60 },
    ];
    const far = [
      { x: 250, y: 150, groupKey: "IB", order: 9 * 60 },
      { x: 250, y: 150, groupKey: "IB", order: 11 * 60 },
      { x: 320, y: 195, groupKey: "MN", order: 14 * 60 },
    ];

    expect(groupedVerticalMarkerOffsets(near)).toEqual(groupedVerticalMarkerOffsets(far));
  });
});

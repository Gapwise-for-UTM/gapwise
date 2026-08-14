import { describe, expect, test } from "bun:test";
import { collisionFreeMarkerOffsets } from "@/features/routing/map-marker-layout";

describe("campus map marker layout", () => {
  test("separates stops with identical geographic screen anchors", () => {
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

  test("also separates different anchors that project close together", () => {
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
});

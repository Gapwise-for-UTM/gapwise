import { describe, expect, test } from "bun:test";
import {
  collisionFreeMarkerOffsets,
  groupedVerticalMarkerOffsets,
} from "@/features/routing/map-marker-layout";

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

  test("stacks same-building classes vertically from earliest to latest", () => {
    const points = [
      { x: 500, y: 300, groupKey: "MN", order: 14 * 60 },
      { x: 504, y: 297, groupKey: "MN", order: 9 * 60 },
      { x: 498, y: 302, groupKey: "MN", order: 11 * 60 },
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

  test("moves building stacks as groups instead of breaking their vertical alignment", () => {
    const points = [
      { x: 100, y: 100, groupKey: "MN", order: 9 * 60 },
      { x: 100, y: 100, groupKey: "MN", order: 11 * 60 },
      { x: 118, y: 106, groupKey: "DV", order: 10 * 60 },
      { x: 118, y: 106, groupKey: "DV", order: 13 * 60 },
    ];
    const offsets = groupedVerticalMarkerOffsets(points);
    const centres = points.map((point, index) => ({
      x: point.x + offsets[index]![0],
      y: point.y + offsets[index]![1],
      groupKey: point.groupKey,
    }));

    const mn = centres.filter((centre) => centre.groupKey === "MN");
    const dv = centres.filter((centre) => centre.groupKey === "DV");
    expect(new Set(mn.map((centre) => centre.x)).size).toBe(1);
    expect(new Set(dv.map((centre) => centre.x)).size).toBe(1);

    const mnCenter = {
      x: mn[0]!.x,
      y: mn.reduce((sum, centre) => sum + centre.y, 0) / mn.length,
    };
    const dvCenter = {
      x: dv[0]!.x,
      y: dv.reduce((sum, centre) => sum + centre.y, 0) / dv.length,
    };
    expect(Math.hypot(mnCenter.x - dvCenter.x, mnCenter.y - dvCenter.y)).toBeGreaterThanOrEqual(
      92,
    );
  });
});

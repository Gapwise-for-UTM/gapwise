import { describe, expect, test } from "bun:test";
import { calculateGapTiming, calculateLeaveBy } from "@/lib/gaps";
import type { RouteResult } from "@/features/routing/types";

const route: RouteResult = {
  nodes: [],
  edges: [],
  totalDistanceMeters: 200,
  indoorDistanceMeters: 50,
  outdoorDistanceMeters: 150,
  estimatedSeconds: 600,
  floorChanges: 0,
  warnings: [],
};

describe("gap route timing", () => {
  test("calculates leave-by time", () => {
    expect(calculateLeaveBy(720, 600, 5)).toBe(705);
  });

  test("subtracts route time and buffer without returning negative usable time", () => {
    expect(calculateGapTiming({ durationMinutes: 12, endTime: 720 }, route, 5)).toMatchObject({
      usableMinutes: 0,
      leaveByMinutes: 705,
      arrivalMinutes: 715,
      fallback: false,
    });
  });

  test("retains the original 15-minute fallback when route data is missing", () => {
    expect(calculateGapTiming({ durationMinutes: 60, endTime: 720 }, null, 5)).toMatchObject({
      usableMinutes: 45,
      bufferMinutes: 15,
      fallback: true,
    });
  });
});

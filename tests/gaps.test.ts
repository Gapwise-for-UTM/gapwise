import { describe, expect, test } from "bun:test";
import { calculateGapTiming, calculateLeaveBy, findGaps } from "@/lib/gaps";
import type { RouteResult } from "@/features/routing/types";
import { meeting } from "./fixtures";

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

  test("uses the latest occupied end after nested and overlapping meetings", () => {
    const outer = meeting({ id: "outer", startTime: 9 * 60, endTime: 12 * 60 });
    const nested = meeting({ id: "nested", startTime: 10 * 60, endTime: 11 * 60 });
    const next = meeting({ id: "next", startTime: 13 * 60, endTime: 14 * 60 });

    expect(findGaps([outer, nested, next], "Fall")).toEqual([
      expect.objectContaining({
        startTime: 12 * 60,
        endTime: 13 * 60,
        durationMinutes: 60,
        previous: outer,
        next,
      }),
    ]);
  });

  test("keeps the meeting that extends an overlapping occupied interval as context", () => {
    const first = meeting({ id: "first", startTime: 9 * 60, endTime: 11 * 60 });
    const extending = meeting({ id: "extending", startTime: 10 * 60, endTime: 12 * 60 });
    const next = meeting({ id: "next", startTime: 13 * 60, endTime: 14 * 60 });

    expect(findGaps([first, extending, next], "Fall")[0]).toMatchObject({
      startTime: 12 * 60,
      durationMinutes: 60,
      previous: extending,
      next,
    });
  });
});

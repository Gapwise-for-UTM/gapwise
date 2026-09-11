import { describe, expect, test } from "bun:test";
import {
  classTiming,
  liveLocationMateriallyChanged,
  planLiveClassRoute,
  selectLiveClassOrigin,
  type LiveClassOrigin,
} from "@/features/routing/live-class-route";
import type { Meeting } from "@/lib/timetable-types";

const meeting: Meeting = {
  id: "mat157",
  courseCode: "MAT157H5",
  courseName: "Analysis I",
  activityType: "LEC",
  sectionCode: "LEC0101",
  startTime: 13 * 60,
  endTime: 15 * 60,
  weekday: "Friday",
  buildingCode: "IB",
  room: "240",
  term: "Fall",
  locationUnknown: false,
};

const preferences = {
  mode: "fastest" as const,
  walkingSpeedMps: 1.4,
  transitionBufferMinutes: 5,
};

describe("live class routing", () => {
  test("rejects stale fixes and preserves explicit fallback reasons", () => {
    expect(selectLiveClassOrigin({ status: "permission-denied", point: null }, 100_000)).toEqual({
      kind: "fallback",
      reason: "permission-denied",
    });
    expect(
      selectLiveClassOrigin(
        {
          status: "on-campus",
          point: { longitude: -79.66475, latitude: 43.55105, accuracyMeters: 10 },
          observedAtMs: 60_000,
        },
        100_000,
      ),
    ).toEqual({ kind: "fallback", reason: "stale" });
  });

  test("ignores GPS jitter but reacts to meaningful movement", () => {
    const origin = (longitude: number): LiveClassOrigin => ({
      kind: "live",
      point: { longitude, latitude: 43.55105, accuracyMeters: 10 },
    });
    expect(liveLocationMateriallyChanged(origin(-79.66475), origin(-79.66474))).toBe(false);
    expect(liveLocationMateriallyChanged(origin(-79.66475), origin(-79.6645))).toBe(true);
  });

  test("calculates leave-by, arrival, leave-now, and late states", () => {
    const early = new Date(2026, 8, 11, 12, 30);
    const result = classTiming(13 * 60, "Friday", 10 * 60, 5, early);
    expect(result.leaveBy.getHours()).toBe(12);
    expect(result.leaveBy.getMinutes()).toBe(45);
    expect(result.arrival.getHours()).toBe(12);
    expect(result.arrival.getMinutes()).toBe(40);
    expect(result.state).toBe("on-time");
    expect(classTiming(13 * 60, "Friday", 10 * 60, 5, new Date(2026, 8, 11, 12, 50)).state).toBe(
      "leave-now",
    );
    expect(classTiming(13 * 60, "Friday", 10 * 60, 5, new Date(2026, 8, 11, 13, 1)).state).toBe(
      "late",
    );
  });

  test("routes an on-campus fix to an eligible IB entrance and retains room guidance", () => {
    const route = planLiveClassRoute(
      meeting,
      {
        kind: "live",
        point: { longitude: -79.66475, latitude: 43.55105, accuracyMeters: 10 },
      },
      preferences,
    );
    expect(route.status).toBe("routed");
    expect(route.result?.nodes.at(-1)?.buildingCode).toBe("IB");
    expect(route.warnings.join(" ")).toContain("room 240");
  });
});

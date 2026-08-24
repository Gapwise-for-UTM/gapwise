import { describe, expect, it } from "bun:test";
import { assessPlaceFeasibility } from "../src/features/campus-state/feasibility";
import { evaluateOpenNow } from "../src/features/campus-state/hours";
import { CAMPUS_STATE_SNAPSHOT, getCampusPlace } from "../src/features/campus-state/snapshot";
import type { Provenance, WeeklyHours } from "../src/features/campus-state/types";

const provenance: Provenance = {
  sourceId: "test",
  status: "verified",
  observedAt: "2026-08-24T00:00:00Z",
};
const weekdayHours: WeeklyHours = {
  timezone: "America/Toronto",
  intervals: { 1: [{ opens: "09:00", closes: "17:00" }] },
};

describe("campus state", () => {
  it("uses stable canonical IDs and existing building identities", () => {
    expect(getCampusPlace("utm-library")?.buildingCode).toBe("HM");
    expect(CAMPUS_STATE_SNAPSHOT.places.every((place) => /^[a-z0-9-]+$/.test(place.id))).toBe(true);
  });
  it("is open at the inclusive opening boundary and closed at closing", () => {
    expect(evaluateOpenNow(weekdayHours, provenance, new Date("2026-08-24T13:00:00Z")).state).toBe(
      "open",
    );
    expect(evaluateOpenNow(weekdayHours, provenance, new Date("2026-08-24T21:00:00Z")).state).toBe(
      "closed",
    );
  });
  it("evaluates Toronto local hours across standard time", () => {
    expect(evaluateOpenNow(weekdayHours, provenance, new Date("2026-11-02T14:00:00Z")).state).toBe(
      "open",
    );
  });
  it("does not convert missing or unavailable hours to closed", () => {
    expect(evaluateOpenNow(undefined, { ...provenance, status: "unavailable" }).state).toBe(
      "unknown",
    );
  });
  it("accounts for travel both ways and a protected buffer", () => {
    expect(
      assessPlaceFeasibility({
        gapMinutes: 60,
        travelToMinutes: 8,
        travelFromMinutes: 10,
        protectedActivityMinutes: 30,
        transitionBufferMinutes: 5,
      }),
    ).toEqual({ status: "fits", usableMinutes: 37, requiredMinutes: 53 });
    expect(
      assessPlaceFeasibility({
        gapMinutes: 45,
        travelToMinutes: 8,
        travelFromMinutes: 10,
        protectedActivityMinutes: 30,
        transitionBufferMinutes: 5,
      }).status,
    ).toBe("too-tight");
  });
  it("fails closed when either route is unknown", () => {
    expect(
      assessPlaceFeasibility({
        gapMinutes: 90,
        travelToMinutes: null,
        travelFromMinutes: 5,
        protectedActivityMinutes: 30,
        transitionBufferMinutes: 5,
      }).status,
    ).toBe("unknown");
  });
});

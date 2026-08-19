import { describe, expect, it } from "bun:test";
import {
  getPublicBuilding,
  listPublicBuildings,
  planPublicGap,
  routeBetweenPublicBuildings,
} from "../src/server/public-campus/service";

describe("public campus intelligence", () => {
  it("lists canonical UTM buildings without exposing routing graph internals", () => {
    const buildings = listPublicBuildings();
    const mn = buildings.find((building) => building.code === "MN");
    const dh = buildings.find((building) => building.code === "DH");

    expect(mn?.name).toBe("Maanjiwe nendamowinan");
    expect(dh?.name).toBe("Deerfield Hall");
    expect(mn?.entranceCount).toBeGreaterThan(0);
    expect("entrances" in (mn ?? {})).toBe(false);
  });

  it("resolves exact names and aliases to a canonical building", () => {
    expect(getPublicBuilding("MN")).toMatchObject({
      status: "found",
      building: { code: "MN" },
    });
    expect(getPublicBuilding("Deerfield Hall")).toMatchObject({
      status: "found",
      building: { code: "DH" },
    });
    expect(getPublicBuilding("definitely not a UTM building")).toEqual({ status: "not_found" });
  });

  it("returns a deterministic building route without raw graph nodes or edges", () => {
    const result = routeBetweenPublicBuildings({
      from: "MN",
      to: "DH",
      preferences: { mode: "fastest", walkingSpeedMps: 1.35, transitionBufferMinutes: 5 },
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(["routed", "approximate"]).toContain(result.status);
    expect(result.totalDistanceMeters).toBeGreaterThan(0);
    expect(result.estimatedSeconds).toBeGreaterThan(0);
    expect(result.from.code).toBe("MN");
    expect(result.to.code).toBe("DH");
    expect("nodes" in result).toBe(false);
    expect("edges" in result).toBe(false);
  });

  it("fails closed for an unknown building and never guesses", () => {
    expect(routeBetweenPublicBuildings({ from: "MN", to: "Imaginary Hall" })).toMatchObject({
      error: "unknown_building",
    });
  });

  it("does not claim room-to-room routing for the same building", () => {
    const result = routeBetweenPublicBuildings({ from: "MN", to: "MN" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.status).toBe("same-building");
    expect(result.warnings.join(" ")).toContain("room-to-room");
  });

  it("uses the shared Gapwise assessment engine for a public gap window", () => {
    const result = planPublicGap({
      from: "MN",
      to: "IB",
      term: "Fall",
      weekday: "Wednesday",
      startTime: 11 * 60,
      endTime: 13 * 60,
      routePreferences: {
        mode: "fastest",
        walkingSpeedMps: 1.35,
        transitionBufferMinutes: 5,
      },
      gapPreferences: {
        setupMinutes: 4,
        packUpMinutes: 3,
        lunchWindowStart: 11 * 60 + 30,
        lunchWindowEnd: 14 * 60 + 30,
        mealDurationMinutes: 30,
        riskTolerance: "low",
      },
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.gap.durationMinutes).toBe(120);
    expect(result.route.from.code).toBe("MN");
    expect(result.route.to.code).toBe("IB");
    expect(result.assessment.primary.title.length).toBeGreaterThan(0);
    expect(result.assessment.primary.activityMinutes).toBeGreaterThanOrEqual(0);
    expect(result.assessment.leaveByMinutes).toBeLessThanOrEqual(13 * 60);
    expect(JSON.stringify(result)).not.toContain('"nodes"');
    expect(JSON.stringify(result)).not.toContain('"edges"');
  });

  it("keeps step-free gap simulation unavailable when accessibility cannot be verified", () => {
    const result = planPublicGap({
      from: "MN",
      to: "IB",
      term: "Fall",
      weekday: "Wednesday",
      startTime: 11 * 60,
      endTime: 13 * 60,
      routePreferences: { mode: "step-free" },
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    if (result.route.status === "unavailable") {
      expect(result.assessment.routeStatus).toBe("unavailable");
      expect(result.assessment.warnings.join(" ").toLowerCase()).toContain("step-free");
    }
  });
});

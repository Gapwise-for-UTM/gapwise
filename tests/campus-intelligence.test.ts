import { describe, expect, test } from "bun:test";

import {
  listCampusBuildings,
  resolveCampusBuilding,
  routeBetweenCampusBuildings,
} from "../src/server/campus-intelligence";

describe("public campus intelligence", () => {
  test("lists canonical UTM buildings without exposing routing graph internals", () => {
    const buildings = listCampusBuildings();
    expect(buildings.length).toBeGreaterThan(10);
    const mn = buildings.find((building) => building.code === "MN");
    expect(mn?.name).toBe("Maanjiwe nendamowinan");
    expect(mn?.routing.mappedEntrances).toBeGreaterThan(0);
    expect(JSON.stringify(mn)).not.toContain("edges");
    expect(JSON.stringify(mn)).not.toContain("nodes");
  });

  test("resolves only canonical exact code/name/alias matches", () => {
    expect(resolveCampusBuilding("MN")?.code).toBe("MN");
    expect(resolveCampusBuilding("Maanjiwe nendamowinan")?.code).toBe("MN");
    expect(resolveCampusBuilding("Maanjiwe") ?? null).toBeNull();
    expect(resolveCampusBuilding("not-a-real-building") ?? null).toBeNull();
  });

  test("routes known buildings using deterministic Gapwise route semantics", () => {
    const route = routeBetweenCampusBuildings("MN", "IB", {
      mode: "fastest",
      walkingSpeedMps: 1.35,
      transitionBufferMinutes: 5,
    });
    expect(route).not.toBeNull();
    expect(route?.from.code).toBe("MN");
    expect(route?.to.code).toBe("IB");
    expect(["routed", "approximate", "unavailable"]).toContain(route?.status);
    if (route?.status === "routed") {
      expect(route.distanceMeters).toBeGreaterThan(0);
      expect(route.estimatedSeconds).toBeGreaterThan(0);
      expect(route.accuracy).toBe("Mapped campus path, indoor estimate");
    }
  });

  test("step-free mode fails closed instead of substituting unknown accessibility", () => {
    const route = routeBetweenCampusBuildings("MN", "IB", {
      mode: "step-free",
      walkingSpeedMps: 1.35,
      transitionBufferMinutes: 5,
    });
    expect(route).not.toBeNull();
    if (route?.status === "unavailable") {
      expect(route.warnings.join(" ").toLowerCase()).toContain("step-free");
    } else {
      expect(route?.preferences.mode).toBe("step-free");
    }
  });
});

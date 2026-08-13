import { describe, expect, test } from "bun:test";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { CAMPUS_ACCESS_POINTS } from "@/data/utm/campus-access-points";
import { CAMPUS_BUILDINGS } from "@/data/utm/campus";
import { isPointConfidentlyInsideCampus } from "@/features/routing/campus-presence";

describe("campus presence", () => {
  test("accepts a precise point in the middle of the bundled UTM network", () => {
    expect(
      isPointConfidentlyInsideCampus(
        { longitude: -79.66475, latitude: 43.55105, accuracyMeters: 12 },
        UTM_ROUTING_GRAPH,
      ),
    ).toBe(true);
  });

  test("rejects a clearly off-campus point", () => {
    expect(
      isPointConfidentlyInsideCampus(
        { longitude: -79.7, latitude: 43.57, accuracyMeters: 10 },
        UTM_ROUTING_GRAPH,
      ),
    ).toBe(false);
  });

  test("rejects an otherwise plausible point with poor reported accuracy", () => {
    expect(
      isPointConfidentlyInsideCampus(
        { longitude: -79.66475, latitude: 43.55105, accuracyMeters: 150 },
        UTM_ROUTING_GRAPH,
      ),
    ).toBe(false);
  });

  test("accepts supported buildings, residences, transit, and parking at campus edges", () => {
    const buildingPoints = CAMPUS_BUILDINGS.filter((building) =>
      ["MN", "DH", "KN", "OPH", "EH", "RIH"].includes(building.code),
    ).map((building) => building.navigationPoint);
    for (const [longitude, latitude] of [
      ...buildingPoints,
      ...CAMPUS_ACCESS_POINTS.map((point) => point.coordinates),
    ]) {
      expect(
        isPointConfidentlyInsideCampus(
          { longitude, latitude, accuracyMeters: 12 },
          UTM_ROUTING_GRAPH,
        ),
      ).toBe(true);
    }
  });

  test("rejects nearby non-campus, invalid, and non-finite reports", () => {
    const rejected = [
      { longitude: -79.6725, latitude: 43.552, accuracyMeters: 10 },
      { longitude: Number.NaN, latitude: 43.551, accuracyMeters: 10 },
      { longitude: -79.664, latitude: Number.POSITIVE_INFINITY, accuracyMeters: 10 },
      { longitude: 181, latitude: 43.551, accuracyMeters: 10 },
      { longitude: -79.664, latitude: 91, accuracyMeters: 10 },
      { longitude: -79.664, latitude: 43.551, accuracyMeters: -1 },
    ];
    for (const point of rejected) {
      expect(isPointConfidentlyInsideCampus(point, UTM_ROUTING_GRAPH)).toBe(false);
    }
  });
});

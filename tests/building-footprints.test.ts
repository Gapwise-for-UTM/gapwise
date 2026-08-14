import { describe, expect, test } from "bun:test";
import { UTM_BUILDINGS } from "@/data/utm/building-registry";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  CAMPUS_BUILDING_FOOTPRINTS,
  buildingCodeAtCoordinate,
  getCampusBuildingFootprint,
  getCampusBuildingFootprintBounds,
  pointInBuildingFootprint,
  representativePointForFootprint,
  type FootprintCoordinate,
} from "@/data/utm/building-footprints";
import { getCampusCameraBounds } from "@/features/routing/campus-region";

describe("canonical UTM building footprints", () => {
  test("covers every recognized building exactly once", () => {
    const expected = UTM_BUILDINGS.map((building) => building.code).sort();
    const actual = CAMPUS_BUILDING_FOOTPRINTS.features
      .map((feature) => feature.properties.buildingCode)
      .sort();
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(actual.length);
  });

  test("gives every building a usable interior point that resolves only to itself", () => {
    for (const feature of CAMPUS_BUILDING_FOOTPRINTS.features) {
      const point = representativePointForFootprint(feature);
      expect(point, `${feature.id} needs a representative interior point`).not.toBeNull();
      expect(buildingCodeAtCoordinate(point!), `${feature.id} must not cross-resolve`).toBe(
        feature.properties.buildingCode,
      );
    }
  });

  test("sampled interior points never resolve to a neighbouring building", () => {
    for (const feature of CAMPUS_BUILDING_FOOTPRINTS.features) {
      const bounds = getCampusBuildingFootprintBounds(feature.properties.buildingCode);
      expect(bounds).not.toBeNull();
      const [[west, south], [east, north]] = bounds!;
      let interiorSamples = 0;
      for (let row = 1; row < 48; row += 1) {
        for (let column = 1; column < 48; column += 1) {
          const point: FootprintCoordinate = [
            west + ((east - west) * column) / 48,
            south + ((north - south) * row) / 48,
          ];
          if (!pointInBuildingFootprint(point, feature)) continue;
          interiorSamples += 1;
          expect(
            buildingCodeAtCoordinate(point),
            `${feature.properties.buildingCode} cross-resolves near ${point.join(",")}`,
          ).toBe(feature.properties.buildingCode);
        }
      }
      expect(
        interiorSamples,
        `${feature.properties.buildingCode} needs sampled interior area`,
      ).toBeGreaterThan(0);
    }
  });

  test("keeps all canonical footprint bounds inside the shared UTM camera envelope", () => {
    const [[campusWest, campusSouth], [campusEast, campusNorth]] =
      getCampusCameraBounds(UTM_ROUTING_GRAPH);
    for (const building of UTM_BUILDINGS) {
      const bounds = getCampusBuildingFootprintBounds(building.code);
      expect(bounds, `${building.code} needs canonical bounds`).not.toBeNull();
      const [[west, south], [east, north]] = bounds!;
      expect(west).toBeGreaterThanOrEqual(campusWest);
      expect(south).toBeGreaterThanOrEqual(campusSouth);
      expect(east).toBeLessThanOrEqual(campusEast);
      expect(north).toBeLessThanOrEqual(campusNorth);
    }
  });

  test("separates the dense Erindale, Studio Theatre, Davis, and Kaneff cluster", () => {
    for (const code of ["EH", "DW", "DV", "KN"] as const) {
      const feature = getCampusBuildingFootprint(code);
      expect(feature).not.toBeNull();
      const point = representativePointForFootprint(feature!);
      expect(point).not.toBeNull();
      expect(buildingCodeAtCoordinate(point!)).toBe(code);
    }
  });

  test("returns no building for empty campus space and distant points", () => {
    expect(buildingCodeAtCoordinate([-79.6649, 43.54775])).toBeNull();
    expect(buildingCodeAtCoordinate([-79.7, 43.57])).toBeNull();
  });
});

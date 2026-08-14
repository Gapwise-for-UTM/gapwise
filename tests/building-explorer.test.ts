import { describe, expect, test } from "bun:test";
import {
  getBuildingExplorerDetails,
  searchCampusBuildings,
} from "@/features/routing/building-explorer";
import { UTM_BUILDINGS, normalizePublicBuildingCode } from "@/data/utm/building-registry";
import { getCampusBuildingFootprint } from "@/data/utm/building-footprints";
import { validateRouteSearch } from "@/routes/_app/route/index";

describe("UTM campus building explorer", () => {
  test("searches canonical buildings by code, name, and aliases", () => {
    expect(searchCampusBuildings("MN")[0]?.building.code).toBe("MN");
    expect(searchCampusBuildings("Maanjiwe")[0]?.building.code).toBe("MN");
    expect(searchCampusBuildings("Deerfield")[0]?.building.code).toBe("DH");
    expect(searchCampusBuildings("Instructional Centre")[0]?.building.code).toBe("IB");
    expect(searchCampusBuildings("Kaneff")[0]?.building.code).toBe("KN");
    expect(searchCampusBuildings("Student Centre")[0]?.building.code).toBe("XR");
  });

  test("maps every supported building search to its own canonical footprint", () => {
    for (const building of UTM_BUILDINGS) {
      const byCode = searchCampusBuildings(building.code)[0];
      expect(byCode?.building.code, `${building.code} code search`).toBe(building.code);

      const byName = searchCampusBuildings(building.name)[0];
      expect(byName?.building.code, `${building.name} name search`).toBe(building.code);

      for (const alias of building.aliases ?? []) {
        const byAlias = searchCampusBuildings(alias)[0];
        expect(byAlias?.building.code, `${alias} alias search`).toBe(building.code);
      }

      const footprint = getCampusBuildingFootprint(building.code);
      expect(footprint, `${building.code} canonical footprint`).not.toBeNull();
      expect(footprint?.properties.buildingCode).toBe(building.code);
    }
  });

  test("resolves room-like searches to a building and supported floor inference only", () => {
    const result = searchCampusBuildings("MN 3120")[0];
    expect(result).toMatchObject({
      building: { code: "MN", name: "Maanjiwe nendamowinan" },
      room: "3120",
      floor: "3",
      floorVerification: "inferred",
    });
    expect(result).not.toHaveProperty("roomCoordinate");
    expect(searchCampusBuildings("IB 245")[0]).toMatchObject({
      building: { code: "IB" },
      room: "245",
      floor: "2",
      floorVerification: "inferred",
    });
  });

  test("returns canonical entrance, accessibility, and verification details", () => {
    const details = getBuildingExplorerDetails("DH");
    expect(details?.campus.entrances.length).toBeGreaterThan(0);
    expect(details?.verifiedEntrances).toBe(details?.campus.entrances.length);
    expect(details?.campus.indoorMapped).toBeFalse();
    expect(details?.campus.entrances.every((entrance) => entrance.metadata.source.length > 0)).toBe(
      true,
    );
  });

  test("normalizes valid public building state and ignores invalid codes", () => {
    expect(normalizePublicBuildingCode("mn")).toBe("MN");
    expect(normalizePublicBuildingCode("not-a-building")).toBeNull();
    expect(getBuildingExplorerDetails("not-a-building")).toBeNull();
    expect(validateRouteSearch({ building: "dh" })).toEqual({ building: "DH" });
    expect(validateRouteSearch({ building: "not-a-building" })).toEqual({});
    expect(validateRouteSearch({ building: ["MN"] })).toEqual({});
  });
});

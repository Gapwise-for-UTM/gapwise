import { describe, expect, test } from "bun:test";
import { resolveAcornLocation } from "@/features/routing/location-resolver";
import type { BuildingConfiguration } from "@/features/routing/location-resolver";

describe("ACORN location resolution", () => {
  test("parses a known building and room", () => {
    const result = resolveAcornLocation("MN 1270");
    expect(result.buildingCode).toBe("MN");
    expect(result.room).toBe("1270");
    expect(result.status).toBe("known");
    expect(result.buildingRecognition).toBe("recognized");
    expect(result.routingDataStatus).toBe("verified");
  });

  test("handles blank locations", () => {
    expect(resolveAcornLocation(" ").status).toBe("unknown");
  });

  test("handles TBA locations", () => {
    expect(resolveAcornLocation("ZZ TBA").status).toBe("tba");
  });

  test("handles online locations", () => {
    expect(resolveAcornLocation("Online synchronous").status).toBe("online");
  });

  test("resolves supported building names", () => {
    expect(resolveAcornLocation("DH 2010").buildingName).toBe("Deerfield Hall");
    expect(resolveAcornLocation("IB 340").buildingName).toBe("Instructional Centre");
  });

  test.each([
    ["MN 1100", "MN"],
    ["DH 2010", "DH"],
    ["IB 340", "IB"],
    ["DV 2072", "DV"],
    ["CC 1080", "CCT"],
    ["CCT 1080", "CCT"],
    ["CC/CCT 1080", "CCT"],
    ["HM 100", "HM"],
    ["KN 137", "KN"],
    ["RA 200", "RAWC"],
    ["RAWC 200", "RAWC"],
    ["RA/RAWC 200", "RAWC"],
    ["XR 100", "XR"],
    ["HB 100", "HB"],
    ["AX 100", "AX"],
    ["DW 100", "DW"],
  ])("recognizes UTM location %s as %s", (location, code) => {
    const result = resolveAcornLocation(location);
    expect(result.buildingCode).toBe(code);
    expect(result.buildingRecognition).toBe("recognized");
  });

  test("resolves long-form aliases without treating the building name as a room", () => {
    expect(resolveAcornLocation("Instructional Centre 340")).toMatchObject({
      buildingCode: "IB",
      room: "340",
      buildingRecognition: "recognized",
    });
    expect(resolveAcornLocation("Davis Building 2072")).toMatchObject({
      buildingCode: "DV",
      room: "2072",
      buildingRecognition: "recognized",
    });
  });

  test("separates recognition from verified routing coverage", () => {
    const recognizedOnly = resolveAcornLocation("DV 2072");
    expect(recognizedOnly.status).toBe("known");
    expect(recognizedOnly.buildingRecognition).toBe("recognized");
    expect(recognizedOnly.routingDataStatus).toBe("unverified");
    expect(recognizedOnly.warning).toContain("verified routing data is unavailable");

    const unknown = resolveAcornLocation("XY 2010");
    expect(unknown.status).toBe("unknown");
    expect(unknown.buildingRecognition).toBe("unrecognized");
  });

  test("marks a configured floor rule as inferred, never verified", () => {
    const inferred = resolveAcornLocation("DH 2010");
    expect(inferred.floor).toBe("2");
    expect(inferred.floorVerification).toBe("inferred");

    const unknown = resolveAcornLocation("XY 2010");
    expect(unknown.floor).toBeNull();
    expect(unknown.floorVerification).toBe("unknown");
  });

  test("distinguishes an explicitly verified room floor from an inference", () => {
    const fixtures: BuildingConfiguration[] = [
      {
        code: "TS",
        name: "Synthetic test building",
        verifiedRoomFloors: {
          A101: {
            floor: "G",
            metadata: {
              source: "Synthetic fixture",
              sourceUrl: "https://example.test/floor",
              lastVerified: "2026-08-01",
              verificationStatus: "verified",
            },
          },
        },
        roomFloorRule: {
          kind: "first-digit",
          minimumLength: 4,
          metadata: {
            source: "Synthetic fixture",
            sourceUrl: "https://example.test/rules",
            lastVerified: "2026-08-01",
            verificationStatus: "verified",
          },
        },
      },
    ];
    expect(resolveAcornLocation("TS A101", fixtures).floorVerification).toBe("verified");
    expect(resolveAcornLocation("TS 2101", fixtures).floorVerification).toBe("inferred");
  });
});

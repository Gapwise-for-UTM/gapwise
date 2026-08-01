import { describe, expect, test } from "bun:test";
import { resolveAcornLocation } from "@/features/routing/location-resolver";
import type { BuildingConfiguration } from "@/features/routing/location-resolver";

describe("ACORN location resolution", () => {
  test("parses a known building and room", () => {
    const result = resolveAcornLocation("MN 1270");
    expect(result.buildingCode).toBe("MN");
    expect(result.room).toBe("1270");
    expect(result.status).toBe("known");
    expect(result.buildingVerification).toBe("verified");
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

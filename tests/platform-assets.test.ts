import { describe, expect, test } from "bun:test";

type DatasetBuilding = {
  code: string;
  provenance: Array<{ source: string; sourceUrl: string; verificationStatus: string }>;
  [key: string]: unknown;
};

describe("Gapwise Platform static assets", () => {
  test("publishes the bounded public API contract", async () => {
    const spec = (await Bun.file("public/openapi.json").json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths).sort()).toEqual(
      [
        "/api/utm-building",
        "/api/utm-buildings",
        "/api/utm-gap-plan",
        "/api/utm-route",
      ].sort(),
    );
  });

  test("publishes a 30-building provenance-preserving public snapshot", async () => {
    const dataset = (await Bun.file("public/data/utm-campus-v1.json").json()) as {
      schemaVersion: number;
      buildingCount: number;
      buildings: DatasetBuilding[];
      licenseNotice: string;
    };

    expect(dataset.schemaVersion).toBe(1);
    expect(dataset.buildingCount).toBe(30);
    expect(dataset.buildings).toHaveLength(30);
    expect(new Set(dataset.buildings.map((building) => building.code)).size).toBe(30);
    expect(dataset.buildings.every((building) => building.provenance.length > 0)).toBe(true);
    expect(dataset.buildings.some((building) => building.code === "MN")).toBe(true);
    expect(dataset.licenseNotice).toContain("OpenStreetMap");

    for (const building of dataset.buildings) {
      expect(building).not.toHaveProperty("userId");
      expect(building).not.toHaveProperty("email");
      expect(building).not.toHaveProperty("meetings");
      expect(building).not.toHaveProperty("liveLocation");
    }
  });

  test("keeps the public browser client dependency-free and bounded to the four endpoints", async () => {
    const sdk = await Bun.file("public/sdk/gapwise-utm.js").text();

    expect(sdk).not.toMatch(/^\s*import\s/m);
    expect(sdk).toContain("/api/utm-buildings");
    expect(sdk).toContain("/api/utm-building?q=");
    expect(sdk).toContain("/api/utm-route");
    expect(sdk).toContain("/api/utm-gap-plan");
    expect(sdk).toContain("export const gapwise");
  });
});

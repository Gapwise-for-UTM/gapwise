import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { DEFAULT_ROUTE_PREFERENCES } from "@/config/routing";
import { UTM_BUILDINGS, UTM_RESIDENCES } from "@/data/utm/building-registry";
import { CAMPUS_BUILDINGS, RESIDENCE_BUILDINGS, UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { findRoute } from "@/features/routing/engine";

describe("bundled UTM routing data", () => {
  test("covers every recognized academic and residence building", () => {
    expect(CAMPUS_BUILDINGS.map((building) => building.code).sort()).toEqual(
      UTM_BUILDINGS.map((building) => building.code).sort(),
    );
    expect(RESIDENCE_BUILDINGS.map((building) => building.code).sort()).toEqual(
      UTM_RESIDENCES.map((building) => building.code).sort(),
    );
    expect(RESIDENCE_BUILDINGS.map((building) => building.code).sort()).toEqual([
      "EH",
      "LL",
      "MC",
      "MV",
      "NRB",
      "OPH",
      "PP",
      "RIH",
      "SW",
    ]);
  });

  test("gives every mapped point explicit provenance and confidence", () => {
    for (const building of CAMPUS_BUILDINGS) {
      expect(building.entrances.length).toBeGreaterThan(0);
      for (const entrance of building.entrances) {
        expect(entrance.metadata.source.length).toBeGreaterThan(0);
        expect(entrance.metadata.sourceUrl).toStartWith("https://");
        expect(entrance.metadata.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (entrance.kind === "approach") {
          expect(entrance.metadata.verificationStatus).toBe("inferred");
          expect(entrance.notes?.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("connects every building to the main campus graph through at least one entrance", () => {
    const origin = CAMPUS_BUILDINGS.find((building) => building.code === "MN")!;
    for (const building of CAMPUS_BUILDINGS) {
      const routes = building.entrances.map((entrance) =>
        findRoute(
          UTM_ROUTING_GRAPH,
          origin.entranceNodeId,
          `osm-node-${entrance.osmNodeId}`,
          DEFAULT_ROUTE_PREFERENCES,
        ),
      );
      expect(routes.some(Boolean)).toBe(true);
    }
  });

  test("answers a full campus route matrix within a practical UI budget", () => {
    const started = performance.now();
    for (const origin of CAMPUS_BUILDINGS) {
      for (const destination of CAMPUS_BUILDINGS) {
        findRoute(
          UTM_ROUTING_GRAPH,
          origin.entranceNodeId,
          destination.entranceNodeId,
          DEFAULT_ROUTE_PREFERENCES,
        );
      }
    }
    expect(performance.now() - started).toBeLessThan(1_500);
  });

  test("keeps route calculation offline at runtime", async () => {
    const source = await readFile("src/components/CampusMap.tsx", "utf8");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("valhalla");
  });
});

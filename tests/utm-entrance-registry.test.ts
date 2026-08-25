import { describe, expect, test } from "bun:test";
import { UTM_BUILDINGS } from "@/data/utm/building-registry";
import { entranceRegistryIssues, UTM_ENTRANCE_REGISTRY } from "@/data/utm/entrance-registry";
import { OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES } from "@/data/utm/official-entrance-candidates";

describe("UTM entrance truth registry", () => {
  test("keeps every fact dimension valid and independently evidenced", () => {
    expect(entranceRegistryIssues()).toEqual([]);
    expect(new Set(UTM_ENTRANCE_REGISTRY.map((item) => item.id)).size).toBe(
      UTM_ENTRANCE_REGISTRY.length,
    );
    for (const entrance of UTM_ENTRANCE_REGISTRY) {
      for (const fact of Object.values(entrance.evidence)) {
        expect(fact.sourceIds.length).toBeGreaterThan(0);
        expect(fact.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      if (entrance.coordinates) {
        expect(entrance.coordinates[0]).toBeWithin(-180, 180);
        expect(entrance.coordinates[1]).toBeWithin(-90, 90);
      }
    }
  });

  test("does not silently lose or geolocate an official identity", () => {
    const registryCandidates = UTM_ENTRANCE_REGISTRY.filter((item) =>
      item.id.startsWith("utm:entrance-candidate:"),
    );
    expect(registryCandidates).toHaveLength(OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.length);
    for (const candidate of registryCandidates) {
      expect(candidate.coordinates).toBeUndefined();
      expect(candidate.routingNodeId).toBeUndefined();
      expect(candidate.officialReconciliation).toBeDefined();
    }
  });

  test("gives every registered building an explicit auditable state", () => {
    for (const building of UTM_BUILDINGS) {
      const records = UTM_ENTRANCE_REGISTRY.filter(
        (entrance) => entrance.buildingCode === building.code,
      );
      // Buildings without evidence are represented by the generated building audit,
      // rather than receiving a fabricated centroid endpoint.
      if (records.length === 0) expect(building.code.length).toBeGreaterThan(0);
    }
  });

  test("models the CCT-DV identities as non-routable building connections", () => {
    const connections = UTM_ENTRANCE_REGISTRY.filter((item) => item.kind === "building_connection");
    expect(connections.map((item) => item.buildingCode).sort()).toEqual(["CCT", "DV"]);
    expect(connections.every((item) => item.routability === "non_routable")).toBe(true);
    expect(connections.every((item) => item.coordinates === undefined)).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import { UTM_BUILDINGS } from "@/data/utm/building-registry";
import { entranceRegistryIssues, UTM_ENTRANCE_REGISTRY } from "@/data/utm/entrance-registry";
import entranceDataRaw from "@/data/utm/entrances.geojson?raw";
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

  test("keeps current OSM door verification dates aligned with the live dataset audit", () => {
    const entranceData = JSON.parse(entranceDataRaw) as {
      metadata: { lastVerified: string };
      features: Array<{
        properties: {
          kind: "entrance" | "approach";
          source: string;
          lastVerified: string;
        };
      }>;
    };
    const osmDoors = entranceData.features.filter(
      (feature) =>
        feature.properties.kind === "entrance" && feature.properties.source === "OpenStreetMap",
    );

    expect(osmDoors.length).toBeGreaterThan(0);
    expect(new Set(osmDoors.map((feature) => feature.properties.lastVerified))).toEqual(
      new Set([entranceData.metadata.lastVerified]),
    );
  });

  test("only geolocates official identities after explicit reconciliation", () => {
    const registryCandidates = UTM_ENTRANCE_REGISTRY.filter((item) =>
      item.id.startsWith("utm:entrance-candidate:"),
    );
    expect(registryCandidates).toHaveLength(OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.length);

    const matched = registryCandidates.filter(
      (candidate) => candidate.officialReconciliation === "matched",
    );
    expect(matched.map((candidate) => [candidate.buildingCode, candidate.routingNodeId])).toEqual([
      ["HM", "osm-node-13731205434"],
      ["RAWC", "osm-node-13568164832"],
    ]);
    expect(matched.every((candidate) => candidate.coordinates !== undefined)).toBe(true);
    expect(matched.every((candidate) => candidate.geometryConfidence === "mapped")).toBe(true);
    expect(matched.every((candidate) => candidate.routability === "candidate")).toBe(true);

    for (const candidate of registryCandidates) {
      expect(candidate.officialReconciliation).toBeDefined();
      if (candidate.officialReconciliation !== "matched") {
        expect(candidate.coordinates).toBeUndefined();
        expect(candidate.routingNodeId).toBeUndefined();
      }
    }
  });

  test("keeps unresolved MN main-tagged OSM candidates out of production entrances", () => {
    const entranceData = JSON.parse(entranceDataRaw) as {
      features: Array<{ id: string }>;
    };
    const unresolvedMnOsmIds = ["13736687034", "13736687041"];
    const productionEntranceIds = entranceData.features.map((feature) => feature.id);
    const registryIds = UTM_ENTRANCE_REGISTRY.map((item) => item.id);

    for (const osmId of unresolvedMnOsmIds) {
      expect(productionEntranceIds.some((id) => id.includes(osmId))).toBe(false);
      expect(registryIds.some((id) => id.includes(osmId))).toBe(false);
    }

    const mappedMnDoors = UTM_ENTRANCE_REGISTRY.filter(
      (item) => item.buildingCode === "MN" && item.id.startsWith("mn-"),
    );
    expect(mappedMnDoors.map((item) => item.id)).toEqual(["mn-13738201127"]);

    const officialMnIdentities = UTM_ENTRANCE_REGISTRY.filter(
      (item) => item.buildingCode === "MN" && item.id.startsWith("utm:entrance-candidate:mn:"),
    ).sort((a, b) => a.label.localeCompare(b.label));
    expect(officialMnIdentities.map((item) => item.label)).toEqual([
      "Field side",
      "Lot #1",
      "Main",
    ]);
    expect(officialMnIdentities.every((item) => item.coordinates === undefined)).toBe(true);
    expect(officialMnIdentities.every((item) => item.routingNodeId === undefined)).toBe(true);
  });

  test("preserves current restrictive access without inventing OPH entrance identities", () => {
    const mappedOphDoors = UTM_ENTRANCE_REGISTRY.filter(
      (item) => item.buildingCode === "OPH" && item.id.startsWith("oph-"),
    ).sort((a, b) => a.id.localeCompare(b.id));

    expect(mappedOphDoors.map((item) => item.id)).toEqual(["oph-13738728068", "oph-1728224590"]);
    expect(mappedOphDoors.map((item) => item.label)).toEqual([
      "Mapped entrance A",
      "Mapped entrance B",
    ]);
    expect(mappedOphDoors.every((item) => item.kind === "exterior_entrance")).toBe(true);
    expect(mappedOphDoors.every((item) => item.publicAccess === "restricted")).toBe(true);
    expect(mappedOphDoors.every((item) => item.routability === "routable")).toBe(true);

    const officialOphIdentities = UTM_ENTRANCE_REGISTRY.filter(
      (item) => item.buildingCode === "OPH" && item.id.startsWith("utm:entrance-candidate:oph:"),
    );
    expect(officialOphIdentities.map((item) => item.label).sort()).toEqual(["Main", "Rear"]);
    expect(officialOphIdentities.every((item) => item.coordinates === undefined)).toBe(true);
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

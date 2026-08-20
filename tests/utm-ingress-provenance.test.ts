import { describe, expect, test } from "bun:test";
import { DEFAULT_ROUTE_PREFERENCES } from "@/config/routing";
import { UTM_BUILDINGS } from "@/data/utm/building-registry";
import { CAMPUS_BUILDINGS, UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES } from "@/data/utm/official-entrance-candidates";
import { CAMPUS_SOURCE_RECORDS } from "@/data/utm/provenance";
import {
  assertCampusBuildingRoutingIntegrity,
  type BuildingEntrance,
  type CampusBuilding,
} from "@/data/utm/routing-buildings";
import { findRoute } from "@/features/routing/engine";

describe("UTM ingress provenance v2", () => {
  test("keeps stable source records for every new evidence source", () => {
    expect(Object.keys(CAMPUS_SOURCE_RECORDS).sort()).toEqual([
      "utm-facilities-buildings",
      "utm-facilities-snow-ice",
      "utm-housing-welcome-home",
    ]);
    for (const source of Object.values(CAMPUS_SOURCE_RECORDS)) {
      expect(source.id.length).toBeGreaterThan(0);
      expect(source.organization.length).toBeGreaterThan(0);
      expect(source.title.length).toBeGreaterThan(0);
      expect(source.url).toStartWith("https://");
      expect(source.retrievedAt).toBe("2026-08-20");
    }
  });

  test("records the 31 named barrier-free candidates without fabricating geometry", () => {
    expect(OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES).toHaveLength(31);
    expect(
      OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.reduce(
        (total, candidate) => total + candidate.instances,
        0,
      ),
    ).toBe(32);

    const ids = new Set<string>();
    for (const candidate of OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES) {
      expect(ids.has(candidate.id)).toBe(false);
      ids.add(candidate.id);
      expect(candidate.routingStatus).toBe("non_routable_candidate");
      expect(candidate.coordinates).toBeNull();
      expect(candidate.routingNodeId).toBeNull();
      expect(candidate.evidence.existence.confidence).toBe("verified");
      expect(candidate.evidence.barrierFree.confidence).toBe("verified");
      expect(candidate.evidence.geometry.confidence).toBe("unknown");
      expect(candidate.evidence.publicAccess.confidence).toBe("unknown");
    }

    expect(
      OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.find(
        (candidate) => candidate.buildingCode === "EH" && candidate.label === "Rear",
      ),
    ).toMatchObject({ instances: 2 });
  });

  test("never promotes non-routable candidates into the production routing graph", () => {
    const candidateIds = new Set(
      OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.map((candidate) => candidate.id),
    );
    const graphNodeIds = new Set(UTM_ROUTING_GRAPH.nodes.map((node) => node.id));

    for (const candidate of OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES) {
      expect(graphNodeIds.has(candidate.id)).toBe(false);
    }
    for (const building of CAMPUS_BUILDINGS) {
      for (const entrance of building.entrances) {
        expect(candidateIds.has(entrance.id)).toBe(false);
      }
    }

    // Official barrier-free identities alone do not turn identity-only buildings
    // into routable buildings.
    expect(
      OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.some(
        (candidate) => candidate.buildingCode === "NSB",
      ),
    ).toBe(true);
    expect(CAMPUS_BUILDINGS.some((building) => building.code === "NSB")).toBe(false);
  });

  test("does not upgrade existing inferred geometry or step-free behavior", () => {
    const academicAnnex = CAMPUS_BUILDINGS.find((building) => building.code === "AX");
    const davis = CAMPUS_BUILDINGS.find((building) => building.code === "DV");
    expect(academicAnnex).toBeDefined();
    expect(davis).toBeDefined();

    expect(academicAnnex!.entrances[0]).toMatchObject({
      kind: "approach",
      accessibility: "unknown",
      metadata: { verificationStatus: "inferred" },
    });

    const stepFree = findRoute(
      UTM_ROUTING_GRAPH,
      academicAnnex!.entranceNodeId,
      davis!.entranceNodeId,
      { ...DEFAULT_ROUTE_PREFERENCES, mode: "step-free" },
    );
    expect(stepFree).toBeNull();
  });

  test("uses routing-node identity independently from optional OSM external IDs", () => {
    const fieldSurveyEntrance: BuildingEntrance = {
      id: "mn:entrance:field-survey-example",
      label: "Field-survey example",
      kind: "entrance",
      coordinates: [-79.6654, 43.5513],
      routingNodeId: "survey-node-mn-field-survey-example",
      accessibility: "unknown",
      metadata: {
        source: "Gapwise field survey",
        sourceUrl: "https://gapwise.ca",
        lastVerified: "2026-08-20",
        verificationStatus: "verified",
      },
    };
    expect(fieldSurveyEntrance.osmNodeId).toBeUndefined();
    expect(fieldSurveyEntrance.routingNodeId).toBe("survey-node-mn-field-survey-example");

    const graphNodeIds = new Set(UTM_ROUTING_GRAPH.nodes.map((node) => node.id));
    expect(() => assertCampusBuildingRoutingIntegrity(CAMPUS_BUILDINGS, graphNodeIds)).not.toThrow();

    for (const building of CAMPUS_BUILDINGS) {
      for (const entrance of building.entrances) {
        expect(entrance.routingNodeId.length).toBeGreaterThan(0);
        if (entrance.osmNodeId !== undefined) {
          expect(entrance.externalIds?.osmNodeId).toBe(entrance.osmNodeId);
          expect(entrance.routingNodeId).toBe(`osm-node-${entrance.osmNodeId}`);
        }
      }
      expect(building.entranceNodeId).toBe(building.entrances[0]!.routingNodeId);
    }
  });

  test("fails closed when an explicit entrance routing-node identity is dangling", () => {
    const invalidEntrance: BuildingEntrance = {
      id: "test:entrance",
      label: "Synthetic entrance",
      kind: "entrance",
      coordinates: [-79.6654, 43.5513],
      routingNodeId: "survey-node-missing",
      osmNodeId: 123,
      externalIds: { osmNodeId: 123 },
      accessibility: "unknown",
      metadata: {
        source: "Synthetic test",
        sourceUrl: "https://gapwise.ca",
        lastVerified: "2026-08-20",
        verificationStatus: "verified",
      },
    };
    const invalidBuilding: CampusBuilding = {
      code: "TEST",
      name: "Synthetic test building",
      category: "academic",
      entrances: [invalidEntrance],
      navigationPoint: invalidEntrance.coordinates,
      entranceNodeId: invalidEntrance.routingNodeId,
      indoorMapped: false,
    };

    expect(() =>
      assertCampusBuildingRoutingIntegrity([invalidBuilding], new Set(["osm-node-123"])),
    ).toThrow("survey-node-missing");
  });

  test("adds official codes, room prefixes, and shared-complex metadata without parser changes", () => {
    const building = (code: string) => UTM_BUILDINGS.find((item) => item.code === code)!;

    expect(building("CCT").officialCodes?.values).toEqual(["CC"]);
    expect(building("RAWC").officialCodes?.values).toEqual(["RA"]);
    expect(building("LL").officialCodes?.values).toEqual(["R"]);

    expect(building("OPH").roomPrefixes?.values).toEqual(["OP"]);
    expect(building("RIH").roomPrefixes?.values).toEqual(["RH"]);
    expect(building("EH").roomPrefixes?.values).toEqual(["EH"]);
    expect(building("SW").roomPrefixes?.values).toEqual(["SW"]);

    expect(building("KN").sharedComplex?.id).toBe("kaneff-innovation");
    expect(building("IC").sharedComplex?.id).toBe("kaneff-innovation");
    expect(building("KN").officialCodes?.values).toEqual(["KN"]);
    expect(building("IC").officialCodes?.values).toEqual(["KN"]);

    // Existing aliases stay unchanged in this PR; evidence metadata is not
    // automatically promoted into parser behavior.
    expect(building("RIH").aliases).not.toContain("RH");
    expect(building("IC").aliases).not.toContain("KN");
  });
});

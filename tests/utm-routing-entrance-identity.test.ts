import { describe, expect, test } from "bun:test";
import { CAMPUS_BUILDINGS, UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  assertCampusBuildingRoutingIntegrity,
  type BuildingEntrance,
  type CampusBuilding,
} from "@/data/utm/routing-buildings";

describe("UTM routing entrance identity", () => {
  test("uses graph-node identity independently from optional OSM external IDs", () => {
    const fieldSurveyEntrance: BuildingEntrance = {
      id: "mn:entrance:field-survey-example",
      label: "Field-survey example",
      kind: "entrance",
      coordinates: [-79.6654, 43.5513],
      routingNodeId: "survey-node-mn-field-survey-example",
      accessibility: "unknown",
      access: "unknown",
      direction: "unknown",
      verificationMethod: "field survey",
      sourceIdentifier: "survey:2026-09-example/mn-main",
      metadata: {
        source: "Gapwise field survey",
        sourceUrl: "https://gapwise.ca",
        lastVerified: "2026-08-21",
        verificationStatus: "verified",
      },
    };

    expect(fieldSurveyEntrance.osmNodeId).toBeUndefined();
    expect(fieldSurveyEntrance.routingNodeId).toBe("survey-node-mn-field-survey-example");

    const graphNodeIds = new Set(UTM_ROUTING_GRAPH.nodes.map((node) => node.id));
    expect(() =>
      assertCampusBuildingRoutingIntegrity(CAMPUS_BUILDINGS, graphNodeIds),
    ).not.toThrow();

    for (const building of CAMPUS_BUILDINGS) {
      for (const entrance of building.entrances) {
        expect(entrance.routingNodeId.length).toBeGreaterThan(0);
        expect(graphNodeIds.has(entrance.routingNodeId)).toBe(true);
        if (entrance.osmNodeId !== undefined) {
          expect(entrance.externalIds?.osmNodeId).toBe(entrance.osmNodeId);
          expect(entrance.routingNodeId).toBe(`osm-node-${entrance.osmNodeId}`);
        }
      }
      expect(building.entranceNodeId).toBe(building.entrances[0]!.routingNodeId);
    }
  });

  test("fails closed when a verified entrance points at a missing graph node", () => {
    const invalidEntrance: BuildingEntrance = {
      id: "test:entrance",
      label: "Synthetic entrance",
      kind: "entrance",
      coordinates: [-79.6654, 43.5513],
      routingNodeId: "survey-node-missing",
      osmNodeId: 123,
      externalIds: { osmNodeId: 123 },
      accessibility: "unknown",
      access: "public",
      direction: "both",
      verificationMethod: "synthetic test",
      sourceIdentifier: "test:entrance/123",
      metadata: {
        source: "Synthetic test",
        sourceUrl: "https://gapwise.ca",
        lastVerified: "2026-08-21",
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
});

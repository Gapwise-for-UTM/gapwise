import { describe, expect, test } from "bun:test";
import { UTM_BUILDINGS } from "@/data/utm/building-registry";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES,
  OFFICIAL_OTHER_ENTRANCE_IDENTITIES,
  officialOtherEntranceIdentitiesForBuilding,
} from "@/data/utm/official-entrance-candidates";
import { CAMPUS_SOURCE_RECORDS } from "@/data/utm/provenance";

describe("official UTM exterior-access evidence", () => {
  test("registers official sources while keeping map/event/procurement evidence constrained", () => {
    expect(Object.keys(CAMPUS_SOURCE_RECORDS).sort()).toEqual([
      "openstreetmap",
      "utm-facilities-buildings",
      "utm-facilities-snow-ice",
      "utm-procurement-oph-main-lobby-2026",
      "utoronto-interactive-map",
      "utoronto-robotics-2025-conference",
    ]);
    expect(CAMPUS_SOURCE_RECORDS["utm-facilities-snow-ice"].url).toBe(
      "https://www.utm.utoronto.ca/facilities/utm-strategy-snow-and-ice-removal",
    );
    expect(CAMPUS_SOURCE_RECORDS["utoronto-interactive-map"].notes).toContain("visual QA");
    expect(CAMPUS_SOURCE_RECORDS["utoronto-interactive-map"].notes).toContain("does not scrape");
    expect(CAMPUS_SOURCE_RECORDS["utoronto-robotics-2025-conference"].url).toBe(
      "https://robotics.utoronto.ca/2025-toronto-robotics-conference/",
    );
    const roboticsNotes = CAMPUS_SOURCE_RECORDS["utoronto-robotics-2025-conference"].notes;
    expect(roboticsNotes).toContain("MN north entrance (2nd floor)");
    expect(roboticsNotes).toContain("no exact door coordinate");
    expect(roboticsNotes).toContain("unrestricted public access");
    expect(roboticsNotes).toContain("barrier-free status");

    const ophProcurement = CAMPUS_SOURCE_RECORDS["utm-procurement-oph-main-lobby-2026"];
    expect(ophProcurement.organization).toBe("University of Toronto Mississauga");
    expect(ophProcurement.url).toBe(
      "https://www.merx.com/uoft/solicitations/open-bids/Laundry-Vending-Services-and-Equipment/0000319578",
    );
    expect(ophProcurement.notes).toContain("Oscar Peterson Hall – main entrance lobby");
    expect(ophProcurement.notes).toContain("no exact exterior door coordinate");
    expect(ophProcurement.notes).toContain("does not identify which current OSM entrance node");

    for (const source of Object.values(CAMPUS_SOURCE_RECORDS)) {
      expect(source.url).toStartWith("https://");
      expect(source.retrievedAt).toMatch(/^2026-(08-(10|21)|09-(13|14))$/);
    }
  });

  test("records current official building codes without changing stable Gapwise identities", () => {
    const building = (code: string) => UTM_BUILDINGS.find((item) => item.code === code)!;

    expect(building("CCT").officialCodes?.values).toEqual(["CC"]);
    expect(building("RAWC").officialCodes?.values).toEqual(["RA"]);
    expect(building("LL").officialCodes?.values).toEqual(["R"]);
    expect(building("KN").officialCodes?.values).toEqual(["KN"]);
    expect(building("IC").officialCodes?.values).toEqual(["KN"]);
    expect(building("KN").sharedComplex?.id).toBe("kaneff-innovation");
    expect(building("IC").sharedComplex?.id).toBe("kaneff-innovation");

    // Evidence metadata must not silently make KN a parser alias for Innovation Complex.
    expect(building("IC").aliases).not.toContain("KN");
  });

  test("records all named barrier-free identities while only reconciling exact defensible geometry", () => {
    expect(OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES).toHaveLength(31);
    expect(
      OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.reduce(
        (total, candidate) => total + candidate.instances,
        0,
      ),
    ).toBe(32);

    const recognizedCodes = new Set(UTM_BUILDINGS.map((building) => building.code));
    const ids = new Set<string>();
    const matched = OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.filter(
      (candidate) => candidate.reconciliationStatus === "matched",
    );
    expect(
      matched.map((candidate) => [
        candidate.buildingCode,
        candidate.label,
        candidate.routingNodeId,
      ]),
    ).toEqual([
      ["HM", "Main", "osm-node-13731205434"],
      ["RAWC", "Main", "osm-node-13568164832"],
    ]);

    for (const candidate of OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES) {
      expect(recognizedCodes.has(candidate.buildingCode)).toBe(true);
      expect(ids.has(candidate.id)).toBe(false);
      ids.add(candidate.id);
      expect(["candidate", "non_routable"]).toContain(candidate.routingStatus);
      expect(candidate.evidence.existence.confidence).toBe("verified");
      expect(candidate.evidence.barrierFree.confidence).toBe("verified");
      expect(candidate.evidence.publicAccess.confidence).toBe("unknown");

      if (candidate.reconciliationStatus === "matched") {
        expect(candidate.coordinates).not.toBeNull();
        expect(candidate.routingNodeId).not.toBeNull();
        expect(candidate.evidence.geometry.confidence).toBe("verified");
        expect(candidate.evidence.geometry.sourceIds).toContain("openstreetmap");
        expect(candidate.evidence.geometry.sourceIds).toContain("utm-facilities-snow-ice");
      } else {
        expect(candidate.coordinates).toBeNull();
        expect(candidate.routingNodeId).toBeNull();
        expect(candidate.evidence.geometry.confidence).toBe("unknown");
        expect(["geometry_unknown", "intentionally_non_routable"]).toContain(
          candidate.reconciliationStatus,
        );
      }
    }

    expect(
      OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.find(
        (candidate) => candidate.buildingCode === "EH" && candidate.label === "Rear",
      ),
    ).toMatchObject({ instances: 2 });
  });

  test("corroborates OPH Main without guessing which mapped door is Main or Rear", () => {
    const ophMain = OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.find(
      (candidate) => candidate.buildingCode === "OPH" && candidate.label === "Main",
    );
    const ophRear = OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.find(
      (candidate) => candidate.buildingCode === "OPH" && candidate.label === "Rear",
    );

    expect(ophMain).toMatchObject({
      reconciliationStatus: "geometry_unknown",
      coordinates: null,
      routingNodeId: null,
    });
    expect(ophMain?.evidence.existence.sourceIds).toEqual([
      "utm-facilities-snow-ice",
      "utm-procurement-oph-main-lobby-2026",
    ]);
    expect(ophMain?.evidence.existence.lastVerified).toBe("2026-09-14");
    expect(ophMain?.evidence.geometry.confidence).toBe("unknown");
    expect(ophMain?.evidence.barrierFree.sourceIds).toEqual(["utm-facilities-snow-ice"]);

    expect(ophRear).toMatchObject({
      reconciliationStatus: "geometry_unknown",
      coordinates: null,
      routingNodeId: null,
    });
    expect(ophRear?.evidence.existence.sourceIds).toEqual(["utm-facilities-snow-ice"]);
  });

  test("preserves the authoritative MN North identity without inventing geometry or accessibility", () => {
    expect(OFFICIAL_OTHER_ENTRANCE_IDENTITIES).toHaveLength(1);
    const north = officialOtherEntranceIdentitiesForBuilding("mn")[0];
    expect(north).toMatchObject({
      id: "utm:entrance-identity:mn:north-2f",
      buildingCode: "MN",
      label: "North entrance",
      levelContext: "2nd floor",
      coordinates: null,
    });
    expect(north?.evidence.existence.confidence).toBe("verified");
    expect(north?.evidence.existence.sourceIds).toEqual(["utoronto-robotics-2025-conference"]);
    expect(north?.evidence.existence.lastVerified).toBe("2026-09-13");
    expect(north?.evidence.geometry.confidence).toBe("unknown");
    expect(north?.evidence.geometry.sourceIds).toContain("openstreetmap");
    expect(north?.evidence.geometry.lastVerified).toBe("2026-09-13");
    expect(north?.evidence.publicAccess.confidence).toBe("unknown");
    expect(north?.evidence.barrierFree.confidence).toBe("unknown");
    expect(officialOtherEntranceIdentitiesForBuilding("DV")).toEqual([]);
  });

  test("never duplicates official identity records as independent routing graph nodes", () => {
    const graphNodeIds = new Set(UTM_ROUTING_GRAPH.nodes.map((node) => node.id));
    for (const candidate of OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES) {
      expect(graphNodeIds.has(candidate.id)).toBe(false);
      if (candidate.reconciliationStatus === "matched") {
        expect(candidate.routingNodeId).not.toBeNull();
        expect(graphNodeIds.has(candidate.routingNodeId!)).toBe(true);
      }
    }
    for (const identity of OFFICIAL_OTHER_ENTRANCE_IDENTITIES) {
      expect(identity.coordinates).toBeNull();
      expect(graphNodeIds.has(identity.id)).toBe(false);
    }
  });
});

import { describe, expect, test } from "bun:test";
import { UTM_BUILDINGS } from "@/data/utm/building-registry";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES } from "@/data/utm/official-entrance-candidates";
import { CAMPUS_SOURCE_RECORDS } from "@/data/utm/provenance";

describe("official UTM exterior-access evidence", () => {
  test("registers the official sources with the interactive map constrained to visual QA", () => {
    expect(Object.keys(CAMPUS_SOURCE_RECORDS).sort()).toEqual([
      "utm-facilities-buildings",
      "utm-facilities-snow-ice",
      "utoronto-interactive-map",
    ]);
    expect(CAMPUS_SOURCE_RECORDS["utm-facilities-snow-ice"].url).toBe(
      "https://www.utm.utoronto.ca/facilities/utm-strategy-snow-and-ice-removal",
    );
    expect(CAMPUS_SOURCE_RECORDS["utoronto-interactive-map"].notes).toContain("visual QA");
    expect(CAMPUS_SOURCE_RECORDS["utoronto-interactive-map"].notes).toContain("does not scrape");
    for (const source of Object.values(CAMPUS_SOURCE_RECORDS)) {
      expect(source.url).toStartWith("https://");
      expect(source.retrievedAt).toBe("2026-08-21");
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

  test("records all named barrier-free identities in the current building registry without inventing geometry", () => {
    expect(OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES).toHaveLength(31);
    expect(
      OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.reduce(
        (total, candidate) => total + candidate.instances,
        0,
      ),
    ).toBe(32);

    const recognizedCodes = new Set(UTM_BUILDINGS.map((building) => building.code));
    const ids = new Set<string>();
    for (const candidate of OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES) {
      expect(recognizedCodes.has(candidate.buildingCode)).toBe(true);
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

  test("never turns official identity-only evidence into routing geometry", () => {
    const graphNodeIds = new Set(UTM_ROUTING_GRAPH.nodes.map((node) => node.id));
    for (const candidate of OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES) {
      expect(graphNodeIds.has(candidate.id)).toBe(false);
      expect(candidate.routingNodeId).toBeNull();
    }
  });
});

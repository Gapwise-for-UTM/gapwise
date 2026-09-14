import { describe, expect, test } from "bun:test";
import {
  fieldSurveyTargetsForBuilding,
  UTM_FIELD_SURVEY_TARGETS,
} from "@/data/utm/field-survey-targets";
import {
  OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES,
  OFFICIAL_OTHER_ENTRANCE_IDENTITIES,
} from "@/data/utm/official-entrance-candidates";
import { CAMPUS_SOURCE_RECORDS } from "@/data/utm/provenance";

describe("UTM field survey targets", () => {
  test("references only known evidence sources and official entrance identities", () => {
    const candidateIds = new Set(
      OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.map((candidate) => candidate.id),
    );
    const identityIds = new Set(OFFICIAL_OTHER_ENTRANCE_IDENTITIES.map((identity) => identity.id));

    for (const target of UTM_FIELD_SURVEY_TARGETS) {
      for (const sourceId of target.sourceIds) expect(CAMPUS_SOURCE_RECORDS[sourceId]).toBeDefined();
      if (target.officialCandidateId) expect(candidateIds.has(target.officialCandidateId)).toBe(true);
      if (target.officialIdentityId) expect(identityIds.has(target.officialIdentityId)).toBe(true);
    }
  });

  test("keeps approach-only residence points from becoming selectable physical doors", () => {
    for (const buildingCode of ["EH", "RIH"]) {
      const candidates = fieldSurveyTargetsForBuilding(buildingCode).flatMap(
        (target) => target.geometryCandidates ?? [],
      );
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.every((candidate) => candidate.kind === "approach_only")).toBe(true);
    }
  });

  test("keeps both OPH physical doors unresolved until the field identity is observed", () => {
    const candidates = fieldSurveyTargetsForBuilding("OPH").flatMap(
      (target) => target.geometryCandidates ?? [],
    );
    expect(new Set(candidates.map((candidate) => candidate.osmNodeId))).toEqual(
      new Set([13738728068, 1728224590]),
    );
    expect(candidates.every((candidate) => candidate.kind === "physical_door_unreconciled")).toBe(
      true,
    );
  });

  test("covers MN perimeter completion, all official Facilities identities, and the north 2F identity", () => {
    const ids = new Set(fieldSurveyTargetsForBuilding("MN").map((target) => target.id));
    expect(ids).toEqual(
      new Set([
        "mn-perimeter-completeness",
        "mn-main",
        "mn-field-side",
        "mn-lot-1",
        "mn-north-2f",
      ]),
    );
  });

  test("represents the CCT/HMALC connection as a walkthrough target rather than invented geometry", () => {
    const target = UTM_FIELD_SURVEY_TARGETS.find((item) => item.id === "cct-hm-link");
    expect(target).toMatchObject({
      buildingCodes: ["CCT", "HM"],
      targetKind: "building_connection",
      geometryCandidates: undefined,
    });
  });
});

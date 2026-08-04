import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  convertSurveyToRoutingData,
  SurveyValidationError,
  validateCampusSurvey,
  type CampusSurvey,
} from "@/data/utm/survey-format";
import { routingGraphIssues } from "@/features/routing/graph-integrity";

function validSurvey(): CampusSurvey {
  return {
    schemaVersion: 1,
    survey: {
      date: "2026-08-04",
      source: "Synthetic field survey fixture",
      sourceUrl: "https://example.test/utm-survey",
      notes: "Synthetic data only.",
    },
    buildings: [{ code: "MN", floors: ["1"] }],
    nodes: [
      {
        id: "mn:room:1270",
        building: "MN",
        floor: "1",
        kind: "room",
        labelOrRoom: "1270",
        accessibility: "unknown",
        indoorX: 100,
        indoorY: 200,
        photoReference: "synthetic-room-photo",
      },
      {
        id: "mn:hall:1a",
        building: "MN",
        floor: "1",
        kind: "hallway",
        labelOrRoom: "Hallway junction 1A",
        accessibility: "accessible",
        indoorX: 120,
        indoorY: 200,
      },
    ],
    edges: [
      {
        id: "mn:edge:room-1270-hall-1a",
        connectedFrom: "mn:room:1270",
        connectedTo: "mn:hall:1a",
        distanceMeters: 8.4,
        environment: "indoor",
        stairs: false,
        accessibility: "unknown",
        bidirectional: true,
      },
    ],
  };
}

function expectValidationIssue(value: unknown, text: string) {
  try {
    validateCampusSurvey(value);
    throw new Error("Expected survey validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(SurveyValidationError);
    expect((error as Error).message).toContain(text);
  }
}

describe("campus survey validation and import", () => {
  test("converts a valid survey into sorted production routing records", () => {
    const survey = validSurvey();
    const converted = convertSurveyToRoutingData(survey);

    expect(converted.nodes.map((node) => node.id)).toEqual(["mn:hall:1a", "mn:room:1270"]);
    expect(converted.nodes.find((node) => node.kind === "room")).toMatchObject({
      room: "1270",
      accessibility: "unknown",
      photoReference: "synthetic-room-photo",
    });
    expect(converted.edges[0]).toMatchObject({
      from: "mn:room:1270",
      to: "mn:hall:1a",
      accessibility: "unknown",
    });
  });

  test("is deterministic regardless of input record order", () => {
    const first = validSurvey();
    const second = validSurvey();
    second.nodes.reverse();

    expect(convertSurveyToRoutingData(second)).toEqual(convertSurveyToRoutingData(first));
  });

  test("rejects duplicate IDs and missing endpoints with actionable paths", () => {
    const duplicate = validSurvey();
    duplicate.nodes[1]!.id = duplicate.nodes[0]!.id;
    expectValidationIssue(duplicate, "Duplicate or reserved ID");

    const missing = validSurvey();
    missing.edges[0]!.connectedTo = "mn:missing";
    expectValidationIssue(missing, "connectedTo references missing node");
  });

  test("rejects impossible distances and invalid floor or building references", () => {
    const impossible = validSurvey();
    impossible.edges[0]!.distanceMeters = 0;
    expectValidationIssue(impossible, "distanceMeters must be greater than 0");

    const invalidFloor = validSurvey();
    invalidFloor.nodes[0]!.floor = "9";
    expectValidationIssue(invalidFloor, "is not declared for MN");

    const invalidBuilding = validSurvey();
    invalidBuilding.buildings[0]!.code = "ZZ";
    expectValidationIssue(invalidBuilding, "recognized uppercase UTM building code");
  });

  test("rejects malformed records and contradictory stairs accessibility", () => {
    const malformed = validSurvey() as CampusSurvey & { unexpected?: boolean };
    malformed.unexpected = true;
    expectValidationIssue(malformed, "unexpected is not a supported field");

    const stairs = validSurvey();
    stairs.nodes[1]!.kind = "stairs";
    stairs.edges[0]!.stairs = true;
    stairs.edges[0]!.accessibility = "accessible";
    expectValidationIssue(stairs, "cannot be both stairs and accessible");
  });

  test("accepts all three explicit accessibility states", () => {
    for (const accessibility of ["accessible", "not_accessible", "unknown"] as const) {
      const survey = validSurvey();
      survey.edges[0]!.accessibility = accessibility;
      survey.nodes[0]!.accessibility = accessibility;
      expect(validateCampusSurvey(survey).edges[0]?.accessibility).toBe(accessibility);
    }
  });

  test("keeps the committed production graph internally consistent", () => {
    expect(routingGraphIssues(UTM_ROUTING_GRAPH)).toEqual([]);
  });

  test("reports production graph duplicate IDs, missing endpoints, and invalid distances", () => {
    const survey = convertSurveyToRoutingData(validSurvey());
    const firstNode = survey.nodes[0]!;
    const issues = routingGraphIssues({
      nodes: [firstNode, { ...firstNode }],
      edges: [
        {
          ...survey.edges[0]!,
          from: "missing",
          distanceMeters: -1,
        },
      ],
    });

    expect(issues.join(" ")).toContain("Duplicate node ID");
    expect(issues.join(" ")).toContain("missing from endpoint");
    expect(issues.join(" ")).toContain("distance must be greater than 0");
  });

  test("ships a dated, schema-linked August 4 template", async () => {
    const template = JSON.parse(await readFile("survey/2026-08-04-template.json", "utf8"));
    const schema = JSON.parse(await readFile("survey/campus-survey.schema.json", "utf8"));
    expect(template).toMatchObject({
      $schema: "./campus-survey.schema.json",
      schemaVersion: 1,
      survey: { date: "2026-08-04" },
    });
    expect(schema["$schema"]).toContain("2020-12");
    expect(validateCampusSurvey(template).nodes).toEqual([]);
  });
});

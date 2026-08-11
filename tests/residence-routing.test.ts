import { describe, expect, test } from "bun:test";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  createResidenceMeeting,
  isResidenceMeeting,
  selectedResidence,
} from "@/features/routing/residence";
import { planMeetingTransition } from "@/features/routing/transition";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import { meeting } from "./fixtures";

const residentPreferences = {
  ...DEFAULT_USER_PREFERENCES,
  dayOrigin: "residence" as const,
  residenceBuildingCode: "EH",
};

describe("residence-aware campus routing", () => {
  test("keeps commuter mode free of an inferred home", () => {
    expect(selectedResidence(DEFAULT_USER_PREFERENCES)).toBeNull();
    expect(selectedResidence(residentPreferences)?.name).toBe("Erindale Hall");
  });

  test("creates explicit private synthetic endpoints without changing class data", () => {
    const home = createResidenceMeeting({
      buildingCode: "EH",
      term: "Fall",
      weekday: "Monday",
      time: 540,
      position: "start",
    });
    expect(isResidenceMeeting(home)).toBe(true);
    expect(home).toMatchObject({
      courseCode: "Home",
      buildingCode: "EH",
      locationType: "physical",
      startTime: 540,
      endTime: 540,
    });
  });

  test("routes home to the first class and the last class home on bundled paths", () => {
    const homeStart = createResidenceMeeting({
      buildingCode: "EH",
      term: "Fall",
      weekday: "Monday",
      time: 540,
      position: "start",
    });
    const firstClass = meeting({ id: "first", buildingCode: "MN", room: "1270" });
    const lastClass = meeting({
      id: "last",
      buildingCode: "IB",
      room: "340",
      startTime: 900,
      endTime: 960,
    });
    const homeEnd = createResidenceMeeting({
      buildingCode: "EH",
      term: "Fall",
      weekday: "Monday",
      time: 960,
      position: "end",
    });
    const segments = [
      planMeetingTransition(homeStart, firstClass, UTM_ROUTING_GRAPH, residentPreferences),
      planMeetingTransition(firstClass, lastClass, UTM_ROUTING_GRAPH, residentPreferences),
      planMeetingTransition(lastClass, homeEnd, UTM_ROUTING_GRAPH, residentPreferences),
    ];

    expect(segments.every((segment) => segment.status === "routed")).toBe(true);
    expect(segments.every((segment) => segment.displayCoordinates.length > 2)).toBe(true);
    expect(segments[0]!.warnings.join(" ")).toContain("field verification");
    expect(segments[2]!.warnings.join(" ")).toContain("field verification");
  });

  test("uses the reviewed central shortcut for the fastest Erindale-to-Davis route", () => {
    const home = createResidenceMeeting({
      buildingCode: "EH",
      term: "Fall",
      weekday: "Monday",
      time: 540,
      position: "start",
    });
    const davisClass = meeting({ id: "davis", buildingCode: "DV", room: "2080" });
    const route = planMeetingTransition(home, davisClass, UTM_ROUTING_GRAPH, residentPreferences);

    expect(route.status).toBe("routed");
    expect(route.result!.totalDistanceMeters).toBeLessThan(400);
    expect(route.result!.edges.map((edge) => edge.id)).toContain(
      "reviewed-topology-connector-five-minute-walk-east-link",
    );
  });
});

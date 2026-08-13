import { describe, expect, test } from "bun:test";
import { DEFAULT_ROUTE_PREFERENCES } from "@/config/routing";
import { CAMPUS_ACCESS_POINTS, getCampusAccessPoint } from "@/data/utm/campus-access-points";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  campusAccessPointForMeeting,
  campusDayAnchorPresentation,
  classNumberForRouteStop,
  createCampusDayRouteStops,
  isCampusDayAnchorMeeting,
} from "@/features/routing/campus-day";
import { planMeetingTransition } from "@/features/routing/transition";
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from "@/features/sync/preferences";
import { meeting } from "./fixtures";

const classes = [
  meeting({ id: "first", startTime: 540, endTime: 600, buildingCode: "MN" }),
  meeting({ id: "last", startTime: 780, endTime: 840, buildingCode: "IB", room: "340" }),
];

function commutePreferences(
  commuteMode: "transit" | "parking",
  campusAccessPointId: string,
): UserPreferences {
  return { ...DEFAULT_USER_PREFERENCES, commuteMode, campusAccessPointId };
}

describe("complete campus day routes", () => {
  test("wraps residence, transit, and parking days without consuming class numbers", () => {
    const cases: Array<[UserPreferences, string, string]> = [
      [
        { ...DEFAULT_USER_PREFERENCES, dayOrigin: "residence", residenceBuildingCode: "OPH" },
        "Start at home",
        "Return home",
      ],
      [commutePreferences("transit", "miway-utm-bus-station"), "Arrive on campus", "Leave campus"],
      [commutePreferences("parking", "parking-p8"), "Park", "Return to car"],
    ];
    for (const [preferences, startTitle, endTitle] of cases) {
      const stops = createCampusDayRouteStops(classes, preferences, "Fall", "Monday");
      expect(stops).toHaveLength(4);
      expect(campusDayAnchorPresentation(stops[0]!)?.title).toBe(startTitle);
      expect(campusDayAnchorPresentation(stops.at(-1)!)?.title).toBe(endTitle);
      expect(stops.map((stop, index) => classNumberForRouteStop(stops, index))).toEqual([
        null,
        1,
        2,
        null,
      ]);
    }
  });

  test("handles one class, an empty day, and an unconfigured legacy commuter", () => {
    const oneClass = createCampusDayRouteStops(
      [classes[0]!],
      commutePreferences("parking", "parking-p9"),
      "Fall",
      "Monday",
    );
    expect(oneClass.map((stop, index) => classNumberForRouteStop(oneClass, index))).toEqual([
      null,
      1,
      null,
    ]);
    expect(createCampusDayRouteStops([], DEFAULT_USER_PREFERENCES, "Fall", "Monday")).toEqual([]);
    expect(createCampusDayRouteStops(classes, DEFAULT_USER_PREFERENCES, "Fall", "Monday")).toEqual(
      classes,
    );
  });

  test("routes every marked access point over legitimate bundled graph nodes", () => {
    for (const point of CAMPUS_ACCESS_POINTS.filter((candidate) => candidate.routingNodeId)) {
      const preferences = commutePreferences(point.kind as "transit" | "parking", point.id);
      const stops = createCampusDayRouteStops([classes[0]!], preferences, "Fall", "Monday");
      const outbound = planMeetingTransition(
        stops[0]!,
        stops[1]!,
        UTM_ROUTING_GRAPH,
        DEFAULT_ROUTE_PREFERENCES,
      );
      const inbound = planMeetingTransition(
        stops[1]!,
        stops[2]!,
        UTM_ROUTING_GRAPH,
        DEFAULT_ROUTE_PREFERENCES,
      );
      expect(outbound.status).toBe("routed");
      expect(inbound.status).toBe("routed");
      expect(outbound.result?.nodes[0]?.id).toBe(point.routingNodeId);
      expect(inbound.result?.nodes.at(-1)?.id).toBe(point.routingNodeId);
      expect(outbound.displayCoordinates.length).toBeGreaterThan(1);
      expect(isCampusDayAnchorMeeting(stops[0]!)).toBe(true);
      expect(campusAccessPointForMeeting(stops[0]!)?.id).toBe(point.id);
    }
  });

  test("never approximates an unsupported or step-free access connection", () => {
    const stops = createCampusDayRouteStops(
      [classes[0]!],
      commutePreferences("transit", "miway-utm-bus-station"),
      "Fall",
      "Monday",
    );
    const accessNodeId = getCampusAccessPoint("miway-utm-bus-station")?.routingNodeId;
    expect(accessNodeId).toBeTruthy();
    const withoutAccessNode = {
      nodes: UTM_ROUTING_GRAPH.nodes.filter((node) => node.id !== accessNodeId),
      edges: UTM_ROUTING_GRAPH.edges,
    };
    const missing = planMeetingTransition(
      stops[0]!,
      stops[1]!,
      withoutAccessNode,
      DEFAULT_ROUTE_PREFERENCES,
    );
    expect(missing.status).toBe("unavailable");
    expect(missing.displayCoordinates).toEqual([]);
    expect(missing.message).toContain("walking connection is not yet mapped");

    const stepFree = planMeetingTransition(stops[0]!, stops[1]!, UTM_ROUTING_GRAPH, {
      ...DEFAULT_ROUTE_PREFERENCES,
      mode: "step-free",
    });
    expect(stepFree.status).toBe("unavailable");
    expect(stepFree.message).toContain("No verified accessible route");
  });
});

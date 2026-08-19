import { describe, expect, test } from "bun:test";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { assessGapDestination } from "@/features/gaps/destination-feasibility";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { planMeetingTransition, type TransitionPlanner } from "@/features/routing/transition";
import type { TransitionRoute } from "@/features/routing/types";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import type { Gap, Meeting } from "@/lib/timetable-types";

function meeting(overrides: Partial<Meeting>): Meeting {
  return {
    id: "meeting",
    courseCode: "CSC110Y5",
    activityType: "LEC",
    sectionCode: "LEC0101",
    courseName: "Foundations of Computer Science I",
    startTime: 600,
    endTime: 660,
    weekday: "Monday",
    buildingCode: "DV",
    room: "2080",
    term: "Fall",
    locationUnknown: false,
    locationType: "physical",
    ...overrides,
  };
}

function gap(overrides: Partial<Gap> = {}): Gap {
  const previous = meeting({ id: "previous", endTime: 660, buildingCode: "DV" });
  const next = meeting({
    id: "next",
    courseCode: "MAT157Y5",
    startTime: 840,
    endTime: 900,
    buildingCode: "IB",
    room: "245",
  });
  return {
    id: "destination-gap",
    term: "Fall",
    weekday: "Monday",
    startTime: 660,
    endTime: 840,
    durationMinutes: 180,
    previous,
    next,
    ...overrides,
  };
}

const approximateRoute: TransitionRoute = {
  status: "approximate",
  message: "Estimate",
  accuracy: "Approximate building-to-building estimate",
  result: null,
  displayCoordinates: [],
  warnings: ["Estimated"],
  approximateDistanceMeters: 200,
  approximateSeconds: 180,
};

const unavailableRoute: TransitionRoute = {
  status: "unavailable",
  message: "No verified route",
  accuracy: "Location unavailable",
  result: null,
  displayCoordinates: [],
  warnings: ["No fully accessible mapped route could be verified."],
  approximateDistanceMeters: null,
  approximateSeconds: null,
};

const realPlanner: TransitionPlanner = (from, to, preferences) =>
  planMeetingTransition(from, to, UTM_ROUTING_GRAPH, preferences);

describe("gap destination feasibility", () => {
  test("checks both legs with the existing campus router and preserves the protected budget", () => {
    const currentGap = gap();
    const result = assessGapDestination({
      gap: currentGap,
      destinationBuildingCode: "RAWC",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: realPlanner,
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe("feasible");
    expect(result?.outbound.status).not.toBe("unavailable");
    expect(result?.inbound.status).not.toBe("unavailable");
    expect(result?.totalTravelMinutes).toBeGreaterThan(0);
    expect(result?.activityMinutes).toBeGreaterThan(0);
    expect(result?.leaveDestinationByMinutes).toBeLessThan(currentGap.endTime);
    expect(result?.arrivalNextClassMinutes).toBe(currentGap.endTime - (result?.bufferMinutes ?? 0));
    expect(
      (result?.totalTravelMinutes ?? 0) +
        (result?.bufferMinutes ?? 0) +
        (result?.setupMinutes ?? 0) +
        (result?.packUpMinutes ?? 0) +
        (result?.activityMinutes ?? 0),
    ).toBe(currentGap.durationMinutes);
  });

  test("treats either physical same-building leg as zero without claiming room-to-room routing", () => {
    const outboundSameBuilding = assessGapDestination({
      gap: gap(),
      destinationBuildingCode: "DV",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: realPlanner,
    });
    const inboundSameBuilding = assessGapDestination({
      gap: gap(),
      destinationBuildingCode: "IB",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: realPlanner,
    });

    expect(outboundSameBuilding?.outbound.status).toBe("same-building");
    expect(outboundSameBuilding?.outbound.travelMinutes).toBe(0);
    expect(outboundSameBuilding?.outbound.route).toBeNull();
    expect(outboundSameBuilding?.warnings.join(" ")).toContain(
      "not claiming room-to-room indoor travel",
    );
    expect(inboundSameBuilding?.inbound.status).toBe("same-building");
    expect(inboundSameBuilding?.inbound.travelMinutes).toBe(0);
  });

  test("preserves the low-risk buffer policy for approximate return legs", () => {
    const result = assessGapDestination({
      gap: gap(),
      destinationBuildingCode: "RAWC",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: () => approximateRoute,
    });

    expect(result?.status).toBe("feasible");
    expect(result?.outbound.status).toBe("approximate");
    expect(result?.inbound.status).toBe("approximate");
    expect(result?.bufferMinutes).toBe(DEFAULT_USER_PREFERENCES.transitionBufferMinutes + 5);
    expect(result?.confidenceLabel).toBe("medium");
  });

  test("fails closed when either leg is unavailable", () => {
    let calls = 0;
    const planner: TransitionPlanner = () => {
      calls += 1;
      return calls === 1 ? approximateRoute : unavailableRoute;
    };
    const result = assessGapDestination({
      gap: gap(),
      destinationBuildingCode: "RAWC",
      preferences: { ...DEFAULT_USER_PREFERENCES, mode: "step-free" },
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: planner,
    });

    expect(result?.status).toBe("unavailable");
    expect(result?.activityMinutes).toBe(0);
    expect(result?.leaveDestinationByMinutes).toBeNull();
    expect(result?.warnings).toContain("No fully accessible mapped route could be verified.");
  });

  test("does not bypass unknown or online class locations through the same-building shortcut", () => {
    const previous = meeting({
      id: "previous-online",
      buildingCode: "DV",
      room: null,
      locationUnknown: false,
      locationType: "online",
    });
    const result = assessGapDestination({
      gap: gap({ previous }),
      destinationBuildingCode: "DV",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: realPlanner,
    });

    expect(result?.status).toBe("unavailable");
    expect(result?.outbound.status).toBe("unavailable");
  });

  test("marks a destination tight when travel and protected time consume the gap", () => {
    const slowRoute: TransitionRoute = {
      ...approximateRoute,
      message: "Slow estimate",
      approximateDistanceMeters: 1000,
      approximateSeconds: 20 * 60,
    };
    const result = assessGapDestination({
      gap: gap({ durationMinutes: 45, endTime: 705 }),
      destinationBuildingCode: "RAWC",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: () => slowRoute,
    });

    expect(result?.status).toBe("tight");
    expect(result?.activityMinutes).toBe(0);
  });

  test("keeps identity-only canonical destinations visible but unavailable", () => {
    let calls = 0;
    const result = assessGapDestination({
      gap: gap(),
      destinationBuildingCode: "IC",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: () => {
        calls += 1;
        return unavailableRoute;
      },
    });

    expect(result).not.toBeNull();
    expect(result?.destination.code).toBe("IC");
    expect(result?.status).toBe("unavailable");
    expect(result?.outbound.status).toBe("unavailable");
    expect(result?.inbound.status).toBe("unavailable");
    expect(result?.warnings.join(" ")).toContain("mapped routing coverage is unavailable");
    expect(calls).toBe(0);
  });

  test("rejects a non-canonical destination instead of guessing", () => {
    expect(
      assessGapDestination({
        gap: gap(),
        destinationBuildingCode: "ZZZ",
        preferences: DEFAULT_USER_PREFERENCES,
        gapPreferences: DEFAULT_GAP_PREFERENCES,
        planTransition: () => unavailableRoute,
      }),
    ).toBeNull();
  });
});

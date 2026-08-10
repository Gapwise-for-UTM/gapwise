import { describe, expect, test } from "bun:test";
import { assessGap, gapDurationCategory, planGapAssessment } from "@/features/gaps/assess-gap";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { planMeetingTransition } from "@/features/routing/transition";
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
    weekday: "Tuesday",
    buildingCode: "MN",
    room: "1270",
    term: "Fall",
    locationUnknown: false,
    ...overrides,
  };
}

function gap(overrides: Partial<Gap> = {}): Gap {
  const previous = meeting({ id: "previous", startTime: 600, endTime: 660 });
  const next = meeting({
    id: "next",
    courseCode: "MAT157Y5",
    startTime: 780,
    endTime: 840,
    buildingCode: "IB",
    room: "210",
  });
  return {
    id: "gap",
    term: "Fall",
    weekday: "Tuesday",
    startTime: 660,
    endTime: 780,
    durationMinutes: 120,
    previous,
    next,
    ...overrides,
  };
}

const sameRoomRoute: TransitionRoute = {
  status: "same-room",
  message: "Already there",
  accuracy: "Verified indoor + outdoor route",
  result: {
    nodes: [],
    edges: [],
    totalDistanceMeters: 0,
    indoorDistanceMeters: 0,
    outdoorDistanceMeters: 0,
    estimatedSeconds: 0,
    floorChanges: 0,
    warnings: [],
  },
  displayCoordinates: [],
  warnings: [],
  approximateDistanceMeters: 0,
  approximateSeconds: 0,
};

const approximateRoute: TransitionRoute = {
  status: "approximate",
  message: "Estimated",
  accuracy: "Approximate building-to-building estimate",
  result: null,
  displayCoordinates: [],
  warnings: ["Straight-line estimate"],
  approximateDistanceMeters: 500,
  approximateSeconds: 600,
};

const unavailableRoute: TransitionRoute = {
  status: "unavailable",
  message: "Unknown location",
  accuracy: "Location unavailable",
  result: null,
  displayCoordinates: [],
  warnings: [],
  approximateDistanceMeters: null,
  approximateSeconds: null,
};

describe("intelligent gap assessment", () => {
  test.each([
    [24, "very-short"],
    [25, "short"],
    [59, "short"],
    [60, "medium"],
    [119, "medium"],
    [120, "long"],
  ] as const)("classifies %d usable minutes as %s", (minutes, category) => {
    expect(gapDurationCategory(minutes)).toBe(category);
  });

  test("uses approximate route time instead of the generic fallback", () => {
    const assessment = assessGap({
      gap: gap({ durationMinutes: 60, endTime: 720 }),
      route: approximateRoute,
      routePreferences: { ...DEFAULT_USER_PREFERENCES, transitionBufferMinutes: 5 },
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });

    expect(assessment.travelMinutes).toBe(10);
    expect(assessment.fallback).toBe(false);
    expect(assessment.primary.activityMinutes).toBe(33);
    expect(assessment.confidenceLabel).toBe("medium");
  });

  test("marks short gaps as location-dependent when a class location is unknown", () => {
    const unknownPrevious = meeting({
      id: "online",
      buildingCode: null,
      room: null,
      locationUnknown: true,
    });
    const assessment = assessGap({
      gap: gap({
        durationMinutes: 60,
        endTime: 720,
        previous: unknownPrevious,
      }),
      route: unavailableRoute,
      routePreferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });

    expect(assessment.primary.action).toBe("location-dependent");
    expect(assessment.confidenceLabel).toBe("low");
  });

  test("recognizes a lunch-time meal opportunity", () => {
    const assessment = assessGap({
      gap: gap({ startTime: 12 * 60, endTime: 13 * 60 + 30, durationMinutes: 90 }),
      route: sameRoomRoute,
      routePreferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });

    expect(
      [assessment.primary, ...assessment.alternatives].some(
        (candidate) => candidate.action === "meal-window",
      ),
    ).toBe(true);
  });

  test("recommends going home only when the configured round trip is worthwhile", () => {
    const assessment = assessGap({
      gap: gap({ startTime: 13 * 60, endTime: 19 * 60, durationMinutes: 360 }),
      route: sameRoomRoute,
      routePreferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: {
        ...DEFAULT_GAP_PREFERENCES,
        willingToLeaveCampus: true,
        oneWayHomeCommuteMinutes: 45,
        minimumHomeStayMinutes: 90,
      },
    });

    expect(assessment.primary.action).toBe("leave-campus-candidate");
    expect(assessment.primary.activityMinutes).toBe(255);
  });

  test("uses real campus paths for a residence round trip", () => {
    const result = planGapAssessment(
      gap({ startTime: 13 * 60, endTime: 19 * 60, durationMinutes: 360 }),
      {
        ...DEFAULT_USER_PREFERENCES,
        dayOrigin: "residence",
        residenceBuildingCode: "OPH",
      },
      { ...DEFAULT_GAP_PREFERENCES, minimumHomeStayMinutes: 90 },
      (from, to, preferences) => planMeetingTransition(from, to, UTM_ROUTING_GRAPH, preferences),
    );

    expect(result.assessment.primary.action).toBe("go-home");
    expect(result.assessment.primary.summary).toContain("Oscar Peterson Hall");
    expect(result.assessment.primary.reasons.join(" ")).toContain("Walk home:");
    expect(result.assessment.primary.timeline.map((segment) => segment.label)).toEqual([
      "Walk home",
      "Get settled",
      "Time at home",
      "Walk to class",
      "Buffer",
    ]);

    const short = planGapAssessment(
      gap({ startTime: 13 * 60, endTime: 14 * 60, durationMinutes: 60 }),
      {
        ...DEFAULT_USER_PREFERENCES,
        dayOrigin: "residence",
        residenceBuildingCode: "OPH",
      },
      { ...DEFAULT_GAP_PREFERENCES, minimumHomeStayMinutes: 90 },
      (from, to, preferences) => planMeetingTransition(from, to, UTM_ROUTING_GRAPH, preferences),
    );
    expect(
      [short.assessment.primary, ...short.assessment.alternatives].some(
        (candidate) => candidate.action === "go-home",
      ),
    ).toBe(false);
  });

  test("shares one transition result between Today and Gap Plan consumers", () => {
    let calls = 0;
    const planner = () => {
      calls += 1;
      return approximateRoute;
    };
    const result = planGapAssessment(
      gap(),
      DEFAULT_USER_PREFERENCES,
      DEFAULT_GAP_PREFERENCES,
      planner,
    );

    expect(calls).toBe(1);
    expect(result.route).toBe(approximateRoute);
    expect(result.assessment.travelMinutes).toBe(10);
  });
});

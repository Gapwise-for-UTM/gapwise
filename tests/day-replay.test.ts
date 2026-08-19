import { describe, expect, test } from "bun:test";
import {
  buildDayReplaySegments,
  buildDayReplaySnapshot,
  dayReplayBounds,
  dayReplayMeetings,
} from "@/features/replay/day-replay";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { Meeting } from "@/lib/timetable-types";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";

function meeting(
  id: string,
  weekday: Meeting["weekday"],
  startTime: number,
  endTime: number,
  buildingCode: string,
): Meeting {
  return {
    id,
    courseCode: id.toUpperCase(),
    activityType: "LEC",
    sectionCode: "LEC0101",
    courseName: `Course ${id}`,
    startTime,
    endTime,
    weekday,
    buildingCode,
    room: "1000",
    term: "Fall",
    locationUnknown: false,
    locationType: "physical",
  };
}

const planner: TransitionPlanner = (from, to) => ({
  status: "approximate",
  message: `${from.buildingCode} to ${to.buildingCode}`,
  accuracy: "Approximate building-to-building estimate",
  result: null,
  displayCoordinates: [],
  warnings: ["Test estimate"],
  approximateDistanceMeters: 100,
  approximateSeconds: 120,
});

const monday = [
  meeting("csc", "Monday", 540, 600, "MN"),
  meeting("mat", "Monday", 660, 720, "IB"),
  meeting("wri", "Monday", 780, 840, "DH"),
];

describe("Day Replay domain", () => {
  test("filters and orders a selected term and weekday", () => {
    const mixed = [
      meeting("late", "Monday", 780, 840, "DH"),
      meeting("tue", "Tuesday", 540, 600, "MN"),
      meeting("early", "Monday", 540, 600, "MN"),
      { ...meeting("winter", "Monday", 600, 660, "IB"), term: "Winter" as const },
    ];

    expect(dayReplayMeetings(mixed, "Fall", "Monday").map((item) => item.id)).toEqual([
      "early",
      "late",
    ]);
  });

  test("adds a small visual lead-in and wind-down around the day", () => {
    expect(dayReplayBounds(monday)).toEqual({ startMinute: 510, endMinute: 870 });
    expect(dayReplayBounds([])).toBeNull();
  });

  test("builds deterministic transition segments between consecutive classes", () => {
    const segments = buildDayReplaySegments(monday, DEFAULT_USER_PREFERENCES, planner);
    expect(segments.map((segment) => segment.id)).toEqual(["csc--mat", "mat--wri"]);
    expect(segments[0]?.route.status).toBe("approximate");
  });

  test("does not invent transition segments between overlapping classes", () => {
    const overlapping = [
      meeting("first", "Monday", 540, 660, "MN"),
      meeting("overlap", "Monday", 600, 720, "IB"),
      meeting("later", "Monday", 780, 840, "DH"),
    ];
    let planned = 0;
    const countingPlanner: TransitionPlanner = (from, to, preferences) => {
      planned += 1;
      return planner(from, to, preferences);
    };

    const segments = buildDayReplaySegments(overlapping, DEFAULT_USER_PREFERENCES, countingPlanner);

    expect(segments.map((segment) => segment.id)).toEqual(["overlap--later"]);
    expect(planned).toBe(1);
  });

  test("tracks class, gap, and completed phases as simulated time advances", () => {
    const segments = buildDayReplaySegments(monday, DEFAULT_USER_PREFERENCES, planner);

    const inClass = buildDayReplaySnapshot(monday, segments, 570);
    expect(inClass.phase).toBe("class");
    expect(inClass.current?.id).toBe("csc");
    expect(inClass.visibleSegmentIds).toEqual([]);

    const firstGap = buildDayReplaySnapshot(monday, segments, 630);
    expect(firstGap.phase).toBe("gap");
    expect(firstGap.gap?.durationMinutes).toBe(60);
    expect(firstGap.gap?.previous.id).toBe("csc");
    expect(firstGap.gap?.next.id).toBe("mat");
    expect(firstGap.selectedSegmentId).toBe("csc--mat");
    expect(firstGap.visibleSegmentIds).toEqual(["csc--mat"]);

    const secondGap = buildDayReplaySnapshot(monday, segments, 750);
    expect(secondGap.visibleSegmentIds).toEqual(["csc--mat", "mat--wri"]);

    const done = buildDayReplaySnapshot(monday, segments, 850);
    expect(done.phase).toBe("after");
    expect(done.next).toBeNull();
  });
});

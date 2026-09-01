import { describe, expect, test } from "bun:test";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { TransitionRoute } from "@/features/routing/types";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import {
  createTimetableHeatmapData,
  renderTimetableHeatmapSvg,
  timetableHeatmapFilename,
} from "@/lib/timetable-heatmap-export";
import type { Meeting } from "@/lib/timetable-types";

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
    buildingCode: "MN",
    room: "ROOM-ALPHA",
    term: "Fall",
    locationUnknown: false,
    ...overrides,
  };
}

const routed: TransitionRoute = {
  status: "routed",
  message: "Mapped route",
  accuracy: "Mapped campus path, indoor estimate",
  result: null,
  displayCoordinates: [
    [-79.6656, 43.5506],
    [-79.6648, 43.5511],
    [-79.6639, 43.5517],
  ],
  warnings: [],
  approximateDistanceMeters: 180,
  approximateSeconds: 150,
};

const planner: TransitionPlanner = () => routed;

const schedule: Meeting[] = [
  meeting({ id: "mon-mn", courseCode: "PRIVATE101", weekday: "Monday", buildingCode: "MN" }),
  meeting({
    id: "mon-ib",
    courseCode: "SECRET202",
    weekday: "Monday",
    startTime: 720,
    endTime: 780,
    buildingCode: "IB",
    room: "ROOM-BETA",
  }),
  meeting({ id: "tue-mn-a", courseCode: "HIDDEN303", weekday: "Tuesday", buildingCode: "MN" }),
  meeting({
    id: "tue-mn-b",
    courseCode: "HIDDEN404",
    weekday: "Tuesday",
    startTime: 720,
    endTime: 780,
    buildingCode: "MN",
    room: "ROOM-GAMMA",
  }),
];

describe("timetable heatmap export", () => {
  test("aggregates weekly building visits and routes for the selected term", () => {
    const data = createTimetableHeatmapData({
      meetings: schedule,
      selection: "Fall",
      preferences: DEFAULT_USER_PREFERENCES,
      planTransition: planner,
    });

    expect(data.totalStops).toBe(4);
    expect(data.uniqueBuildings).toBe(2);
    expect(data.maxVisits).toBe(3);
    expect(data.visits).toEqual([
      { buildingCode: "MN", count: 3 },
      { buildingCode: "IB", count: 1 },
    ]);
    expect(data.routes).toHaveLength(2);
  });

  test("renders a text-free campus map without schedule identifiers", () => {
    const data = createTimetableHeatmapData({
      meetings: schedule,
      selection: "Fall",
      preferences: DEFAULT_USER_PREFERENCES,
      planTransition: planner,
    });
    const svg = renderTimetableHeatmapSvg(data);

    expect(svg).toContain('viewBox="0 0 1080 1350"');
    expect(svg).toContain("<path");
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("My timetable heatmap");
    expect(svg).not.toContain("MN");
    expect(svg).not.toContain("IB");
    expect(svg).not.toContain("PRIVATE101");
    expect(svg).not.toContain("SECRET202");
    expect(svg).not.toContain("ROOM-ALPHA");
    expect(svg).not.toContain("ROOM-GAMMA");
  });

  test("uses a stable term-specific PNG filename", () => {
    expect(timetableHeatmapFilename("Fall")).toBe("fall-utm-timetable-heatmap.png");
    expect(timetableHeatmapFilename("all")).toBe("all-terms-utm-timetable-heatmap.png");
  });

  test("combines available terms without connecting routes across terms", () => {
    const data = createTimetableHeatmapData({
      meetings: [
        ...schedule,
        meeting({ id: "winter-mn", term: "Winter", buildingCode: "MN" }),
        meeting({
          id: "winter-ib",
          term: "Winter",
          buildingCode: "IB",
          startTime: 720,
          endTime: 780,
        }),
      ],
      selection: "all",
      preferences: DEFAULT_USER_PREFERENCES,
      planTransition: planner,
    });

    expect(data.totalStops).toBe(6);
    expect(data.visits).toEqual([
      { buildingCode: "MN", count: 4 },
      { buildingCode: "IB", count: 2 },
    ]);
    expect(data.routes).toHaveLength(3);
    expect(renderTimetableHeatmapSvg(data)).not.toContain("<text");
  });
});

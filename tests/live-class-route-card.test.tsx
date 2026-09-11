import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveClassRouteCard } from "@/components/LiveClassRouteCard";
import type { Meeting } from "@/lib/timetable-types";

const meeting: Meeting = {
  id: "mat157",
  courseCode: "MAT157H5",
  courseName: "Analysis I",
  activityType: "LEC",
  sectionCode: "LEC0101",
  startTime: 13 * 60,
  endTime: 15 * 60,
  weekday: "Friday",
  buildingCode: "IB",
  room: "240",
  term: "Fall",
  locationUnknown: false,
};

const preferences = {
  mode: "fastest" as const,
  walkingSpeedMps: 1.4,
  transitionBufferMinutes: 5,
};

const route = {
  status: "routed" as const,
  message: "Route calculated.",
  accuracy: "Mapped campus path, indoor estimate" as const,
  result: {
    nodes: [],
    edges: [],
    totalDistanceMeters: 420,
    indoorDistanceMeters: 0,
    outdoorDistanceMeters: 420,
    estimatedSeconds: 10 * 60,
    floorChanges: 0,
    warnings: [],
    coordinates: [],
  },
  displayCoordinates: [],
  warnings: ["Continue inside to room 240; indoor room paths are not mapped."],
  approximateDistanceMeters: null,
  approximateSeconds: null,
};

describe("live class route card", () => {
  test("shows a prominent leave-now state and preserves room destination text", () => {
    const html = renderToStaticMarkup(
      <LiveClassRouteCard
        meeting={meeting}
        origin={{
          kind: "live",
          point: { longitude: -79.66475, latitude: 43.55105, accuracyMeters: 10 },
        }}
        route={route}
        fallbackRoute={null}
        preferences={preferences}
        now={new Date(2026, 8, 11, 12, 50)}
      />,
    );
    expect(html).toContain("Leave now");
    expect(html).toContain("IB 240");
    expect(html).toContain("420 m");
    expect(html).toContain("indoor room paths are not mapped");
  });

  test("explains denied-location fallback without blocking existing routing", () => {
    const html = renderToStaticMarkup(
      <LiveClassRouteCard
        meeting={meeting}
        origin={{ kind: "fallback", reason: "permission-denied" }}
        route={null}
        fallbackRoute={route}
        preferences={preferences}
        now={new Date(2026, 8, 11, 12, 30)}
      />,
    );
    expect(html).toContain("Live origin unavailable");
    expect(html).toContain("Location permission was denied");
    expect(html).toContain("Existing between-class or campus-arrival routing remains available");
  });
});

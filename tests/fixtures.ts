import type { Meeting } from "@/lib/timetable-types";
import type { RoutingEdge, RoutingNode } from "@/features/routing/types";

export function meeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: "Fall-CSC108-LEC-0101-Monday-540",
    courseCode: "CSC108H5",
    activityType: "LEC",
    sectionCode: "0101",
    courseName: "Introduction to Computer Programming",
    startTime: 540,
    endTime: 600,
    weekday: "Monday",
    buildingCode: "MN",
    room: "1270",
    term: "Fall",
    locationUnknown: false,
    ...overrides,
  };
}

export function node(id: string, overrides: Partial<RoutingNode> = {}): RoutingNode {
  return {
    id,
    kind: "path-intersection",
    buildingCode: null,
    floor: null,
    accessibility: "unknown",
    ...overrides,
  };
}

export function edge(
  id: string,
  from: string,
  to: string,
  distanceMeters: number,
  overrides: Partial<RoutingEdge> = {},
): RoutingEdge {
  return {
    id,
    from,
    to,
    distanceMeters,
    environment: "outdoor",
    accessibility: "accessible",
    stairs: false,
    bidirectional: true,
    ...overrides,
  };
}

import { describe, expect, test } from "bun:test";
import {
  getCampusLocationDisplay,
  getLocationPresentation,
} from "@/features/routing/location-presentation";
import { resolveAcornLocation } from "@/features/routing/location-resolver";
import type { TransitionRoute } from "@/features/routing/types";
import type { Meeting, MeetingLocationType } from "@/lib/timetable-types";
import { meeting } from "./fixtures";

const unavailableRoute: TransitionRoute = {
  status: "unavailable",
  message: "A physical route cannot be generated for this location.",
  accuracy: "Location unavailable",
  result: null,
  displayCoordinates: [],
  warnings: [],
  approximateDistanceMeters: null,
  approximateSeconds: null,
};

function meetingFromRawLocation(raw: string): Meeting {
  const resolution = resolveAcornLocation(raw);
  return meeting({
    buildingCode: resolution.buildingCode,
    room: resolution.room,
    locationUnknown: resolution.status !== "known",
    locationType: (resolution.status === "known"
      ? "physical"
      : resolution.status) as MeetingLocationType,
  });
}

describe("location presentation", () => {
  test("expands a recognized location into building, floor, and room display parts", () => {
    expect(getCampusLocationDisplay(meeting({ buildingCode: "DH", room: "2060" }))).toEqual({
      buildingName: "Deerfield Hall",
      compactLabel: "Deerfield Hall · 2060",
      floorLabel: "2nd floor",
      roomLabel: "Room 2060",
      fullLabel: "Deerfield Hall, 2nd floor, Room 2060",
    });
  });

  test("applies conservative room-number floor inference across recognized buildings", () => {
    expect(getCampusLocationDisplay(meeting({ buildingCode: "CCT", room: "2060" }))).toMatchObject({
      buildingName: "Communication, Culture and Technology Building",
      floorLabel: "2nd floor",
      roomLabel: "Room 2060",
    });
    expect(getCampusLocationDisplay(meeting({ buildingCode: "KN", room: "L1206" }))).toMatchObject({
      floorLabel: "Lower level",
      roomLabel: "Room L1206",
    });
    expect(getCampusLocationDisplay(meeting({ buildingCode: "DV", room: "0116" }))).toMatchObject({
      floorLabel: "Level 0",
      roomLabel: "Room 0116",
    });
  });

  test.each(["", "ZZ TBA"])("maps unassigned ACORN location %j to the shared TBA state", (raw) => {
    const unresolved = meetingFromRawLocation(raw);
    const meetingState = getLocationPresentation({ meeting: unresolved });
    const routeState = getLocationPresentation({
      from: meeting(),
      to: unresolved,
      route: unavailableRoute,
    });

    expect(meetingState).toMatchObject({
      status: "tba",
      label: "Location TBA",
      detail: "The physical location is still TBA.",
    });
    expect(routeState).toMatchObject({
      status: "tba",
      label: meetingState.label,
      detail: meetingState.detail,
    });
    expect(routeState.icon).toBe(meetingState.icon);
  });

  test("maps resolved, approximate, and unmapped routes using existing statuses", () => {
    expect(getLocationPresentation({ meeting: meeting() })).toMatchObject({
      status: "known",
      label: "MN 1270",
    });
    expect(
      getLocationPresentation({
        from: meeting(),
        to: meeting({ id: "next", buildingCode: "IB", room: "340" }),
        route: { ...unavailableRoute, status: "approximate" },
      }),
    ).toMatchObject({ status: "approximate", label: "Approximate route" });
    expect(
      getLocationPresentation({
        from: meeting(),
        to: meeting({ id: "next", room: null }),
        route: unavailableRoute,
      }),
    ).toMatchObject({ status: "unavailable", label: "Route not yet mapped" });
  });

  test("maps the remaining existing location and route statuses", () => {
    expect(
      getLocationPresentation({
        meeting: meeting({ locationType: "online", buildingCode: null, room: null }),
      }),
    ).toMatchObject({ status: "online", label: "Online class" });
    expect(
      getLocationPresentation({
        meeting: meeting({
          locationType: "unknown",
          locationUnknown: true,
          buildingCode: "XY",
          room: "101",
        }),
      }),
    ).toMatchObject({ status: "unknown", label: "Location unavailable" });
    expect(
      getLocationPresentation({
        from: meeting(),
        to: meeting({ id: "next", room: "1290" }),
        route: { ...unavailableRoute, status: "routed" },
      }),
    ).toMatchObject({ status: "known", label: "Route available" });
    expect(
      getLocationPresentation({
        from: meeting(),
        to: meeting({ id: "next" }),
        route: { ...unavailableRoute, status: "same-room" },
      }),
    ).toMatchObject({ status: "known", label: "Same room" });
  });
});

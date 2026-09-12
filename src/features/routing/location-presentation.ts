import {
  CircleHelp,
  MapPin,
  Monitor,
  Route as RouteIcon,
  RouteOff,
  type LucideIcon,
} from "lucide-react";
import { getRecognizedBuilding } from "@/data/utm/building-registry";
import { locationLabel, meetingLocationType, type Meeting } from "@/lib/timetable-types";
import { campusAccessPointForMeeting } from "./campus-day";
import { resolveMeetingLocation, type LocationStatus } from "./location-resolver";
import type { TransitionRoute } from "./types";

export type LocationPresentationStatus = LocationStatus | Extract<TransitionRoute["status"], "approximate" | "unavailable">;

export type LocationPresentation = {
  status: LocationPresentationStatus;
  label: string;
  detail: string;
  icon: LucideIcon;
};

export type CampusLocationDisplay = {
  buildingName: string;
  compactLabel: string;
  floorLabel: string | null;
  roomLabel: string | null;
  fullLabel: string;
};

function ordinalFloor(value: string): string {
  if (value === "G") return "Ground floor";
  if (value === "L" || value === "LL") return "Lower level";
  if (value === "0") return "Level 0";

  const floor = Number(value);
  if (!Number.isInteger(floor)) return `Floor ${value}`;
  const mod100 = floor % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : floor % 10 === 1
        ? "st"
        : floor % 10 === 2
          ? "nd"
          : floor % 10 === 3
            ? "rd"
            : "th";
  return `${floor}${suffix} floor`;
}

export function getCampusLocationDisplay(meeting: Meeting): CampusLocationDisplay | null {
  const resolution = resolveMeetingLocation(meeting);
  if (resolution.status !== "known") return null;

  const building = resolution.buildingCode ? getRecognizedBuilding(resolution.buildingCode) : null;
  const buildingName =
    building?.name ?? resolution.buildingName ?? resolution.buildingCode ?? "Campus";
  const room = resolution.room?.trim() || null;
  const floorLabel = resolution.floor ? ordinalFloor(resolution.floor) : null;
  const roomLabel = room ? `Room ${room}` : null;

  return {
    buildingName,
    compactLabel: [buildingName, room].filter(Boolean).join(" · "),
    floorLabel,
    roomLabel,
    fullLabel: [buildingName, floorLabel, roomLabel].filter(Boolean).join(", "),
  };
}

type LocationPresentationInput = { meeting: Meeting } | { from: Meeting; to: Meeting; route: TransitionRoute };

const UNRESOLVED_PRESENTATIONS: Record<Exclude<LocationStatus, "known">, LocationPresentation> = {
  tba: {
    status: "tba",
    label: "Location TBA",
    detail: "Location to be announced.",
    icon: CircleHelp,
  },
  unknown: {
    status: "unknown",
    label: "Location",
    detail: "Location unavailable.",
    icon: CircleHelp,
  },
  online: {
    status: "online",
    label: "Online",
    detail: "Online class.",
    icon: Monitor,
  },
};

function meetingPresentation(meeting: Meeting): LocationPresentation {
  const accessPoint = campusAccessPointForMeeting(meeting);
  if (accessPoint) {
    return {
      status: "known",
      label: accessPoint.label,
      detail: "Campus stop.",
      icon: MapPin,
    };
  }

  // Timetable presentation follows the ACORN source, not UTM map coverage. This
  // keeps a real St. George or Scarborough room visible even though Gapwise has
  // no route graph for that campus.
  if (meetingLocationType(meeting) === "physical") {
    return {
      status: "known",
      label: locationLabel(meeting),
      detail: meeting.campus === "UTM" ? "Campus location." : "Class location.",
      icon: MapPin,
    };
  }

  const resolution = resolveMeetingLocation(meeting);
  if (resolution.status !== "known") return UNRESOLVED_PRESENTATIONS[resolution.status];

  return {
    status: "known",
    label:
      [resolution.buildingCode, resolution.room].filter(Boolean).join(" ") || "Campus location",
    detail: "Campus location.",
    icon: MapPin,
  };
}

export function getLocationPresentation(input: LocationPresentationInput): LocationPresentation {
  if ("meeting" in input) return meetingPresentation(input.meeting);

  const endpointStatuses = [
    campusAccessPointForMeeting(input.from) ? "known" : resolveMeetingLocation(input.from).status,
    campusAccessPointForMeeting(input.to) ? "known" : resolveMeetingLocation(input.to).status,
  ];
  for (const status of ["tba", "unknown", "online"] as const) {
    if (endpointStatuses.includes(status)) return UNRESOLVED_PRESENTATIONS[status];
  }

  switch (input.route.status) {
    case "same-room":
      return {
        status: "known",
        label: "Same room",
        detail: "No walk needed.",
        icon: MapPin,
      };
    case "routed":
      return {
        status: "known",
        label: "Route",
        detail: "Campus walking route.",
        icon: RouteIcon,
      };
    case "approximate":
      return {
        status: "approximate",
        label: "Route",
        detail: "Campus walking route.",
        icon: RouteIcon,
      };
    case "unavailable":
      return {
        status: "unavailable",
        label: "Campus map",
        detail: "Open the map to continue.",
        icon: RouteOff,
      };
  }
}

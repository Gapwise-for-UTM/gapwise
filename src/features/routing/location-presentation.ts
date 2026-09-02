import {
  CircleHelp,
  MapPin,
  Monitor,
  Route as RouteIcon,
  RouteOff,
  type LucideIcon,
} from "lucide-react";
import { getRecognizedBuilding } from "@/data/utm/building-registry";
import type { Meeting } from "@/lib/timetable-types";
import { campusAccessPointForMeeting } from "./campus-day";
import { resolveMeetingLocation, type LocationStatus } from "./location-resolver";
import type { TransitionRoute } from "./types";

export type LocationPresentationStatus =
  LocationStatus | Extract<TransitionRoute["status"], "approximate" | "unavailable">;

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

/**
 * Turns parsed ACORN location fields into UI-ready parts. Floor text is sourced
 * from the resolver, which only returns verified floors or conservative
 * room-number inferences for recognized buildings.
 */
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

type LocationPresentationInput =
  { meeting: Meeting } | { from: Meeting; to: Meeting; route: TransitionRoute };

const UNRESOLVED_PRESENTATIONS: Record<Exclude<LocationStatus, "known">, LocationPresentation> = {
  tba: {
    status: "tba",
    label: "Location TBA",
    detail: "The physical location is still TBA.",
    icon: CircleHelp,
  },
  unknown: {
    status: "unknown",
    label: "Location unavailable",
    detail: "This class location could not be resolved.",
    icon: CircleHelp,
  },
  online: {
    status: "online",
    label: "Online class",
    detail: "This class is online, so no campus route is needed.",
    icon: Monitor,
  },
};

function meetingPresentation(meeting: Meeting): LocationPresentation {
  const accessPoint = campusAccessPointForMeeting(meeting);
  if (accessPoint) {
    return {
      status: "known",
      label: accessPoint.label,
      detail: "Verified campus arrival point.",
      icon: MapPin,
    };
  }
  const resolution = resolveMeetingLocation(meeting);
  if (resolution.status !== "known") return UNRESOLVED_PRESENTATIONS[resolution.status];

  return {
    status: "known",
    label:
      [resolution.buildingCode, resolution.room].filter(Boolean).join(" ") ||
      "Location unavailable",
    detail: "Campus location resolved.",
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
        detail: "No walk is needed between these classes.",
        icon: MapPin,
      };
    case "routed":
      return {
        status: "known",
        label: "Route available",
        detail: input.route.accuracy,
        icon: RouteIcon,
      };
    case "approximate":
      return {
        status: "approximate",
        label: "Approximate route",
        detail: "Timing is approximate because a verified path is not mapped.",
        icon: RouteIcon,
      };
    case "unavailable":
      return {
        status: "unavailable",
        label: "Route not yet mapped",
        detail: "A verified route is not available yet.",
        icon: RouteOff,
      };
  }
}

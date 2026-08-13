import {
  CircleHelp,
  MapPin,
  Monitor,
  Route as RouteIcon,
  RouteOff,
  type LucideIcon,
} from "lucide-react";
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

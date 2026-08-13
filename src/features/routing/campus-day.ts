import {
  getCampusAccessPoint,
  type CampusAccessKind,
  type CampusAccessPoint,
} from "@/data/utm/campus-access-points";
import { getResidenceBuilding } from "@/data/utm/campus";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";
import { createResidenceMeeting, isResidenceMeeting } from "./residence";

const ACCESS_MEETING_PREFIX = "gapwise-campus-access:";

export type CampusDayAnchor = {
  kind: "residence" | CampusAccessKind;
  label: string;
  shortLabel: string;
  coordinates: [number, number];
  buildingCode: string | null;
  accessPoint: CampusAccessPoint | null;
};

export type CampusDayAnchorPosition = "start" | "end";

export type CampusDayAnchorPresentation = {
  kind: CampusDayAnchor["kind"];
  label: string;
  title: string;
  segmentLabel: string;
};

export function selectedCampusDayAnchor(preferences: UserPreferences): CampusDayAnchor | null {
  if (preferences.dayOrigin === "residence") {
    const residence = getResidenceBuilding(preferences.residenceBuildingCode);
    return residence
      ? {
          kind: "residence",
          label: residence.name,
          shortLabel: residence.code,
          coordinates: residence.navigationPoint,
          buildingCode: residence.code,
          accessPoint: null,
        }
      : null;
  }

  const point = getCampusAccessPoint(preferences.campusAccessPointId);
  if (!preferences.commuteMode || point?.kind !== preferences.commuteMode) return null;
  return {
    kind: point.kind,
    label: point.label,
    shortLabel: point.label,
    coordinates: point.coordinates,
    buildingCode: null,
    accessPoint: point,
  };
}

export function createCampusAccessMeeting({
  point,
  term,
  weekday,
  time,
  position,
}: {
  point: CampusAccessPoint;
  term: Term;
  weekday: Weekday;
  time: number;
  position: CampusDayAnchorPosition;
}): Meeting {
  return {
    id: `${ACCESS_MEETING_PREFIX}${position}:${point.id}:${term}:${weekday}:${time}`,
    courseCode: point.label,
    activityType: "OTHER",
    sectionCode: position,
    courseName: "Campus arrival point",
    startTime: time,
    endTime: time,
    weekday,
    buildingCode: null,
    room: null,
    term,
    locationUnknown: false,
    locationType: "physical",
  };
}

export function campusAccessPointForMeeting(meeting: Meeting): CampusAccessPoint | null {
  if (!meeting.id.startsWith(ACCESS_MEETING_PREFIX)) return null;
  const pointId = meeting.id.slice(ACCESS_MEETING_PREFIX.length).split(":")[1] ?? null;
  return getCampusAccessPoint(pointId);
}

export function isCampusAccessMeeting(meeting: Meeting): boolean {
  return meeting.id.startsWith(ACCESS_MEETING_PREFIX);
}

export function isCampusDayAnchorMeeting(meeting: Meeting): boolean {
  return isResidenceMeeting(meeting) || isCampusAccessMeeting(meeting);
}

export function campusDayAnchorPosition(meeting: Meeting): CampusDayAnchorPosition | null {
  if (isResidenceMeeting(meeting)) {
    if (meeting.sectionCode === "start" || meeting.sectionCode === "end") {
      return meeting.sectionCode;
    }
    return null;
  }
  if (!isCampusAccessMeeting(meeting)) return null;
  const position = meeting.id.slice(ACCESS_MEETING_PREFIX.length).split(":")[0];
  return position === "start" || position === "end" ? position : null;
}

export function campusDayAnchorPresentation(meeting: Meeting): CampusDayAnchorPresentation | null {
  const position = campusDayAnchorPosition(meeting);
  if (!position) return null;
  if (isResidenceMeeting(meeting)) {
    const residence = getResidenceBuilding(meeting.buildingCode);
    if (!residence) return null;
    return {
      kind: "residence",
      label: residence.name,
      title: position === "start" ? "Start at home" : "Return home",
      segmentLabel: position === "start" ? "Walk from home" : "Walk home",
    };
  }
  const point = campusAccessPointForMeeting(meeting);
  if (!point) return null;
  const copy = {
    transit: {
      start: ["Arrive on campus", "Walk from transit"],
      end: ["Leave campus", "Walk to transit"],
    },
    parking: {
      start: ["Park", "Walk from parking"],
      end: ["Return to car", "Walk to parking"],
    },
    pickup: {
      start: ["Drop-off", "Walk from drop-off"],
      end: ["Pick-up", "Walk to pick-up"],
    },
  } as const;
  const [title, segmentLabel] = copy[point.kind][position];
  return { kind: point.kind, label: point.label, title, segmentLabel };
}

function anchorMeeting({
  anchor,
  term,
  weekday,
  time,
  position,
}: {
  anchor: CampusDayAnchor;
  term: Term;
  weekday: Weekday;
  time: number;
  position: CampusDayAnchorPosition;
}): Meeting {
  if (anchor.accessPoint) {
    return createCampusAccessMeeting({ point: anchor.accessPoint, term, weekday, time, position });
  }
  return createResidenceMeeting({
    buildingCode: anchor.buildingCode!,
    term,
    weekday,
    time,
    position,
  });
}

export function createCampusDayRouteStops(
  dayMeetings: readonly Meeting[],
  preferences: UserPreferences,
  term: Term,
  weekday: Weekday,
): Meeting[] {
  if (dayMeetings.length === 0) return [];
  const anchor = selectedCampusDayAnchor(preferences);
  if (!anchor) return [...dayMeetings];
  const first = dayMeetings[0]!;
  const last = dayMeetings.at(-1)!;
  return [
    anchorMeeting({ anchor, term, weekday, time: first.startTime, position: "start" }),
    ...dayMeetings,
    anchorMeeting({ anchor, term, weekday, time: last.endTime, position: "end" }),
  ];
}

export function classNumberForRouteStop(routeStops: readonly Meeting[], index: number) {
  if (isCampusDayAnchorMeeting(routeStops[index]!)) return null;
  return routeStops.slice(0, index + 1).filter((meeting) => !isCampusDayAnchorMeeting(meeting))
    .length;
}

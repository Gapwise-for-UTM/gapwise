import { getResidenceBuilding } from "@/data/utm/campus";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";

const HOME_MEETING_PREFIX = "gapwise-home:";

export function selectedResidence(preferences: UserPreferences) {
  if (preferences.dayOrigin !== "residence") return null;
  return getResidenceBuilding(preferences.residenceBuildingCode);
}

export function createResidenceMeeting({
  buildingCode,
  term,
  weekday,
  time,
  position,
}: {
  buildingCode: string;
  term: Term;
  weekday: Weekday;
  time: number;
  position: "start" | "end" | "gap";
}): Meeting {
  return {
    id: `${HOME_MEETING_PREFIX}${position}:${term}:${weekday}:${buildingCode}:${time}`,
    courseCode: "Home",
    activityType: "OTHER",
    sectionCode: position,
    courseName: "Campus residence",
    startTime: time,
    endTime: time,
    weekday,
    buildingCode,
    room: null,
    term,
    locationUnknown: false,
    locationType: "physical",
  };
}

export function isResidenceMeeting(meeting: Meeting): boolean {
  return meeting.id.startsWith(HOME_MEETING_PREFIX);
}

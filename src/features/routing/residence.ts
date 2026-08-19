import { UTM_BUILDINGS } from "../../data/utm/building-registry.js";
import type { UserPreferences } from "../sync/preferences.js";
import type { Meeting, Term, Weekday } from "../../lib/timetable-types.js";

const HOME_MEETING_PREFIX = "gapwise-home:";

export function selectedResidence(preferences: UserPreferences) {
  if (preferences.dayOrigin !== "residence") return null;
  const code = preferences.residenceBuildingCode;
  if (!code) return null;
  return UTM_BUILDINGS.find((building) => building.category === "residence" && building.code === code) ?? null;
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

import type { ActivityType, Meeting, Term, Weekday } from "@/lib/timetable-types";
import { WEEKDAYS } from "@/lib/timetable-types";

const ACTIVITY_TYPES: ActivityType[] = ["LEC", "TUT", "PRA", "OTHER"];
const TERMS: Term[] = ["Fall", "Winter"];
const deserializationCache = new WeakMap<object, Meeting[]>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deserializeMeeting(value: unknown): Meeting | null {
  if (!isRecord(value)) return null;
  const id = value["id"];
  const courseCode = value["courseCode"];
  const activityType = value["activityType"] as ActivityType;
  const sectionCode = value["sectionCode"];
  const courseName = value["courseName"];
  const startTime = value["startTime"];
  const endTime = value["endTime"];
  const weekday = value["weekday"] as Weekday;
  const buildingCode = value["buildingCode"];
  const room = value["room"];
  const term = value["term"] as Term;
  const locationUnknown = value["locationUnknown"];
  if (
    typeof id !== "string" ||
    typeof courseCode !== "string" ||
    !ACTIVITY_TYPES.includes(activityType) ||
    typeof sectionCode !== "string" ||
    typeof courseName !== "string" ||
    typeof startTime !== "number" ||
    typeof endTime !== "number" ||
    !WEEKDAYS.includes(weekday) ||
    !TERMS.includes(term) ||
    (buildingCode !== null && typeof buildingCode !== "string") ||
    (room !== null && typeof room !== "string") ||
    typeof locationUnknown !== "boolean"
  ) {
    return null;
  }
  if (
    !Number.isInteger(startTime) ||
    !Number.isInteger(endTime) ||
    startTime < 0 ||
    endTime > 24 * 60 ||
    endTime <= startTime
  ) {
    return null;
  }
  return {
    id,
    courseCode,
    activityType,
    sectionCode,
    courseName,
    startTime,
    endTime,
    weekday,
    buildingCode,
    room,
    term,
    locationUnknown,
  };
}

/** Produces a JSON-safe whitelist of normalized meetings; raw ICS content is never accepted. */
export function serializeSchedule(meetings: Meeting[]): Meeting[] {
  return meetings.map((meeting) => ({
    id: meeting.id,
    courseCode: meeting.courseCode,
    activityType: meeting.activityType,
    sectionCode: meeting.sectionCode,
    courseName: meeting.courseName,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    weekday: meeting.weekday,
    buildingCode: meeting.buildingCode,
    room: meeting.room,
    term: meeting.term,
    locationUnknown: meeting.locationUnknown,
  }));
}

export function deserializeSchedule(value: unknown): Meeting[] {
  if (Array.isArray(value)) {
    const cached = deserializationCache.get(value);
    if (cached) return cached;
  }
  if (!Array.isArray(value)) throw new Error("Cloud timetable is not a meeting array.");
  const meetings = value.map(deserializeMeeting);
  if (meetings.some((meeting) => meeting === null)) {
    throw new Error("Cloud timetable contains an unsupported meeting record.");
  }
  const unique = [
    ...new Map((meetings as Meeting[]).map((meeting) => [meeting.id, meeting])).values(),
  ];
  const normalized = unique.sort(
    (a, b) =>
      TERMS.indexOf(a.term) - TERMS.indexOf(b.term) ||
      WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) ||
      a.startTime - b.startTime,
  );
  deserializationCache.set(value, normalized);
  return normalized;
}

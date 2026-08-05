import { resolveCourseTitle } from "@/data/utm/course-titles";
import type { ActivityType, Meeting, Term, Weekday } from "@/lib/timetable-types";
import { TERMS, WEEKDAYS } from "@/lib/timetable-types";

const ACTIVITY_TYPES: ActivityType[] = ["LEC", "TUT", "PRA", "OTHER"];
const deserializationCache = new WeakMap<object, Meeting[]>();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
  );
}

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
  const dateRange = value["dateRange"];
  const excludedDates = value["excludedDates"];
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
    dateRange !== undefined &&
    (!isRecord(dateRange) ||
      !isCalendarDate(dateRange["startDate"]) ||
      (dateRange["endDate"] !== null && !isCalendarDate(dateRange["endDate"])) ||
      (typeof dateRange["endDate"] === "string" && dateRange["endDate"] < dateRange["startDate"]))
  ) {
    return null;
  }
  if (
    excludedDates !== undefined &&
    (!Array.isArray(excludedDates) || !excludedDates.every(isCalendarDate))
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
  const meeting: Meeting = {
    id,
    courseCode,
    activityType,
    sectionCode,
    courseName: resolveCourseTitle(courseCode, courseName),
    startTime,
    endTime,
    weekday,
    buildingCode,
    room,
    term,
    locationUnknown,
  };
  if (dateRange !== undefined) {
    meeting.dateRange = {
      startDate: dateRange["startDate"] as string,
      endDate: dateRange["endDate"] as string | null,
    };
  }
  if (excludedDates !== undefined) {
    meeting.excludedDates = [...new Set(excludedDates as string[])].sort();
  }
  return meeting;
}

/** Produces a JSON-safe whitelist of normalized meetings; raw ICS content is never accepted. */
export function serializeSchedule(meetings: Meeting[]): Meeting[] {
  return meetings.map((meeting) => {
    const serialized: Meeting = {
      id: meeting.id,
      courseCode: meeting.courseCode,
      activityType: meeting.activityType,
      sectionCode: meeting.sectionCode,
      courseName: resolveCourseTitle(meeting.courseCode, meeting.courseName),
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      weekday: meeting.weekday,
      buildingCode: meeting.buildingCode,
      room: meeting.room,
      term: meeting.term,
      locationUnknown: meeting.locationUnknown,
    };
    if (meeting.dateRange) serialized.dateRange = { ...meeting.dateRange };
    if (meeting.excludedDates) serialized.excludedDates = [...meeting.excludedDates];
    return serialized;
  });
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

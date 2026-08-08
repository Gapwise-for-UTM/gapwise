export type ActivityType = "LEC" | "TUT" | "PRA" | "OTHER";
export type Term = "Fall" | "Winter" | "Summer";
export type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
export type MeetingLocationType = "physical" | "tba" | "online" | "unknown";

export const TERMS: Term[] = ["Fall", "Winter", "Summer"];
export const WEEKDAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** U of T terms follow calendar months: Winter Jan-Apr, Summer May-Aug, Fall Sep-Dec. */
export function termForMonth(month: number): Term {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid calendar month: ${month}`);
  }
  if (month <= 4) return "Winter";
  if (month <= 8) return "Summer";
  return "Fall";
}

export type MeetingDateRange = {
  /** First date explicitly supplied by DTSTART, in YYYY-MM-DD form. */
  startDate: string;
  /** Last date supplied by a finite RRULE/RDATE, or null when the series is open-ended. */
  endDate: string | null;
};

export interface Meeting {
  id: string;
  courseCode: string;
  activityType: ActivityType;
  sectionCode: string;
  courseName: string;
  /** minutes from midnight */
  startTime: number;
  endTime: number;
  weekday: Weekday;
  buildingCode: string | null;
  room: string | null;
  term: Term;
  locationUnknown: boolean;
  /** Optional UI metadata for personal items. */
  notes?: string;
  color?: string;
  /** Explicit source-backed location kind. Older saved schedules may omit this field. */
  locationType?: MeetingLocationType;
  dateRange?: MeetingDateRange;
  /** Dates explicitly omitted by EXDATE, in YYYY-MM-DD form. */
  excludedDates?: string[];
  /** Weekly RRULE interval. Older saved schedules are treated as weekly when ranges repeat. */
  recurrenceIntervalWeeks?: number;
}

export interface Gap {
  id: string;
  term: Term;
  weekday: Weekday;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  previous: Meeting;
  next: Meeting;
}

export interface ParsedTimetable {
  meetings: Meeting[];
  warnings: string[];
}

export function formatTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function formatCompactDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function meetingLocationType(meeting: Meeting): MeetingLocationType {
  if (meeting.locationType) return meeting.locationType;
  if (!meeting.locationUnknown && (meeting.buildingCode || meeting.room)) return "physical";
  return "unknown";
}

export function locationLabel(m: Meeting): string {
  const type = meetingLocationType(m);
  if (type === "online") return "Online";
  if (type === "tba" || type === "unknown") return "Location TBA";
  if (m.buildingCode && m.room) return `${m.buildingCode} ${m.room}`;
  return m.buildingCode ?? m.room ?? "Location TBA";
}

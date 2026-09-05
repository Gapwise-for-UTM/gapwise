export type ActivityType = "LEC" | "TUT" | "PRA" | "OTHER";
export type Term = "Fall" | "Winter" | "Summer";
export type Weekday =
  "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
export type MeetingLocationType = "physical" | "tba" | "online" | "unknown";

export const TERMS: Term[] = ["Fall", "Winter", "Summer"];
export const WORKWEEK_DAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const WEEKDAYS: Weekday[] = [...WORKWEEK_DAYS, "Saturday", "Sunday"];
export const ASSESSMENT_WINDOW_NOTE = "Reserved assessment window";

const JS_WEEKDAYS: readonly Weekday[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Canonical JavaScript Date day-of-week conversion, including weekends. */
export function weekdayForDate(date: Date): Weekday {
  return JS_WEEKDAYS[date.getDay()]!;
}

/** Keep Mon-Fri as the baseline and append only weekend days that are actually scheduled. */
export function visibleWeekdaysForMeetings(meetings: readonly { weekday: Weekday }[]): Weekday[] {
  const present = new Set(meetings.map((meeting) => meeting.weekday));
  return [
    ...WORKWEEK_DAYS,
    ...(present.has("Saturday") ? (["Saturday"] as const) : []),
    ...(present.has("Sunday") ? (["Sunday"] as const) : []),
  ];
}

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
  /** Optional UI metadata for personal items and source-backed schedule annotations. */
  notes?: string;
  color?: string;
  /** Explicit source-backed location kind. Older saved schedules may omit this field. */
  locationType?: MeetingLocationType;
  dateRange?: MeetingDateRange;
  /** Dates explicitly omitted by EXDATE, in YYYY-MM-DD form. */
  excludedDates?: string[];
  /** Weekly RRULE interval. Its presence is the explicit signal that this meeting repeats. */
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

export function isAssessmentWindow(meeting: Meeting): boolean {
  return meeting.notes === ASSESSMENT_WINDOW_NOTE;
}

export function locationLabel(m: Meeting): string {
  if (isAssessmentWindow(m)) return "Reserved assessment window · location TBA";
  const type = meetingLocationType(m);
  if (type === "online") return "Online";
  if (type === "tba" || type === "unknown") return "Location TBA";
  if (m.buildingCode && m.room) return `${m.buildingCode} ${m.room}`;
  return m.buildingCode ?? m.room ?? "Location TBA";
}

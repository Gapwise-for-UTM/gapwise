export type ActivityType = "LEC" | "TUT" | "PRA" | "OTHER";
export type Term = "Fall" | "Winter";
export type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";

export const WEEKDAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

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
}

export type GapKind = "Transition only" | "Short break" | "Useful study gap" | "Long campus gap";

export interface Gap {
  id: string;
  term: Term;
  weekday: Weekday;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  usableMinutes: number;
  kind: GapKind;
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

export function locationLabel(m: Meeting): string {
  if (m.locationUnknown) return "Location TBA / online";
  if (m.buildingCode && m.room) return `${m.buildingCode} ${m.room}`;
  return m.buildingCode ?? m.room ?? "Location TBA / online";
}

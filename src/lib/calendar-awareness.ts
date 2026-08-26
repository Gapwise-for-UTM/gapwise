import { type Meeting, type Term, termForMonth, weekdayForDate } from "./timetable-types";

export type TermStatus = "before" | "active" | "ended" | "unknown";

export type MeetingOccurrence = {
  meeting: Meeting;
  date: Date;
};

const DAY_MS = 24 * 60 * 60 * 1_000;

export function calendarDateKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function weekStartUtc(date: Date): number {
  const weekday = date.getDay() === 0 ? 6 : date.getDay() - 1;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() - weekday);
}

function repeats(meeting: Meeting): boolean {
  return meeting.recurrenceIntervalWeeks !== undefined;
}

export function meetingOccursOnDate(meeting: Meeting, date: Date): boolean {
  if (weekdayForDate(date) !== meeting.weekday) return false;
  const range = meeting.dateRange;
  if (!range) return true;

  const key = calendarDateKey(date);
  if (key < range.startDate || (range.endDate !== null && key > range.endDate)) return false;
  if (meeting.excludedDates?.includes(key)) return false;
  if (!repeats(meeting)) return key === range.startDate;

  const interval = meeting.recurrenceIntervalWeeks ?? 1;
  const weeks = Math.round(
    (weekStartUtc(date) - weekStartUtc(dateFromKey(range.startDate))) / 7 / DAY_MS,
  );
  return weeks >= 0 && weeks % interval === 0;
}

function findOccurrenceDate(
  meeting: Meeting,
  initialDate: Date,
  direction: 1 | -1,
  maximumDays: number,
): Date | null {
  let date = startOfDay(initialDate);
  for (let offset = 0; offset <= maximumDays; offset += 1) {
    if (meetingOccursOnDate(meeting, date)) return date;
    date = addDays(date, direction);
  }
  return null;
}

export function firstOccurrenceForMeeting(meeting: Meeting): Date | null {
  if (!meeting.dateRange) return null;
  const maximumDays = meeting.dateRange.endDate
    ? Math.max(
        0,
        Math.ceil(
          (dateFromKey(meeting.dateRange.endDate).getTime() -
            dateFromKey(meeting.dateRange.startDate).getTime()) /
            DAY_MS,
        ),
      )
    : 366;
  return findOccurrenceDate(meeting, dateFromKey(meeting.dateRange.startDate), 1, maximumDays);
}

export function lastOccurrenceForMeeting(meeting: Meeting): Date | null {
  const endDate = meeting.dateRange?.endDate;
  if (!endDate) return null;
  const maximumDays = Math.max(
    0,
    Math.ceil(
      (dateFromKey(endDate).getTime() - dateFromKey(meeting.dateRange!.startDate).getTime()) /
        DAY_MS,
    ),
  );
  return findOccurrenceDate(meeting, dateFromKey(endDate), -1, maximumDays);
}

export function firstOccurrence(meetings: readonly Meeting[]): MeetingOccurrence | null {
  let first: MeetingOccurrence | null = null;
  for (const meeting of meetings) {
    const date = firstOccurrenceForMeeting(meeting);
    if (
      date &&
      (!first ||
        date.getTime() < first.date.getTime() ||
        (date.getTime() === first.date.getTime() && meeting.startTime < first.meeting.startTime))
    ) {
      first = { meeting, date };
    }
  }
  return first;
}

export function lastOccurrence(meetings: readonly Meeting[]): MeetingOccurrence | null {
  let last: MeetingOccurrence | null = null;
  for (const meeting of meetings) {
    const date = lastOccurrenceForMeeting(meeting);
    if (
      date &&
      (!last ||
        date.getTime() > last.date.getTime() ||
        (date.getTime() === last.date.getTime() && meeting.endTime > last.meeting.endTime))
    ) {
      last = { meeting, date };
    }
  }
  return last;
}

export function nextOccurrenceForMeeting(meeting: Meeting, now: Date): Date | null {
  const today = startOfDay(now);
  const rangeStart = meeting.dateRange ? dateFromKey(meeting.dateRange.startDate) : today;
  const initial = rangeStart > today ? rangeStart : today;
  const rangeEnd = meeting.dateRange?.endDate
    ? dateFromKey(meeting.dateRange.endDate)
    : addDays(initial, 730);
  const maximumDays = Math.max(0, Math.ceil((rangeEnd.getTime() - initial.getTime()) / DAY_MS));
  let date = initial;
  for (let offset = 0; offset <= maximumDays; offset += 1) {
    if (meetingOccursOnDate(meeting, date)) {
      const occurrence = new Date(date);
      occurrence.setHours(Math.floor(meeting.startTime / 60), meeting.startTime % 60, 0, 0);
      if (occurrence.getTime() > now.getTime()) return occurrence;
    }
    date = addDays(date, 1);
  }
  return null;
}

export function nextOccurrence(meetings: readonly Meeting[], now: Date): MeetingOccurrence | null {
  let next: MeetingOccurrence | null = null;
  for (const meeting of meetings) {
    const date = nextOccurrenceForMeeting(meeting, now);
    if (date && (!next || date.getTime() < next.date.getTime())) next = { meeting, date };
  }
  return next;
}

export function termStatus(meetings: readonly Meeting[], term: Term, date: Date): TermStatus {
  const termMeetings = meetings.filter((meeting) => meeting.term === term);
  const first = firstOccurrence(termMeetings);
  if (!first) return "unknown";
  const today = startOfDay(date).getTime();
  if (today < startOfDay(first.date).getTime()) return "before";

  const hasOpenRange = termMeetings.some((meeting) => meeting.dateRange?.endDate === null);
  const last = lastOccurrence(termMeetings);
  if (!hasOpenRange && last && today > startOfDay(last.date).getTime()) return "ended";
  return "active";
}

export function chooseDefaultTerm(meetings: readonly Meeting[], date: Date): Term {
  const available = [...new Set(meetings.map((meeting) => meeting.term))];
  const active = available.find((term) => termStatus(meetings, term, date) === "active");
  if (active) return active;

  const future = available
    .map((term) => ({ term, first: firstOccurrence(meetings.filter((m) => m.term === term)) }))
    .filter(
      (item): item is { term: Term; first: MeetingOccurrence } =>
        item.first !== null && item.first.date.getTime() > startOfDay(date).getTime(),
    )
    .sort((a, b) => a.first.date.getTime() - b.first.date.getTime())[0];
  if (future) return future.term;

  const currentCalendarTerm = termForMonth(date.getMonth() + 1);
  if (available.includes(currentCalendarTerm)) return currentCalendarTerm;
  return available[0] ?? currentCalendarTerm;
}

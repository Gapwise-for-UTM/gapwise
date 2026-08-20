import { gapBetween, orderSchedule } from "@/lib/schedule-context";
import type { Meeting, Weekday } from "@/lib/timetable-types";
import type { AcademicPlanningContext } from "./types";

export interface WorkWindow {
  id: string;
  kind: "between_commitments" | "free_window";
  start: string;
  end: string;
  availableMinutes: number;
  routeMinutes: number;
}

const weekdays: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const dateParts = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
};

export function addDate(date: string, days: number): string {
  const p = dateParts(date);
  return new Date(Date.UTC(p.y, p.m - 1, p.d + days)).toISOString().slice(0, 10);
}

export function weekdayForDate(date: string): Weekday | null {
  const p = dateParts(date);
  const day = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return day >= 1 && day <= 5 ? weekdays[day - 1]! : null;
}

// Converts Toronto civil time without depending on the host timezone (handles DST through Intl).
export function torontoInstant(date: string, minute: number): string {
  const p = dateParts(date);
  const hour = Math.floor(minute / 60),
    min = minute % 60;
  let guess = Date.UTC(p.y, p.m - 1, p.d, hour, min);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(guess)).map((x) => [x.type, x.value]),
  );
  const represented = Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"]) % 24,
    Number(parts["minute"]),
  );
  guess += Date.UTC(p.y, p.m - 1, p.d, hour, min) - represented;
  return new Date(guess).toISOString();
}

export function torontoDateForInstant(value: string | Date): string {
  const instant = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(instant.getTime())) throw new Error("Instant is invalid.");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
}

export function torontoLocalDateTimeInstant(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Due date is invalid.");
  const date = match[1]!;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const p = dateParts(date);
  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    new Date(Date.UTC(p.y, p.m - 1, p.d)).toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Due date is invalid.");
  }
  return torontoInstant(date, hour * 60 + minute);
}

function occurs(meeting: Meeting, date: string, weekday: Weekday) {
  return (
    meeting.weekday === weekday &&
    (!meeting.dateRange ||
      (date >= meeting.dateRange.startDate &&
        (!meeting.dateRange.endDate || date <= meeting.dateRange.endDate))) &&
    !meeting.excludedDates?.includes(date)
  );
}

function subtractOccupied(
  start: number,
  end: number,
  occupied: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  let segments = [{ start, end }];
  for (const block of occupied) {
    segments = segments.flatMap((segment) => {
      if (block.end <= segment.start || block.start >= segment.end) return [segment];
      const next: Array<{ start: number; end: number }> = [];
      if (block.start > segment.start) next.push({ start: segment.start, end: block.start });
      if (block.end < segment.end) next.push({ start: block.end, end: segment.end });
      return next;
    });
  }
  return segments;
}

export function buildWorkWindows(
  context: AcademicPlanningContext,
  routeMinutes: (from: Meeting, to: Meeting) => number | null,
): WorkWindow[] {
  const result: WorkWindow[] = [];
  const parsedNotBefore = context.horizon.notBefore
    ? Date.parse(context.horizon.notBefore)
    : Number.NaN;
  const notBefore = Number.isFinite(parsedNotBefore)
    ? parsedNotBefore
    : Number.NEGATIVE_INFINITY;
  const activeBlocks = context.existingBlocks.filter(
    (block) => block.status === "accepted" && block.locked,
  );

  let date = context.horizon.startDate;
  while (date <= context.horizon.endDate) {
    const weekday = weekdayForDate(date);
    if (weekday) {
      const commitments = merge(
        orderSchedule(
          [...context.academicMeetings, ...context.fixedPersonalCommitments].filter((meeting) =>
            occurs(meeting, date, weekday),
          ),
        ),
      );
      const occupied = activeBlocks
        .filter((block) => torontoDateForInstant(block.start) === date)
        .map((block) => ({ start: Date.parse(block.start), end: Date.parse(block.end) }))
        .filter((block) => Number.isFinite(block.start) && Number.isFinite(block.end))
        .sort((a, b) => a.start - b.start || a.end - b.end);

      const add = (start: number, end: number, kind: WorkWindow["kind"], route = 0) => {
        const usableStart = start + context.preferences.setupMinutes;
        const usableEnd = end - context.preferences.packUpMinutes - route;
        if (usableEnd <= usableStart) return;

        const startInstant = Math.max(Date.parse(torontoInstant(date, usableStart)), notBefore);
        const endInstant = Date.parse(torontoInstant(date, usableEnd));
        if (endInstant <= startInstant) return;

        for (const segment of subtractOccupied(startInstant, endInstant, occupied)) {
          const availableMinutes = Math.floor((segment.end - segment.start) / 60_000);
          if (availableMinutes < context.preferences.minimumBlockMinutes) continue;
          const segmentStart = new Date(segment.start).toISOString();
          const segmentEnd = new Date(segment.end).toISOString();
          result.push({
            id: `${date}:${kind}:${segmentStart}-${segmentEnd}`,
            kind,
            start: segmentStart,
            end: segmentEnd,
            availableMinutes,
            routeMinutes: route,
          });
        }
      };

      if (commitments[0]) {
        add(context.horizon.dayStartMinute, commitments[0].startTime, "free_window");
      }
      for (let i = 0; i < commitments.length - 1; i++) {
        const from = commitments[i]!;
        const to = commitments[i + 1]!;
        const gap = gapBetween(from, to);
        if (!gap) continue;
        const route = routeMinutes(from, to);
        if (route !== null) add(gap.startTime, gap.endTime, "between_commitments", route);
      }
      if (commitments.length) {
        add(commitments.at(-1)!.endTime, context.horizon.dayEndMinute, "free_window");
      } else {
        add(context.horizon.dayStartMinute, context.horizon.dayEndMinute, "free_window");
      }
    }
    date = addDate(date, 1);
  }
  return result;
}

function merge(items: Meeting[]): Meeting[] {
  const out: Meeting[] = [];
  for (const meeting of items) {
    const last = out.at(-1);
    if (last && meeting.startTime <= last.endTime) {
      if (meeting.endTime > last.endTime) {
        out[out.length - 1] = { ...meeting, startTime: last.startTime };
      }
    } else {
      out.push(meeting);
    }
  }
  return out;
}

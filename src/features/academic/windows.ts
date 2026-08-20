import { gapBetween, orderSchedule } from "@/lib/schedule-context";
import type { Meeting, Weekday } from "@/lib/timetable-types";
import type { AcademicPlanningContext, PlannedWorkBlock } from "./types";

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
function occurs(meeting: Meeting, date: string, weekday: Weekday) {
  return (
    meeting.weekday === weekday &&
    (!meeting.dateRange ||
      (date >= meeting.dateRange.startDate &&
        (!meeting.dateRange.endDate || date <= meeting.dateRange.endDate))) &&
    !meeting.excludedDates?.includes(date)
  );
}

export function buildWorkWindows(
  context: AcademicPlanningContext,
  routeMinutes: (from: Meeting, to: Meeting) => number | null,
): WorkWindow[] {
  const result: WorkWindow[] = [];
  let date = context.horizon.startDate;
  while (date <= context.horizon.endDate) {
    const weekday = weekdayForDate(date);
    if (weekday) {
      const commitments = orderSchedule(
        [...context.academicMeetings, ...context.fixedPersonalCommitments].filter((m) =>
          occurs(m, date, weekday),
        ),
      );
      const occupied = context.existingBlocks
        .filter((b) => b.locked && !["cancelled", "missed"].includes(b.status))
        .map(blockMeeting);
      const all = orderSchedule([...commitments, ...occupied]);
      const boundaries = [
        context.horizon.dayStartMinute,
        ...all.flatMap((m) => [m.startTime, m.endTime]),
        context.horizon.dayEndMinute,
      ].sort((a, b) => a - b);
      const merged = merge(all);
      const add = (start: number, end: number, kind: WorkWindow["kind"], route = 0) => {
        const s = start + context.preferences.setupMinutes,
          e = end - context.preferences.packUpMinutes - route;
        if (e - s >= context.preferences.minimumBlockMinutes)
          result.push({
            id: `${date}:${kind}:${s}-${e}`,
            kind,
            start: torontoInstant(date, s),
            end: torontoInstant(date, e),
            availableMinutes: e - s,
            routeMinutes: route,
          });
      };
      if (merged[0]) add(context.horizon.dayStartMinute, merged[0].startTime, "free_window");
      for (let i = 0; i < merged.length - 1; i++) {
        const from = merged[i]!,
          to = merged[i + 1]!;
        const gap = gapBetween(from, to);
        if (!gap) continue;
        const route = routeMinutes(from, to);
        if (route !== null) add(gap.startTime, gap.endTime, "between_commitments", route);
      }
      if (merged.length) add(merged.at(-1)!.endTime, context.horizon.dayEndMinute, "free_window");
      if (!merged.length && boundaries.length === 2)
        add(context.horizon.dayStartMinute, context.horizon.dayEndMinute, "free_window");
    }
    date = addDate(date, 1);
  }
  return result;
}
function merge(items: Meeting[]): Meeting[] {
  const out: Meeting[] = [];
  for (const m of items) {
    const last = out.at(-1);
    if (last && m.startTime <= last.endTime) {
      if (m.endTime > last.endTime) out[out.length - 1] = { ...m, startTime: last.startTime };
    } else out.push(m);
  }
  return out;
}
function blockMeeting(b: PlannedWorkBlock): Meeting {
  const start = new Date(b.start),
    end = new Date(b.end);
  const fmt = (d: Date) => {
    const ps = new Intl.DateTimeFormat("en", {
      timeZone: "America/Toronto",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);
    const x = Object.fromEntries(ps.map((p) => [p.type, p.value]));
    return (Number(x["hour"]) % 24) * 60 + Number(x["minute"]);
  };
  return {
    id: b.id,
    courseCode: "PLANNED",
    courseName: "Planned work",
    activityType: "OTHER",
    sectionCode: "",
    startTime: fmt(start),
    endTime: fmt(end),
    weekday: weekdays[(start.getUTCDay() + 6) % 7] ?? "Monday",
    buildingCode: null,
    room: null,
    term: "Fall",
    locationUnknown: true,
  };
}

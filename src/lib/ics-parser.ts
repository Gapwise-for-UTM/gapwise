import ICAL from "ical.js";
import {
  type ActivityType,
  type Meeting,
  type ParsedTimetable,
  type Term,
  type Weekday,
  WEEKDAYS,
} from "./timetable-types";

export class IcsParseError extends Error {}

const DAY_MAP: Record<string, Weekday> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
};

const JS_DAY: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseSummary(summary: string): {
  courseCode: string;
  activityType: ActivityType;
  sectionCode: string;
} {
  const cleaned = unescapeText(summary).replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^([A-Z]{3}\d{3}[A-Z]\d?)\s*(LEC|TUT|PRA)?\s*(\d{3,4})?/i);
  if (!match) {
    return { courseCode: cleaned || "Unknown", activityType: "OTHER", sectionCode: "" };
  }
  const type = (match[2] ?? "").toUpperCase();
  const code = (match[1] ?? "").toUpperCase();
  return {
    courseCode: code,
    activityType: (["LEC", "TUT", "PRA"].includes(type) ? type : "OTHER") as ActivityType,
    sectionCode: match[3] ?? "",
  };
}

function parseLocation(raw: string | null): {
  buildingCode: string | null;
  room: string | null;
  locationUnknown: boolean;
} {
  const value = unescapeText(raw ?? "").replace(/\s+/g, " ").trim();
  if (!value || /^zz\b/i.test(value) || /tba|online|n\/a/i.test(value)) {
    return { buildingCode: null, room: null, locationUnknown: true };
  }
  const parts = value.split(" ");
  if (parts.length === 1) {
    return { buildingCode: parts[0] ?? null, room: null, locationUnknown: false };
  }
  return {
    buildingCode: parts[0] ?? null,
    room: parts.slice(1).join(" "),
    locationUnknown: false,
  };
}

function termFor(month: number): Term {
  // month is 1-12
  return month >= 8 ? "Fall" : "Winter";
}

function weekdaysFor(event: ICAL.Event, startWeekday: Weekday | null): Weekday[] {
  const days = new Set<Weekday>();
  const rrules = event.component.getAllProperties("rrule");
  for (const rule of rrules) {
    const value = rule.getFirstValue() as { parts?: Record<string, unknown> } | null;
    const byday = value?.parts?.["BYDAY"];
    if (Array.isArray(byday)) {
      for (const raw of byday) {
        const code = String(raw).replace(/[^A-Z]/gi, "").toUpperCase().slice(-2);
        const day = DAY_MAP[code];
        if (day) days.add(day);
      }
    }
  }
  if (days.size === 0 && startWeekday) days.add(startWeekday);
  return WEEKDAYS.filter((d) => days.has(d));
}

export function parseIcs(text: string): ParsedTimetable {
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new IcsParseError(
      "That file doesn't look like a calendar export. Please upload the .ics file downloaded from ACORN."
    );
  }

  let comp: ICAL.Component;
  try {
    comp = new ICAL.Component(ICAL.parse(text));
  } catch {
    throw new IcsParseError(
      "We couldn't read this calendar file — it appears to be malformed or incomplete."
    );
  }

  const vevents = comp.getAllSubcomponents("vevent");
  if (vevents.length === 0) {
    throw new IcsParseError(
      "This calendar has no events in it. Export your timetable from ACORN again and try once more."
    );
  }

  const warnings = new Set<string>();
  const byKey = new Map<string, Meeting>();

  for (const vevent of vevents) {
    let event: ICAL.Event;
    try {
      event = new ICAL.Event(vevent);
    } catch {
      warnings.add("One or more events were skipped because they could not be read.");
      continue;
    }

    const start = event.startDate;
    const end = event.endDate;
    if (!start || !end) {
      warnings.add("Some events were skipped because they had no start or end time.");
      continue;
    }

    const summary = event.summary ?? "";
    const { courseCode, activityType, sectionCode } = parseSummary(summary);
    if (!/^[A-Z]{3}\d{3}/.test(courseCode)) {
      warnings.add(`"${summary || "Untitled event"}" was skipped because it isn't a course meeting.`);
      continue;
    }

    const description = unescapeText(event.description ?? "");
    const courseName = description.split("\n")[0]?.trim() || courseCode;

    const location = parseLocation(vevent.getFirstPropertyValue("location") as string | null);
    if (location.locationUnknown) {
      warnings.add(`${courseCode} ${activityType} has no assigned room (TBA or online).`);
    }

    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;
    if (endMinutes <= startMinutes) {
      warnings.add(`${courseCode} ${activityType} has an unusable time range and was skipped.`);
      continue;
    }

    const jsDay = new Date(start.year, start.month - 1, start.day).getDay();
    const startWeekday = (jsDay >= 1 && jsDay <= 5 ? JS_DAY[jsDay - 1] : null) ?? null;
    if (!startWeekday) {
      warnings.add(`${courseCode} ${activityType} falls on a weekend and was not placed on the grid.`);
    }

    const hasRrule = vevent.getAllProperties("rrule").length > 0;
    const days = weekdaysFor(event, startWeekday);
    if (hasRrule) {
      const freq = (
        vevent.getFirstPropertyValue("rrule") as { freq?: string } | null
      )?.freq;
      if (freq && freq !== "WEEKLY") {
        warnings.add(
          `${courseCode} ${activityType} repeats in a pattern we don't fully support (${freq.toLowerCase()}); it is shown on its first weekday only.`
        );
      }
    }

    const term = termFor(start.month);

    for (const weekday of days) {
      const meeting: Meeting = {
        id: `${term}-${courseCode}-${activityType}-${sectionCode}-${weekday}-${startMinutes}`,
        courseCode,
        activityType,
        sectionCode,
        courseName,
        startTime: startMinutes,
        endTime: endMinutes,
        weekday,
        buildingCode: location.buildingCode,
        room: location.room,
        term,
        locationUnknown: location.locationUnknown,
      };
      byKey.set(meeting.id, meeting);
    }
  }

  const meetings = [...byKey.values()].sort(
    (a, b) =>
      WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) ||
      a.startTime - b.startTime ||
      a.courseCode.localeCompare(b.courseCode)
  );

  if (meetings.length === 0) {
    throw new IcsParseError(
      "We parsed the calendar but found no classes. This export may not contain a UTM timetable."
    );
  }

  return { meetings, warnings: [...warnings].slice(0, 6) };
}

import ICAL from "ical.js";
import {
  type ActivityType,
  type Meeting,
  type MeetingLocationType,
  type ParsedTimetable,
  type Weekday,
  termForMonth,
  weekdayForDate,
  WEEKDAYS,
} from "./timetable-types";
import { resolveAcornLocation } from "@/features/routing/location-resolver";

export class IcsParseError extends Error {
  override name = "IcsParseError";
}

export const MAX_ICS_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ICS_EVENTS = 2_000;

const DAY_MAP: Record<string, Weekday> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

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
  // Standard UTM/St. George codes look like CSC110Y5, while UTSC uses the
  // fourth position as a letter in identifiers such as CSCA08H3.
  const match = cleaned.match(/^([A-Z]{3}[A-Z0-9]\d{2}[A-Z]\d?)\s*(LEC|TUT|PRA)?\s*(\d{3,4})?/i);
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
  locationType: MeetingLocationType;
  warning: string | null;
} {
  const value = unescapeText(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const resolved = resolveAcornLocation(value);
  if (!resolved.buildingCode) {
    return {
      buildingCode: null,
      room: null,
      locationUnknown: true,
      locationType: resolved.status === "known" ? "physical" : resolved.status,
      warning: resolved.warning,
    };
  }
  return {
    buildingCode: resolved.buildingCode,
    room: resolved.room,
    locationUnknown: resolved.status !== "known",
    locationType: resolved.status === "known" ? "physical" : resolved.status,
    warning: resolved.warning,
  };
}

function calendarDate(value: { year: number; month: number; day: number }): string {
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function calendarDates(properties: ICAL.Property[]): string[] {
  return properties
    .flatMap((property) => property.getValues())
    .filter(
      (value): value is ICAL.Time =>
        value instanceof ICAL.Time &&
        Number.isInteger(value.year) &&
        Number.isInteger(value.month) &&
        Number.isInteger(value.day),
    )
    .map(calendarDate);
}

function recurrenceMetadata(
  vevent: ICAL.Component,
  start: ICAL.Time,
  weekly: boolean,
  cancelledDates: readonly string[],
) {
  const rules = vevent
    .getAllProperties("rrule")
    .map((property) => property.getFirstValue())
    .filter((value): value is ICAL.Recur => value instanceof ICAL.Recur);
  const recurrenceDates = calendarDates(vevent.getAllProperties("rdate"));
  if (!weekly) {
    const firstDate = calendarDate(start);
    return {
      dateRange: { startDate: firstDate, endDate: firstDate },
      excludedDates: [] as string[],
      recurrenceIntervalWeeks: undefined,
    };
  }
  let endDate: string | null;
  if (rules.length === 0 && recurrenceDates.length === 0) {
    endDate = calendarDate(start);
  } else if (rules.some((rule) => rule.until === null)) {
    endDate = null;
  } else {
    const suppliedEnds = [
      ...rules.map((rule) => calendarDate(rule.until!)),
      ...recurrenceDates,
    ].sort();
    endDate = suppliedEnds.at(-1) ?? null;
  }
  return {
    dateRange: { startDate: calendarDate(start), endDate },
    excludedDates: [
      ...new Set([...calendarDates(vevent.getAllProperties("exdate")), ...cancelledDates]),
    ].sort(),
    recurrenceIntervalWeeks: rules.find((rule) => rule.freq === "WEEKLY")?.interval ?? 1,
  };
}

function weekdaysFor(event: ICAL.Event, startWeekday: Weekday | null): Weekday[] {
  const days = new Set<Weekday>();
  const rrules = event.component.getAllProperties("rrule");
  for (const rule of rrules) {
    const value = rule.getFirstValue() as { parts?: Record<string, unknown> } | null;
    const byday = value?.parts?.["BYDAY"];
    if (Array.isArray(byday)) {
      for (const raw of byday) {
        const code = String(raw)
          .replace(/[^A-Z]/gi, "")
          .toUpperCase()
          .slice(-2);
        const day = DAY_MAP[code];
        if (day) days.add(day);
      }
    }
  }
  if (days.size === 0 && startWeekday) days.add(startWeekday);
  return WEEKDAYS.filter((d) => days.has(d));
}

export function parseIcs(text: string): ParsedTimetable {
  if (text.length > MAX_ICS_FILE_BYTES) {
    throw new IcsParseError("That calendar is too large. Please choose an .ics file under 2 MB.");
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new IcsParseError(
      "That file doesn't look like a calendar export. Please upload the .ics file downloaded from ACORN.",
    );
  }

  let comp: ICAL.Component;
  try {
    comp = new ICAL.Component(ICAL.parse(text));
  } catch {
    throw new IcsParseError(
      "We couldn't read this calendar file — it appears to be malformed or incomplete.",
    );
  }

  const vevents = comp.getAllSubcomponents("vevent");
  if (vevents.length === 0) {
    throw new IcsParseError(
      "This calendar has no events in it. Export your timetable from ACORN again and try once more.",
    );
  }
  if (vevents.length > MAX_ICS_EVENTS) {
    throw new IcsParseError(
      "That calendar contains too many events. Export only your current ACORN timetable and try again.",
    );
  }

  const warnings = new Set<string>();
  const byKey = new Map<string, Meeting>();
  const cancelledRecurrences = new Map<string, Set<string>>();

  for (const vevent of vevents) {
    const status = String(vevent.getFirstPropertyValue("status") ?? "").toUpperCase();
    const recurrenceId = vevent.getFirstPropertyValue("recurrence-id");
    const uid = String(vevent.getFirstPropertyValue("uid") ?? "");
    if (status !== "CANCELLED" || !(recurrenceId instanceof ICAL.Time) || !uid) continue;
    const dates = cancelledRecurrences.get(uid) ?? new Set<string>();
    dates.add(calendarDate(recurrenceId));
    cancelledRecurrences.set(uid, dates);
  }

  for (const vevent of vevents) {
    const status = String(vevent.getFirstPropertyValue("status") ?? "").toUpperCase();
    const recurrenceId = vevent.getFirstPropertyValue("recurrence-id");
    if (status === "CANCELLED") {
      continue;
    }
    if (recurrenceId) {
      warnings.add(
        "A changed recurring occurrence was skipped because recurrence overrides are not supported yet.",
      );
      continue;
    }

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
    if (!/^[A-Z]{3}[A-Z0-9]\d{2}[A-Z]\d?$/.test(courseCode)) {
      warnings.add(
        `"${summary || "Untitled event"}" was skipped because it isn't a course meeting.`,
      );
      continue;
    }

    const description = unescapeText(event.description ?? "");
    const courseName = description.split("\n")[0]?.trim() || courseCode;

    const location = parseLocation(vevent.getFirstPropertyValue("location") as string | null);
    if (location.warning) {
      warnings.add(`${courseCode} ${activityType}: ${location.warning}`);
    }

    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;
    if (endMinutes <= startMinutes) {
      warnings.add(`${courseCode} ${activityType} has an unusable time range and was skipped.`);
      continue;
    }

    const startWeekday = weekdayForDate(new Date(start.year, start.month - 1, start.day));

    const rules = vevent.getAllProperties("rrule");
    const hasRrule = rules.length > 0;
    const frequencies = rules
      .map((rule) => (rule.getFirstValue() as { freq?: string } | null)?.freq)
      .filter((frequency): frequency is string => Boolean(frequency));
    const supportsWeeklyRecurrence =
      hasRrule &&
      frequencies.length === rules.length &&
      frequencies.every((freq) => freq === "WEEKLY");
    const days = supportsWeeklyRecurrence
      ? weekdaysFor(event, startWeekday)
      : startWeekday
        ? [startWeekday]
        : [];
    if (hasRrule) {
      const freq = frequencies[0];
      if (!supportsWeeklyRecurrence) {
        warnings.add(
          `${courseCode} ${activityType} repeats in an unsupported pattern${freq ? ` (${freq.toLowerCase()})` : ""}; only its first occurrence is shown.`,
        );
      }
    }

    const term = termForMonth(start.month);
    const uid = String(vevent.getFirstPropertyValue("uid") ?? "");
    const recurrence = recurrenceMetadata(vevent, start, supportsWeeklyRecurrence, [
      ...(cancelledRecurrences.get(uid) ?? []),
    ]);

    for (const weekday of days) {
      const meeting: Meeting = {
        id: `${term}-${courseCode}-${activityType}-${sectionCode}-${weekday}-${startMinutes}-${recurrence.dateRange.startDate}`,
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
        locationType: location.locationType,
        dateRange: recurrence.dateRange,
        ...(recurrence.excludedDates.length > 0 ? { excludedDates: recurrence.excludedDates } : {}),
        ...(recurrence.recurrenceIntervalWeeks
          ? { recurrenceIntervalWeeks: recurrence.recurrenceIntervalWeeks }
          : {}),
      };
      byKey.set(meeting.id, meeting);
    }
  }

  const meetings = [...byKey.values()].sort(
    (a, b) =>
      WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) ||
      a.startTime - b.startTime ||
      a.courseCode.localeCompare(b.courseCode),
  );

  if (meetings.length === 0) {
    throw new IcsParseError(
      "We parsed the calendar but found no classes. This export may not contain a UTM timetable.",
    );
  }

  return { meetings, warnings: [...warnings].slice(0, 6) };
}

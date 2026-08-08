import { describe, expect, test } from "bun:test";
import { IcsParseError, MAX_ICS_EVENTS, MAX_ICS_FILE_BYTES, parseIcs } from "@/lib/ics-parser";
import { locationLabel } from "@/lib/timetable-types";

function event(
  uid: string,
  summary = "CSC108H5 LEC 0101",
  options: {
    start?: string;
    end?: string;
    recurrence?: string[];
    location?: string;
  } = {},
) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${options.start ?? "20260907T090000"}`,
    `DTEND:${options.end ?? "20260907T100000"}`,
    `SUMMARY:${summary}`,
    "DESCRIPTION:Introduction to Computer Programming",
    `LOCATION:${options.location ?? "MN 1210"}`,
    ...(options.recurrence ?? []),
    "END:VEVENT",
  ].join("\r\n");
}

function calendar(events: string[]) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
}

describe("untrusted ICS parsing", () => {
  test("parses a supported ACORN course event", () => {
    const result = parseIcs(calendar([event("one")]));

    expect(result.meetings).toHaveLength(1);
    expect(result.meetings[0]).toMatchObject({
      courseCode: "CSC108H5",
      activityType: "LEC",
      buildingCode: "MN",
      room: "1210",
    });
  });

  test("rejects malformed calendar input with a user-safe error", () => {
    expect(() => parseIcs("BEGIN:VCALENDAR\nBEGIN:VEVENT")).toThrow(IcsParseError);
  });

  test.each([
    ["Fall", "20260907T090000", "20260907T100000"],
    ["Winter", "20270111T090000", "20270111T100000"],
    ["Summer", "20270503T090000", "20270503T100000"],
    ["Summer", "20270809T090000", "20270809T100000"],
  ] as const)("classifies %s term dates correctly", (term, start, end) => {
    const result = parseIcs(calendar([event(term, "CSC108H5 LEC 0101", { start, end })]));

    expect(result.meetings[0]?.term).toBe(term);
  });

  test("preserves supplied recurrence ranges and EXDATE exceptions", () => {
    const result = parseIcs(
      calendar([
        event("recurring", "CSC108H5 LEC 0101", {
          recurrence: [
            "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261207T140000Z",
            "EXDATE:20261012T090000,20261109T090000",
          ],
        }),
      ]),
    );

    expect(result.meetings[0]?.dateRange).toEqual({
      startDate: "2026-09-07",
      endDate: "2026-12-07",
    });
    expect(result.meetings[0]?.excludedDates).toEqual(["2026-10-12", "2026-11-09"]);
  });

  test("does not invent an end date for an open-ended recurrence", () => {
    const result = parseIcs(
      calendar([
        event("open-ended", "CSC108H5 LEC 0101", {
          recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
        }),
      ]),
    );

    expect(result.meetings[0]?.dateRange?.endDate).toBeNull();
  });

  test.each([
    ["", "tba", "Location TBA"],
    ["ZZ TBA", "tba", "Location TBA"],
    ["Online synchronous", "online", "Online"],
  ] as const)("preserves the source-backed location state for %s", (location, type, label) => {
    const meeting = parseIcs(calendar([event(type, "CSC108H5 LEC 0101", { location })]))
      .meetings[0]!;

    expect(meeting.locationType).toBe(type);
    expect(meeting.locationUnknown).toBe(true);
    expect(locationLabel(meeting)).toBe(label);
  });

  test("deduplicates repeated course meetings", () => {
    expect(parseIcs(calendar([event("one"), event("two")])).meetings).toHaveLength(1);
  });

  test("rejects input above the file-size budget before parsing", () => {
    const oversized = `BEGIN:VCALENDAR\n${" ".repeat(MAX_ICS_FILE_BYTES)}`;

    expect(() => parseIcs(oversized)).toThrow("under 2 MB");
  });

  test("rejects calendars with an excessive event count", () => {
    const events = Array.from({ length: MAX_ICS_EVENTS + 1 }, (_, index) => event(String(index)));

    expect(() => parseIcs(calendar(events))).toThrow("too many events");
  });
});

import { describe, expect, test } from "bun:test";
import { IcsParseError, MAX_ICS_EVENTS, MAX_ICS_FILE_BYTES, parseIcs } from "@/lib/ics-parser";

function event(uid: string, summary = "CSC108H5 LEC 0101") {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "DTSTART:20260907T090000",
    "DTEND:20260907T100000",
    `SUMMARY:${summary}`,
    "DESCRIPTION:Introduction to Computer Programming",
    "LOCATION:MN 1210",
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

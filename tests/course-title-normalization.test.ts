import { describe, expect, test } from "bun:test";
import { deserializeSchedule } from "@/features/sync/schedule-serialization";
import { parseIcs } from "@/lib/ics-parser";

describe("course-title normalization boundaries", () => {
  test("keeps ACORN's exported title until canonical enrichment runs", () => {
    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:csc110",
      "DTSTART:20260907T090000",
      "DTEND:20260907T110000",
      "SUMMARY:CSC110Y5 LEC0101",
      String.raw`DESCRIPTION:Foundations of Computer\nMAANJIWE NENDAMOWINAN`,
      "LOCATION:MN 1270",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseIcs(calendar).meetings[0]?.courseName).toBe("Foundations of Computer");
  });

  test("keeps an unknown exported course title", () => {
    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:abc123",
      "DTSTART:20260907T090000",
      "DTEND:20260907T110000",
      "SUMMARY:ABC123H5 LEC0101",
      String.raw`DESCRIPTION:A Complete Course Name\nMAANJIWE NENDAMOWINAN`,
      "LOCATION:MN 1270",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseIcs(calendar).meetings[0]?.courseName).toBe("A Complete Course Name");
  });

  test("does not mutate stored cloud titles through a hidden hardcoded catalog", () => {
    const meetings = deserializeSchedule([
      {
        id: "fall-isp100",
        courseCode: "ISP100H5",
        activityType: "LEC",
        sectionCode: "0116",
        courseName: "Writing for University and",
        startTime: 720,
        endTime: 900,
        weekday: "Tuesday",
        buildingCode: "MN",
        room: "3210",
        term: "Fall",
        locationUnknown: false,
      },
    ]);

    expect(meetings[0]?.courseName).toBe("Writing for University and");
  });
});

import { describe, expect, test } from "bun:test";
import { resolveCourseTitle } from "@/data/utm/course-titles";
import { deserializeSchedule } from "@/features/sync/schedule-serialization";
import { parseIcs } from "@/lib/ics-parser";

describe("course-title normalization", () => {
  test("replaces an abbreviated ACORN CSC110 title", () => {
    expect(resolveCourseTitle("CSC110Y5", "Foundations of Computer")).toBe(
      "Foundations of Computer Science 1",
    );
  });

  test("keeps an unknown exported course title", () => {
    expect(resolveCourseTitle("ABC123H5", "A Complete Course Name")).toBe("A Complete Course Name");
  });

  test("normalizes abbreviated titles while parsing an ACORN export", () => {
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

    expect(parseIcs(calendar).meetings[0]?.courseName).toBe("Foundations of Computer Science 1");
  });

  test("normalizes an existing cloud timetable without requiring re-import", () => {
    const meetings = deserializeSchedule([
      {
        id: "winter-isp100",
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

    expect(meetings[0]?.courseName).toBe("Writing for University and Beyond");
  });
});

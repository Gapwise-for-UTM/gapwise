import { describe, expect, test } from "bun:test";
import {
  describeTimetableChanges,
  validateTimetableFile,
} from "@/features/timetable/import-lifecycle";
import type { Meeting } from "@/lib/timetable-types";

function meeting(id: string, startTime = 9 * 60): Meeting {
  return {
    id,
    courseCode: id,
    activityType: "LEC",
    sectionCode: "0101",
    courseName: id,
    startTime,
    endTime: startTime + 60,
    weekday: "Monday",
    buildingCode: null,
    room: null,
    term: "Fall",
    locationUnknown: true,
  };
}

describe("timetable import lifecycle", () => {
  test("accepts ICS filenames or calendar MIME types and rejects unsupported files", () => {
    expect(validateTimetableFile({ name: "acorn.ICS", type: "", size: 1 })).toBeNull();
    expect(validateTimetableFile({ name: "download", type: "text/calendar", size: 1 })).toBeNull();
    expect(validateTimetableFile({ name: "schedule.pdf", type: "application/pdf", size: 1 })).toBe(
      "That file type isn't supported. Please choose a .ics calendar file.",
    );
  });

  test("rejects files larger than the existing two-megabyte limit", () => {
    expect(
      validateTimetableFile({
        name: "acorn.ics",
        type: "text/calendar",
        size: 2 * 1024 * 1024 + 1,
      }),
    ).toBe("That calendar is too large. Please choose an .ics file under 2 MB.");
  });

  test("describes added, removed, and updated meetings deterministically", () => {
    expect(
      describeTimetableChanges(
        [meeting("removed"), meeting("changed")],
        [meeting("changed", 10 * 60), meeting("added")],
      ),
    ).toBe("1 added · 1 removed · 1 updated");
    expect(describeTimetableChanges([meeting("same")], [meeting("same")])).toBe(
      "no meeting changes",
    );
  });
});

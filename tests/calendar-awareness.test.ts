import { describe, expect, test } from "bun:test";
import {
  chooseDefaultTerm,
  firstOccurrence,
  meetingOccursOnDate,
  termStatus,
} from "@/lib/calendar-awareness";
import type { Meeting } from "@/lib/timetable-types";
import { meeting } from "./fixtures";

function recurring(overrides: Partial<Meeting> = {}) {
  return meeting({
    id: "fall-wednesday",
    weekday: "Wednesday",
    startTime: 9 * 60,
    endTime: 11 * 60,
    dateRange: { startDate: "2026-09-09", endDate: "2026-12-02" },
    recurrenceIntervalWeeks: 1,
    ...overrides,
  });
}

describe("calendar-aware timetable state", () => {
  test("recognizes a selected term before it starts", () => {
    const meetings = [recurring()];

    expect(termStatus(meetings, "Fall", new Date(2026, 7, 7, 12))).toBe("before");
    expect(firstOccurrence(meetings)?.meeting.courseCode).toBe("CSC108H5");
  });

  test("recognizes an active selected term", () => {
    expect(termStatus([recurring()], "Fall", new Date(2026, 9, 7, 12))).toBe("active");
  });

  test("recognizes a selected term after its last occurrence", () => {
    expect(termStatus([recurring()], "Fall", new Date(2026, 11, 10, 12))).toBe("ended");
  });

  test("EXDATE suppresses an otherwise valid occurrence", () => {
    const schedule = recurring({ excludedDates: ["2026-10-14"] });

    expect(meetingOccursOnDate(schedule, new Date(2026, 9, 7, 12))).toBe(true);
    expect(meetingOccursOnDate(schedule, new Date(2026, 9, 14, 12))).toBe(false);
  });

  test("defaults to the next term between Fall and Winter", () => {
    const fall = recurring();
    const winter = recurring({
      id: "winter-monday",
      term: "Winter",
      weekday: "Monday",
      dateRange: { startDate: "2027-01-11", endDate: "2027-04-05" },
    });

    expect(chooseDefaultTerm([fall, winter], new Date(2026, 11, 20, 12))).toBe("Winter");
  });
});

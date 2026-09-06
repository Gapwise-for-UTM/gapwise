import { describe, expect, test } from "bun:test";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { createCampusDayRouteStops } from "@/features/routing/campus-day";
import type { TransitionPlanner } from "@/features/routing/transition";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import { deserializeSchedule, serializeSchedule } from "@/features/sync/schedule-serialization";
import { buildTodayState } from "@/features/today/today-state";
import { findGaps } from "@/lib/gaps";
import { parseIcs } from "@/lib/ics-parser";
import {
  ASSESSMENT_WINDOW_NOTE,
  isAssessmentWindow,
  locationLabel,
  visibleWeekdaysForMeetings,
} from "@/lib/timetable-types";

const fixture = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:assessment-window",
  "DTSTART;TZID=America/Toronto:20260912T130000",
  "DTEND;TZID=America/Toronto:20260912T150000",
  "SUMMARY:CSC110Y5 LEC0101",
  "DESCRIPTION:Foundations of Computer\\n**********************",
  "LOCATION:ZZ TBA",
  "RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20261208T235959",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const fixtureWithClassBeforeReservedWindow = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:lecture",
  "DTSTART;TZID=America/Toronto:20260910T110000",
  "DTEND;TZID=America/Toronto:20260910T130000",
  "SUMMARY:MAT159H5 LEC0101",
  "DESCRIPTION:Analysis II\\nDEERFIELD HALL",
  "LOCATION:DH 3000",
  "RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20261208T235959",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:assessment-window",
  "DTSTART;TZID=America/Toronto:20260910T190000",
  "DTEND;TZID=America/Toronto:20260910T210000",
  "SUMMARY:MAT159H5 LEC0101",
  "DESCRIPTION:Analysis II\\n**********************",
  "LOCATION:ZZ TBA",
  "RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20261208T235959",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const unusedTransitionPlanner = (() => {
  throw new Error("Reserved assessment windows should not request a transition.");
}) as TransitionPlanner;

describe("ACORN assessment windows", () => {
  test("classifies ZZ TBA placeholder blocks as reserved assessment windows", () => {
    const meeting = parseIcs(fixture).meetings[0]!;

    expect(meeting.weekday).toBe("Saturday");
    expect(meeting.locationType).toBe("tba");
    expect(meeting.notes).toBe(ASSESSMENT_WINDOW_NOTE);
    expect(isAssessmentWindow(meeting)).toBe(true);
    expect(locationLabel(meeting)).toBe("Reserved assessment window · location TBA");
    expect(visibleWeekdaysForMeetings([meeting])).toContain("Saturday");
  });

  test("preserves the assessment annotation through cloud schedule serialization", () => {
    const meeting = parseIcs(fixture).meetings[0]!;
    const restored = deserializeSchedule(serializeSchedule([meeting]))[0]!;

    expect(restored.notes).toBe(ASSESSMENT_WINDOW_NOTE);
    expect(isAssessmentWindow(restored)).toBe(true);
  });

  test("does not use a reserved assessment window as a gap boundary", () => {
    const meetings = parseIcs(fixtureWithClassBeforeReservedWindow).meetings;

    expect(meetings).toHaveLength(2);
    expect(meetings.some(isAssessmentWindow)).toBe(true);
    expect(findGaps(meetings, "Fall")).toEqual([]);
  });

  test("does not treat a reserved window as an active Today commitment", () => {
    const meeting = parseIcs(fixture).meetings[0]!;
    const state = buildTodayState({
      meetings: [meeting],
      selectedTerm: "Fall",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: unusedTransitionPlanner,
      now: new Date("2026-09-12T14:00:00-04:00"),
    });

    expect(state.kind).toBe("no-classes");
  });

  test("does not add reserved windows to campus day routes", () => {
    const meeting = parseIcs(fixture).meetings[0]!;

    expect(
      createCampusDayRouteStops([meeting], DEFAULT_USER_PREFERENCES, "Fall", "Saturday"),
    ).toEqual([]);
  });
});

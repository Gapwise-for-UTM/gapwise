import { test, expect } from "bun:test";
import { findGaps } from "@/lib/gaps";
import type { Meeting } from "@/lib/timetable-types";

function meeting(id: string, start: number, end: number, weekday = "Monday") {
  return {
    id,
    courseCode: `C-${id}`,
    activityType: "LEC",
    sectionCode: "",
    courseName: "Test",
    startTime: start,
    endTime: end,
    weekday,
    buildingCode: null,
    room: null,
    term: "Fall",
    locationUnknown: true,
  } as unknown as Meeting;
}

test("adding a personal fixed item splits a gap", () => {
  const meetings: Meeting[] = [meeting("a", 9 * 60, 11 * 60), meeting("b", 14 * 60, 15 * 60)];
  const gapsBefore = findGaps(meetings, "Fall");
  // There should be a gap between 11:00 and 14:00
  expect(gapsBefore.some((g) => g.startTime === 11 * 60 && g.endTime === 14 * 60)).toBe(true);

  // Add personal fixed meeting at 11:30-12:30
  const personalAsMeeting = {
    id: "p1",
    courseCode: "Study",
    activityType: "OTHER",
    sectionCode: "PERSONAL",
    courseName: "Study",
    startTime: 11 * 60 + 30,
    endTime: 12 * 60 + 30,
    weekday: "Monday",
    buildingCode: null,
    room: null,
    term: "Fall",
    locationUnknown: true,
  } as unknown as Meeting;

  const combined = meetings.concat(personalAsMeeting);
  const gapsAfter = findGaps(combined, "Fall");
  // The original gap 11:00-14:00 should be split; ensure no gap equal to original
  expect(gapsAfter.some((g) => g.startTime === 11 * 60 && g.endTime === 14 * 60)).toBe(false);
  // There should be a gap from 12:30 to 14:00
  expect(gapsAfter.some((g) => g.startTime === 12 * 60 + 30 && g.endTime === 14 * 60)).toBe(true);
});

test("deleting a personal item removes it from the personal item list", () => {
  const personalItems = [
    { id: "p1", title: "Study", category: "Study", term: "Fall", weekday: "Monday", startTime: 540, endTime: 600, locationBuildingCode: null, locationRoom: null, locationText: null, notes: null, flexibility: { kind: "fixed" }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "p2", title: "Workout", category: "Exercise", term: "Fall", weekday: "Monday", startTime: 660, endTime: 720, locationBuildingCode: null, locationRoom: null, locationText: null, notes: null, flexibility: { kind: "fixed" }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];

  const next = personalItems.filter((item) => item.id !== "p1");
  expect(next).toHaveLength(1);
  expect(next[0].id).toBe("p2");
});

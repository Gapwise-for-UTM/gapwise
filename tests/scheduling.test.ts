import {
  snapToIncrement,
  createDraft,
  moveItem,
  resizeItem,
  detectConflicts,
} from "@/lib/personal-scheduler";

import type { PersonalItem } from "@/lib/personal-types";

import type { Meeting } from "@/lib/timetable-types";
test("snapToIncrement snaps to 15 minutes", () => {
  expect(snapToIncrement(7)).toBe(0);
  expect(snapToIncrement(8)).toBe(15);
  expect(snapToIncrement(22)).toBe(15);
  expect(snapToIncrement(30)).toBe(30);
  expect(snapToIncrement(37)).toBe(30);
});

test("createDraft orders and snaps start/end", () => {
  const d = createDraft("Tuesday", 62, 143);
  expect(d.weekday).toBe("Tuesday");
  expect(d.startTime % 15).toBe(0);
  expect(d.endTime % 15).toBe(0);
  expect(d.endTime).toBeGreaterThan(d.startTime);
});

test("moveItem preserves duration and snaps", () => {
  const item: PersonalItem = {
    id: "p1",
    title: "Study",
    category: "Study",
    term: "Fall",
    weekday: "Monday",
    startTime: 9 * 60,
    endTime: 10 * 60,
    locationBuildingCode: null,
    locationRoom: null,
    locationText: null,
    notes: null,
    flexibility: { kind: "fixed" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const moved = moveItem(item, "Wednesday", 13 * 60 + 7);
  expect(moved.weekday).toBe("Wednesday");
  expect(moved.startTime % 15).toBe(0);
  expect(moved.endTime - moved.startTime).toBe(item.endTime! - item.startTime!);
});

test("resizeItem enforces minimum duration and snaps", () => {
  const item: PersonalItem = {
    id: "p2",
    title: "Meet",
    category: "Appointment",
    term: "Fall",
    weekday: "Friday",
    startTime: 12 * 60,
    endTime: 13 * 60,
    locationBuildingCode: null,
    locationRoom: null,
    locationText: null,
    notes: null,
    flexibility: { kind: "fixed" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const resized = resizeItem(item, 12 * 60 + 7, 12 * 60 + 10);
  expect(resized.startTime % 15).toBe(0);
  expect(resized.endTime - resized.startTime).toBeGreaterThanOrEqual(15);
});

test("moveItem snaps to 15-minute increments and preserves duration", () => {
  const item: PersonalItem = {
    id: "p3",
    title: "Study",
    category: "Study",
    term: "Fall",
    weekday: "Monday",
    startTime: 9 * 60,
    endTime: 10 * 60,
    locationBuildingCode: null,
    locationRoom: null,
    locationText: null,
    notes: null,
    flexibility: { kind: "fixed" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const moved = moveItem(item, "Wednesday", 13 * 60 + 7);
  expect(moved.weekday).toBe("Wednesday");
  expect(moved.startTime % 15).toBe(0);
  expect(moved.endTime - moved.startTime).toBe(item.endTime! - item.startTime!);
});

test("detectConflicts finds overlapping meetings", () => {
  const meetings: Meeting[] = [
    {
      id: "m1",
      courseCode: "A",
      activityType: "OTHER",
      sectionCode: "",
      courseName: "A",
      weekday: "Monday",
      startTime: 9 * 60,
      endTime: 10 * 60,
      buildingCode: null,
      room: null,
      term: "Fall",
      locationUnknown: true,
    },
    {
      id: "m2",
      courseCode: "B",
      activityType: "OTHER",
      sectionCode: "",
      courseName: "B",
      weekday: "Monday",
      startTime: 11 * 60,
      endTime: 12 * 60,
      buildingCode: null,
      room: null,
      term: "Fall",
      locationUnknown: true,
    },
  ];
  const conflicts = detectConflicts(
    { weekday: "Monday", startTime: 9 * 60 + 30, endTime: 10 * 60 + 15 },
    meetings,
  );
  expect(conflicts.length).toBeGreaterThan(0);
});

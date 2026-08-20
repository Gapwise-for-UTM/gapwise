import { expect, test } from "bun:test";
import { findGaps } from "@/lib/gaps";
import {
  availableScheduleTerms,
  composeSchedule,
  composeTermSchedule,
  fixedPersonalItemToMeeting,
} from "@/lib/personal-scheduler";
import {
  createFixedPersonalItem,
  deletePersonalItem,
  movePersonalItem,
  resizePersonalItem,
  upsertPersonalItem,
} from "@/features/personal/operations";
import type { PersonalItem } from "@/lib/personal-types";
import type { Meeting } from "@/lib/timetable-types";

function meeting(
  id: string,
  start: number,
  end: number,
  weekday: Meeting["weekday"] = "Monday",
  term: Meeting["term"] = "Fall",
): Meeting {
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
    term,
    locationUnknown: true,
  };
}

function personalItem(overrides: Partial<PersonalItem> = {}): PersonalItem {
  return {
    id: "p1",
    title: "Study block",
    category: "Study",
    term: "Fall",
    weekday: "Monday",
    startTime: 11 * 60 + 30,
    endTime: 12 * 60 + 30,
    locationBuildingCode: "MN",
    locationRoom: "1210",
    locationText: "Maanjiwe nendamowinan",
    notes: "Bring problem set",
    color: "#5b21b6",
    flexibility: { kind: "fixed" },
    createdAt: "2026-08-20T12:00:00.000Z",
    updatedAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

test("fixedPersonalItemToMeeting preserves fixed personal schedule fields", () => {
  expect(fixedPersonalItemToMeeting(personalItem())).toEqual({
    id: "p1",
    courseCode: "Study block",
    activityType: "OTHER",
    sectionCode: "PERSONAL",
    courseName: "Study",
    startTime: 11 * 60 + 30,
    endTime: 12 * 60 + 30,
    weekday: "Monday",
    buildingCode: "MN",
    room: "1210",
    term: "Fall",
    locationUnknown: false,
    notes: "Bring problem set",
    color: "#5b21b6",
  });
});

test("fixedPersonalItemToMeeting treats either building or room as a known location", () => {
  const buildingOnly = fixedPersonalItemToMeeting(
    personalItem({ locationBuildingCode: "MN", locationRoom: null }),
  );
  const roomOnly = fixedPersonalItemToMeeting(
    personalItem({ locationBuildingCode: null, locationRoom: "1210" }),
  );

  expect(buildingOnly?.locationUnknown).toBe(false);
  expect(roomOnly?.locationUnknown).toBe(false);
});

test("fixedPersonalItemToMeeting keeps an absent location unknown", () => {
  const converted = fixedPersonalItemToMeeting(
    personalItem({ locationBuildingCode: null, locationRoom: null }),
  );
  expect(converted?.locationUnknown).toBe(true);
});

test("fixedPersonalItemToMeeting rejects fixed items missing a time boundary", () => {
  const source = personalItem();
  const { startTime: _startTime, ...withoutStart } = source;
  const { endTime: _endTime, ...withoutEnd } = source;

  expect(fixedPersonalItemToMeeting(withoutStart)).toBeNull();
  expect(fixedPersonalItemToMeeting(withoutEnd)).toBeNull();
});

test("fixedPersonalItemToMeeting rejects flexible items", () => {
  expect(
    fixedPersonalItemToMeeting(
      personalItem({
        flexibility: { kind: "flexible", durationMinutes: 60 },
      }),
    ),
  ).toBeNull();
});

test("composeTermSchedule includes only selected-term academic and fixed personal items", () => {
  const academic = [
    meeting("fall", 9 * 60, 10 * 60, "Monday", "Fall"),
    meeting("winter", 9 * 60, 10 * 60, "Tuesday", "Winter"),
  ];
  const personal = [
    personalItem({ id: "fixed-fall" }),
    personalItem({
      id: "flexible-fall",
      flexibility: { kind: "flexible", durationMinutes: 60 },
    }),
    personalItem({ id: "fixed-winter", term: "Winter" }),
  ];

  expect(composeTermSchedule(academic, personal, "Fall").map((item) => item.id)).toEqual([
    "fall",
    "fixed-fall",
  ]);
});

test("composeTermSchedule does not mutate source schedule data", () => {
  const academic = [meeting("a", 9 * 60, 10 * 60)];
  const personal = [personalItem()];
  const academicBefore = JSON.stringify(academic);
  const personalBefore = JSON.stringify(personal);

  composeTermSchedule(academic, personal, "Fall");

  expect(JSON.stringify(academic)).toBe(academicBefore);
  expect(JSON.stringify(personal)).toBe(personalBefore);
});

test("composeSchedule exposes one normalized all-term context without flexible items", () => {
  const academic = [
    meeting("fall", 9 * 60, 10 * 60),
    meeting("winter", 9 * 60, 10 * 60, "Tuesday", "Winter"),
  ];
  const personal = [
    personalItem({ id: "fixed" }),
    personalItem({ id: "flexible", flexibility: { kind: "flexible", durationMinutes: 60 } }),
  ];

  expect(composeSchedule(academic, personal).map((item) => item.id)).toEqual([
    "fall",
    "winter",
    "fixed",
  ]);
  expect(availableScheduleTerms(composeSchedule(academic, personal))).toEqual(["Fall", "Winter"]);
});

test("adding a personal fixed item splits a gap", () => {
  const meetings: Meeting[] = [meeting("a", 9 * 60, 11 * 60), meeting("b", 14 * 60, 15 * 60)];
  const gapsBefore = findGaps(meetings, "Fall");
  expect(gapsBefore.some((gap) => gap.startTime === 11 * 60 && gap.endTime === 14 * 60)).toBe(true);

  const personalMeeting = fixedPersonalItemToMeeting(personalItem());
  expect(personalMeeting).not.toBeNull();
  const combined = personalMeeting ? meetings.concat(personalMeeting) : meetings;
  const gapsAfter = findGaps(combined, "Fall");

  expect(gapsAfter.some((gap) => gap.startTime === 11 * 60 && gap.endTime === 14 * 60)).toBe(false);
  expect(gapsAfter.some((gap) => gap.startTime === 12 * 60 + 30 && gap.endTime === 14 * 60)).toBe(
    true,
  );
});

test("deleting a personal item removes it from the personal item list", () => {
  const personalItems = [
    personalItem({ id: "p1" }),
    personalItem({ id: "p2", title: "Workout", category: "Exercise" }),
  ];

  const next = deletePersonalItem(personalItems, "p1");
  expect(next).toHaveLength(1);
  expect(next[0]?.id).toBe("p2");
});

test("upserting personal items appends new records and replaces matching records in place", () => {
  const first = personalItem({ id: "p1" });
  const second = personalItem({ id: "p2", title: "Workout" });

  expect(upsertPersonalItem([first], second)).toEqual([first, second]);
  expect(upsertPersonalItem([first, second], { ...first, title: "Focused study" })).toEqual([
    { ...first, title: "Focused study" },
    second,
  ]);
});

test("personal timing operations preserve identity and record their update time", () => {
  const source = personalItem();
  const moved = movePersonalItem(source, "Wednesday", 13 * 60, 14 * 60, "moved-at");
  const resized = resizePersonalItem(moved, 13 * 60, 14 * 60 + 30, "resized-at");

  expect(moved).toMatchObject({
    id: source.id,
    weekday: "Wednesday",
    startTime: 13 * 60,
    endTime: 14 * 60,
    updatedAt: "moved-at",
  });
  expect(resized).toMatchObject({
    id: source.id,
    startTime: 13 * 60,
    endTime: 14 * 60 + 30,
    updatedAt: "resized-at",
  });
  expect(source.weekday).toBe("Monday");
});

test("fixed personal creation defaults are owned by the personal domain boundary", () => {
  expect(
    createFixedPersonalItem({
      id: "created",
      term: "Fall",
      weekday: "Tuesday",
      startTime: 600,
      endTime: 660,
      timestamp: "created-at",
    }),
  ).toMatchObject({
    id: "created",
    title: "New",
    category: "Personal",
    flexibility: { kind: "fixed" },
    createdAt: "created-at",
    updatedAt: "created-at",
  });
});

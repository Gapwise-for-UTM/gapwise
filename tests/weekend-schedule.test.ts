import { meetingOccursOnDate } from "@/lib/calendar-awareness";
import { findGaps } from "@/lib/gaps";
import { parseIcs } from "@/lib/ics-parser";
import { buildTimetableModel } from "@/lib/timetable-layout";
import { type Meeting, visibleWeekdaysForMeetings, weekdayForDate } from "@/lib/timetable-types";
import { createTimetableExportPlan, renderTimetableExportSvg } from "@/lib/timetable-export";

const meeting = (
  id: string,
  weekday: Meeting["weekday"],
  startTime: number,
  endTime: number,
): Meeting => ({
  id,
  courseCode: id.toUpperCase(),
  activityType: "LEC",
  sectionCode: "0101",
  courseName: `Synthetic ${id}`,
  startTime,
  endTime,
  weekday,
  buildingCode: "IB",
  room: "110",
  term: "Fall",
  locationUnknown: false,
  locationType: "physical",
});

test("canonical date mapping covers Saturday and Sunday", () => {
  expect(weekdayForDate(new Date(2026, 8, 5, 12))).toBe("Saturday");
  expect(weekdayForDate(new Date(2026, 8, 6, 12))).toBe("Sunday");
});

test("ACORN-style weekly recurrence preserves Saturday and Sunday", () => {
  const parsed = parseIcs(
    `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:weekend-csc110\r\nDTSTART;TZID=America/Toronto:20260905T100000\r\nDTEND;TZID=America/Toronto:20260905T110000\r\nRRULE:FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=20260913T140000Z\r\nSUMMARY:CSC110Y5 LEC 0101\r\nDESCRIPTION:Foundations of Computer Science\r\nLOCATION:IB 110\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`,
  );
  expect(parsed.meetings.map((item) => item.weekday)).toEqual(["Saturday", "Sunday"]);
  expect(parsed.warnings.join(" ").toLowerCase()).not.toContain("weekend");
});

test("weekday presentation stays five days until a weekend is actually scheduled", () => {
  expect(visibleWeekdaysForMeetings([meeting("mon", "Monday", 540, 600)])).toEqual([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);
  expect(visibleWeekdaysForMeetings([meeting("sat", "Saturday", 540, 600)])).toEqual([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]);
  expect(
    visibleWeekdaysForMeetings([
      meeting("sat", "Saturday", 540, 600),
      meeting("sun", "Sunday", 660, 720),
    ]),
  ).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
});

test("timetable layout and gap detection include weekend meetings", () => {
  const meetings = [
    meeting("sat-a", "Saturday", 9 * 60, 10 * 60),
    meeting("sat-b", "Saturday", 12 * 60, 13 * 60),
  ];
  const model = buildTimetableModel(meetings);
  expect(model.days.get("Saturday")?.sorted).toHaveLength(2);
  const gaps = findGaps(meetings, "Fall");
  expect(gaps).toHaveLength(1);
  expect(gaps[0]?.weekday).toBe("Saturday");
  expect(gaps[0]?.durationMinutes).toBe(120);
});

test("recurrence awareness recognizes weekend dates", () => {
  const saturday = {
    ...meeting("sat", "Saturday", 600, 660),
    dateRange: { startDate: "2026-09-05", endDate: "2026-09-19" },
    recurrenceIntervalWeeks: 1,
  };
  const sunday = {
    ...meeting("sun", "Sunday", 600, 660),
    dateRange: { startDate: "2026-09-06", endDate: "2026-09-20" },
    recurrenceIntervalWeeks: 1,
  };
  expect(meetingOccursOnDate(saturday, new Date(2026, 8, 12, 12))).toBe(true);
  expect(meetingOccursOnDate(sunday, new Date(2026, 8, 13, 12))).toBe(true);
});

test("PNG export keeps workweek unchanged and adds only scheduled weekend columns", () => {
  const weekdayMeetings = [meeting("mon", "Monday", 540, 600)];
  const workweekPlan = createTimetableExportPlan(weekdayMeetings, "Fall", 2);
  const workweekSvg = renderTimetableExportSvg(weekdayMeetings, workweekPlan);
  expect(workweekSvg).toContain(">MON<");
  expect(workweekSvg).not.toContain(">SAT<");
  expect(workweekSvg).not.toContain(">SUN<");

  const weekendMeetings = [
    ...weekdayMeetings,
    meeting("sat", "Saturday", 600, 660),
    meeting("sun", "Sunday", 720, 780),
  ];
  const weekendPlan = createTimetableExportPlan(weekendMeetings, "Fall", 2);
  const weekendSvg = renderTimetableExportSvg(weekendMeetings, weekendPlan);
  expect(weekendSvg).toContain(">SAT<");
  expect(weekendSvg).toContain(">SUN<");
});

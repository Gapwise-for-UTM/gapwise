import type { AcademicState } from "./state";
import { addDate, torontoDateForInstant } from "./windows";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";

const weekday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "long" });
const clock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function minute(date: Date) {
  const parts = Object.fromEntries(
    clock.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return (Number(parts["hour"]) % 24) * 60 + Number(parts["minute"]);
}

export function plannedWorkMeetings(state: AcademicState, term: Term, now = new Date()): Meeting[] {
  const today = torontoDateForInstant(now);
  const endDate = addDate(today, 6);
  return state.blocks
    .filter((block) => {
      if (!["accepted", "completed"].includes(block.status)) return false;
      const date = torontoDateForInstant(block.start);
      return date >= today && date <= endDate;
    })
    .map((block) => {
      const item = state.coursework.find((candidate) => candidate.id === block.courseworkId);
      const start = new Date(block.start);
      const end = new Date(block.end);
      const date = torontoDateForInstant(start);
      return {
        id: block.id,
        courseCode: item?.courseCode ?? "Study",
        courseName: item?.title ?? "Planned work",
        activityType: "OTHER",
        sectionCode: "STUDY",
        startTime: minute(start),
        endTime: minute(end),
        weekday: weekday.format(start) as Weekday,
        buildingCode: null,
        room: null,
        term,
        locationUnknown: true,
        color: "var(--color-accent)",
        notes: `${block.allocatedMinutes}m ${block.status}`,
        dateRange: { startDate: date, endDate: date },
      };
    });
}

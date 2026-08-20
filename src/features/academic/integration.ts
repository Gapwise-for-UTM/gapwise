import type { AcademicState } from "./state";
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

export function plannedWorkMeetings(state: AcademicState, term: Term): Meeting[] {
  return state.blocks
    .filter((block) => ["accepted", "completed"].includes(block.status))
    .map((block) => {
      const item = state.coursework.find((candidate) => candidate.id === block.courseworkId);
      const start = new Date(block.start),
        end = new Date(block.end);
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
        dateRange: { startDate: block.start.slice(0, 10), endDate: block.start.slice(0, 10) },
      };
    });
}

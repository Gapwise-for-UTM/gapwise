import type { Meeting, Weekday } from "@/lib/timetable-types";
import { WEEKDAYS } from "@/lib/timetable-types";

type DayLayout = {
  laneCount: number;
  placement: Map<string, number>;
  sorted: Meeting[];
};

/** Hides optional detail when a short or narrow card cannot display four readable lines. */
export function isCompactMeetingCard(meeting: Meeting, laneCount: number): boolean {
  return laneCount > 1 || meeting.endTime - meeting.startTime <= 60;
}

/** Assigns overlapping meetings to side-by-side lanes so nothing visually collides. */
function layout(day: Meeting[]): DayLayout {
  const sorted = [...day].sort((a, b) => a.startTime - b.startTime);
  const lanes: Meeting[][] = [];
  const placement = new Map<string, number>();
  for (const meeting of sorted) {
    let laneIndex = lanes.findIndex(
      (lane) => (lane[lane.length - 1]?.endTime ?? 0) <= meeting.startTime,
    );
    if (laneIndex === -1) {
      lanes.push([]);
      laneIndex = lanes.length - 1;
    }
    lanes[laneIndex]!.push(meeting);
    placement.set(meeting.id, laneIndex);
  }
  return { laneCount: Math.max(1, lanes.length), placement, sorted };
}

export function buildTimetableModel(meetings: Meeting[]) {
  const meetingsByDay = new Map<Weekday, Meeting[]>(WEEKDAYS.map((weekday) => [weekday, []]));
  let earliestMinute = Number.POSITIVE_INFINITY;
  let latestMinute = Number.NEGATIVE_INFINITY;

  for (const meeting of meetings) {
    meetingsByDay.get(meeting.weekday)!.push(meeting);
    earliestMinute = Math.min(earliestMinute, meeting.startTime);
    latestMinute = Math.max(latestMinute, meeting.endTime);
  }

  if (meetings.length === 0) {
    return {
      startHour: 7,
      hours: [] as number[],
      days: new Map(WEEKDAYS.map((weekday) => [weekday, layout([])])),
    };
  }

  const startHour = Math.max(7, Math.floor(earliestMinute / 60) - 1);
  const endHour = Math.min(23, Math.ceil(latestMinute / 60) + 1);
  const hours = Array.from({ length: Math.max(0, endHour - startHour) }, (_, i) => startHour + i);
  const days = new Map(
    WEEKDAYS.map((weekday) => [weekday, layout(meetingsByDay.get(weekday)!)] as const),
  );
  return { startHour, hours, days };
}

import type { PersonalItem } from "./personal-types";
import type { Meeting, Term } from "./timetable-types";

export function fixedPersonalItemToMeeting(item: PersonalItem): Meeting | null {
  if (
    item.flexibility.kind !== "fixed" ||
    item.startTime === undefined ||
    item.endTime === undefined
  ) {
    return null;
  }

  const meeting: Meeting = {
    id: item.id,
    courseCode: item.title,
    activityType: "OTHER",
    sectionCode: "PERSONAL",
    courseName: item.category,
    startTime: item.startTime,
    endTime: item.endTime,
    weekday: item.weekday,
    buildingCode: item.locationBuildingCode ?? null,
    room: item.locationRoom ?? null,
    term: item.term,
    locationUnknown: !(item.locationBuildingCode || item.locationRoom),
  };

  if (item.notes !== undefined && item.notes !== null) meeting.notes = item.notes;
  if (item.color !== undefined) meeting.color = item.color;

  return meeting;
}

export function composeTermSchedule(
  meetings: readonly Meeting[],
  personalItems: readonly PersonalItem[],
  term: Term,
): Meeting[] {
  const academic = meetings.filter((meeting) => meeting.term === term);
  const personal = personalItems
    .filter((item) => item.term === term)
    .map(fixedPersonalItemToMeeting)
    .filter((meeting): meeting is Meeting => meeting !== null);

  return [...academic, ...personal];
}

export function snapToIncrement(minute: number, increment = 15) {
  return Math.round(minute / increment) * increment;
}

export function createDraft(weekday: string, start: number, end: number) {
  const s = snapToIncrement(start);
  const e = snapToIncrement(end);
  return { weekday, startTime: Math.min(s, e), endTime: Math.max(s, e) };
}

type MovableItem =
  | Pick<Meeting, "id" | "weekday" | "startTime" | "endTime">
  | Pick<PersonalItem, "id" | "weekday" | "startTime" | "endTime">;

type FixedMovableItem = Extract<MovableItem, { startTime: number; endTime: number }>;

export function moveItem<T extends FixedMovableItem>(item: T, weekday: string, start: number) {
  const duration = item.endTime - item.startTime;
  const s = snapToIncrement(start);
  return {
    ...item,
    weekday: weekday as typeof item.weekday,
    startTime: s,
    endTime: s + Math.max(15, duration),
  };
}

export function resizeItem<T extends FixedMovableItem>(item: T, newStart: number, newEnd: number) {
  const s = snapToIncrement(newStart);
  const e = snapToIncrement(newEnd);
  const minDur = 15;
  const finalEnd = Math.max(e, s + minDur);
  return { ...item, startTime: s, endTime: finalEnd };
}

export function detectConflicts(
  candidate: { weekday: string; startTime: number; endTime: number },
  meetings: Array<Meeting | PersonalItem>,
) {
  const conflicts: string[] = [];
  for (const m of meetings) {
    const w = (m as Meeting | PersonalItem).weekday;
    if (w !== candidate.weekday) continue;
    const s = (m as Meeting | PersonalItem).startTime ?? 0;
    const e = (m as Meeting | PersonalItem).endTime ?? 0;
    if (!(candidate.endTime <= s || candidate.startTime >= e)) {
      const label = (m as Meeting).courseCode ?? (m as PersonalItem).title ?? "Event";
      const startLabel = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
      const endLabel = `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
      conflicts.push(`${label}, ${startLabel}–${endLabel}`);
    }
  }
  return conflicts;
}

export default {};

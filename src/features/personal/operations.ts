import type { PersonalItem } from "@/lib/personal-types";
import type { Term, Weekday } from "@/lib/timetable-types";

export function upsertPersonalItem(
  items: readonly PersonalItem[],
  item: PersonalItem,
): PersonalItem[] {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) return [...items, item];
  return items.map((candidate, candidateIndex) => (candidateIndex === index ? item : candidate));
}

export function deletePersonalItem(items: readonly PersonalItem[], id: string): PersonalItem[] {
  return items.filter((item) => item.id !== id);
}

export function createFixedPersonalItem(input: {
  id: string;
  term: Term;
  weekday: Weekday;
  startTime: number;
  endTime: number;
  timestamp: string;
}): PersonalItem {
  return {
    id: input.id,
    title: "New",
    category: "Personal",
    term: input.term,
    weekday: input.weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    locationBuildingCode: null,
    locationRoom: null,
    locationText: null,
    notes: null,
    color: "#5b21b6",
    flexibility: { kind: "fixed" },
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };
}

export function movePersonalItem(
  item: PersonalItem,
  weekday: Weekday,
  startTime: number,
  endTime: number,
  updatedAt: string,
): PersonalItem {
  return { ...item, weekday, startTime, endTime, updatedAt };
}

export function resizePersonalItem(
  item: PersonalItem,
  startTime: number,
  endTime: number,
  updatedAt: string,
): PersonalItem {
  return { ...item, startTime, endTime, updatedAt };
}

import { Weekday, Term } from "./timetable-types";

export type PersonalCategory =
  | "Study"
  | "Food"
  | "Exercise"
  | "Club"
  | "Work"
  | "Commute"
  | "Appointment"
  | "Break"
  | "Personal"
  | "Other";

export type PersonalFlexibility =
  | { kind: "fixed" }
  | { kind: "flexible"; durationMinutes: number; windowStart?: number; windowEnd?: number };

export interface PersonalItem {
  id: string;
  title: string;
  category: PersonalCategory;
  term: Term;
  weekday: Weekday;
  startTime?: number; // minutes from midnight; present for fixed items
  endTime?: number; // minutes from midnight; present for fixed items
  locationBuildingCode?: string | null;
  locationRoom?: string | null;
  locationText?: string | null;
  notes?: string | null;
  color?: string;
  flexibility: PersonalFlexibility;
  createdAt: string;
  updatedAt: string;
}

export function isFixed(item: PersonalItem) {
  return item.flexibility.kind === "fixed";
}

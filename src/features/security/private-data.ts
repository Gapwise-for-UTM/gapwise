import { sanitizeGapPreferences } from "@/features/gaps/preferences";
import type { GapPreferences } from "@/features/gaps/types";
import type { PersonalCategory, PersonalItem } from "@/lib/personal-types";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";
import { TERMS, WEEKDAYS } from "@/lib/timetable-types";
import { deserializeSchedule, serializeSchedule } from "@/features/sync/schedule-serialization";
import { sanitizeUserPreferences, type UserPreferences } from "@/features/sync/preferences";
import { PRIVATE_DATA_SCHEMA_VERSION } from "./crypto-context.js";

const PERSONAL_CATEGORIES: PersonalCategory[] = [
  "Study",
  "Food",
  "Exercise",
  "Club",
  "Work",
  "Commute",
  "Appointment",
  "Break",
  "Personal",
  "Other",
];
const MAX_PERSONAL_ITEMS = 200;
const MAX_SHORT_TEXT = 240;
const MAX_NOTES_TEXT = 2_000;

export type PrivateDataPayloadV1 = {
  schemaVersion: typeof PRIVATE_DATA_SCHEMA_VERSION;
  schedule: Meeting[];
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
};

const PRIVATE_PAYLOAD_KEYS = [
  "schemaVersion",
  "schedule",
  "personalItems",
  "preferences",
  "gapPreferences",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function optionalText(value: unknown, maximum: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.length > maximum) {
    throw new Error("Private item contains invalid text.");
  }
  return value;
}

function requiredText(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum) {
    throw new Error("Private item contains invalid text.");
  }
  return value;
}

function minute(value: unknown, optional = false): number | undefined {
  if (optional && value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 24 * 60) {
    throw new Error("Private item contains an invalid time.");
  }
  return value as number;
}

function validatePersonalItem(value: unknown): PersonalItem {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "title",
      "category",
      "term",
      "weekday",
      "startTime",
      "endTime",
      "locationBuildingCode",
      "locationRoom",
      "locationText",
      "notes",
      "color",
      "flexibility",
      "createdAt",
      "updatedAt",
    ])
  ) {
    throw new Error("Private item is malformed.");
  }
  const term = value["term"] as Term;
  const weekday = value["weekday"] as Weekday;
  const category = value["category"] as PersonalCategory;
  const flexibility = value["flexibility"];
  if (
    !TERMS.includes(term) ||
    !WEEKDAYS.includes(weekday) ||
    !PERSONAL_CATEGORIES.includes(category) ||
    !isRecord(flexibility)
  ) {
    throw new Error("Private item is malformed.");
  }

  let normalizedFlexibility: PersonalItem["flexibility"];
  let startTime = minute(value["startTime"], true);
  let endTime = minute(value["endTime"], true);
  if (flexibility["kind"] === "fixed" && hasOnlyKeys(flexibility, ["kind"])) {
    if (startTime === undefined || endTime === undefined || endTime <= startTime) {
      throw new Error("Fixed private item contains an invalid time.");
    }
    normalizedFlexibility = { kind: "fixed" };
  } else if (
    flexibility["kind"] === "flexible" &&
    hasOnlyKeys(flexibility, ["kind", "durationMinutes", "windowStart", "windowEnd"])
  ) {
    const durationMinutes = flexibility["durationMinutes"];
    const windowStart = minute(flexibility["windowStart"], true);
    const windowEnd = minute(flexibility["windowEnd"], true);
    if (
      !Number.isInteger(durationMinutes) ||
      (durationMinutes as number) < 1 ||
      (durationMinutes as number) > 24 * 60 ||
      (windowStart !== undefined && windowEnd !== undefined && windowEnd <= windowStart)
    ) {
      throw new Error("Flexible private item contains an invalid window.");
    }
    normalizedFlexibility = { kind: "flexible", durationMinutes: durationMinutes as number };
    if (windowStart !== undefined) normalizedFlexibility.windowStart = windowStart;
    if (windowEnd !== undefined) normalizedFlexibility.windowEnd = windowEnd;
    startTime = undefined;
    endTime = undefined;
  } else {
    throw new Error("Private item contains invalid flexibility.");
  }

  const item: PersonalItem = {
    id: requiredText(value["id"], MAX_SHORT_TEXT),
    title: requiredText(value["title"], MAX_SHORT_TEXT),
    category,
    term,
    weekday,
    flexibility: normalizedFlexibility,
    createdAt: requiredText(value["createdAt"], 64),
    updatedAt: requiredText(value["updatedAt"], 64),
  };
  if (startTime !== undefined) item.startTime = startTime;
  if (endTime !== undefined) item.endTime = endTime;
  const locationBuildingCode = optionalText(value["locationBuildingCode"], MAX_SHORT_TEXT);
  const locationRoom = optionalText(value["locationRoom"], MAX_SHORT_TEXT);
  const locationText = optionalText(value["locationText"], MAX_SHORT_TEXT);
  const notes = optionalText(value["notes"], MAX_NOTES_TEXT);
  const color = optionalText(value["color"], 32);
  if (locationBuildingCode !== undefined) item.locationBuildingCode = locationBuildingCode;
  if (locationRoom !== undefined) item.locationRoom = locationRoom;
  if (locationText !== undefined) item.locationText = locationText;
  if (notes !== undefined) item.notes = notes;
  if (color !== undefined && color !== null) item.color = color;
  return item;
}

function requireCanonicalPreferences(value: unknown): UserPreferences {
  if (!isRecord(value)) throw new Error("Private preferences are malformed.");
  const sanitized = sanitizeUserPreferences(value as Partial<UserPreferences>);
  for (const [key, expected] of Object.entries(sanitized)) {
    if (value[key] !== expected) throw new Error("Private preferences are malformed.");
  }
  if (!hasOnlyKeys(value, Object.keys(sanitized))) {
    throw new Error("Private preferences contain unsupported fields.");
  }
  return sanitized;
}

function requireCanonicalGapPreferences(value: unknown): GapPreferences {
  if (!isRecord(value)) throw new Error("Private gap preferences are malformed.");
  const sanitized = sanitizeGapPreferences(value as Partial<GapPreferences>);
  for (const [key, expected] of Object.entries(sanitized)) {
    if (value[key] !== expected) throw new Error("Private gap preferences are malformed.");
  }
  if (!hasOnlyKeys(value, Object.keys(sanitized))) {
    throw new Error("Private gap preferences contain unsupported fields.");
  }
  return sanitized;
}

export function createPrivateDataPayload(input: {
  schedule: Meeting[];
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
}): PrivateDataPayloadV1 {
  if (input.personalItems.length > MAX_PERSONAL_ITEMS) {
    throw new Error("Private data payload exceeds the personal item cap.");
  }
  return {
    schemaVersion: PRIVATE_DATA_SCHEMA_VERSION,
    schedule: deserializeSchedule(serializeSchedule(input.schedule)),
    personalItems: input.personalItems.map(validatePersonalItem),
    preferences: requireCanonicalPreferences(input.preferences),
    gapPreferences: requireCanonicalGapPreferences(input.gapPreferences),
  };
}

export function validatePrivateDataPayload(value: unknown): PrivateDataPayloadV1 {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, PRIVATE_PAYLOAD_KEYS) ||
    !PRIVATE_PAYLOAD_KEYS.every((key) => Object.hasOwn(value, key)) ||
    value["schemaVersion"] !== PRIVATE_DATA_SCHEMA_VERSION ||
    !Array.isArray(value["personalItems"]) ||
    value["personalItems"].length > MAX_PERSONAL_ITEMS
  ) {
    throw new Error("Private data payload is malformed.");
  }
  return {
    schemaVersion: PRIVATE_DATA_SCHEMA_VERSION,
    schedule: deserializeSchedule(value["schedule"]),
    personalItems: value["personalItems"].map(validatePersonalItem),
    preferences: requireCanonicalPreferences(value["preferences"]),
    gapPreferences: requireCanonicalGapPreferences(value["gapPreferences"]),
  };
}

import { sanitizeGapPreferences } from "@/features/gaps/preferences";
import type { GapPreferences } from "@/features/gaps/types";
import type { PersonalCategory, PersonalFlexibility, PersonalItem } from "@/lib/personal-types";
import { TERMS, WEEKDAYS, type Term, type Weekday } from "@/lib/timetable-types";
import type { AiAction, PendingAiAction, PersonalItemDraft, PersonalItemPatch } from "./types";

const CATEGORIES: PersonalCategory[] = [
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function shortText(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 240;
}

function optionalText(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === "string" && value.length <= 240);
}

function minute(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 24 * 60;
}

function isTerm(value: unknown): value is Term {
  return typeof value === "string" && TERMS.includes(value as Term);
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && WEEKDAYS.includes(value as Weekday);
}

function isCategory(value: unknown): value is PersonalCategory {
  return typeof value === "string" && CATEGORIES.includes(value as PersonalCategory);
}

function parseFlexibility(value: unknown): PersonalFlexibility | null {
  if (!isRecord(value)) return null;
  if (value.kind === "fixed" && exactKeys(value, ["kind"])) return { kind: "fixed" };
  if (
    value.kind === "flexible" &&
    exactKeys(value, ["kind", "durationMinutes", "windowStart", "windowEnd"]) &&
    Number.isInteger(value.durationMinutes) &&
    (value.durationMinutes as number) >= 1 &&
    (value.durationMinutes as number) <= 24 * 60 &&
    (value.windowStart === undefined || minute(value.windowStart)) &&
    (value.windowEnd === undefined || minute(value.windowEnd)) &&
    (value.windowStart === undefined ||
      value.windowEnd === undefined ||
      (value.windowEnd as number) > (value.windowStart as number))
  ) {
    const flexibility: PersonalFlexibility = {
      kind: "flexible",
      durationMinutes: value.durationMinutes as number,
    };
    if (value.windowStart !== undefined) flexibility.windowStart = value.windowStart as number;
    if (value.windowEnd !== undefined) flexibility.windowEnd = value.windowEnd as number;
    return flexibility;
  }
  return null;
}

function parseDraft(value: unknown): PersonalItemDraft | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "title",
      "category",
      "term",
      "weekday",
      "startTime",
      "endTime",
      "locationBuildingCode",
      "locationRoom",
      "locationText",
      "color",
      "flexibility",
    ]) ||
    !shortText(value.title) ||
    !isCategory(value.category) ||
    !isTerm(value.term) ||
    !isWeekday(value.weekday) ||
    !optionalText(value.locationBuildingCode) ||
    !optionalText(value.locationRoom) ||
    !optionalText(value.locationText) ||
    !(value.color === undefined || (typeof value.color === "string" && value.color.length <= 32))
  ) {
    return null;
  }
  const flexibility = parseFlexibility(value.flexibility);
  if (!flexibility) return null;
  if (flexibility.kind === "fixed") {
    if (!minute(value.startTime) || !minute(value.endTime) || value.endTime <= value.startTime) return null;
  } else if (value.startTime !== undefined || value.endTime !== undefined) {
    return null;
  }
  const draft: PersonalItemDraft = {
    title: value.title,
    category: value.category,
    term: value.term,
    weekday: value.weekday,
    flexibility,
  };
  if (value.startTime !== undefined) draft.startTime = value.startTime as number;
  if (value.endTime !== undefined) draft.endTime = value.endTime as number;
  if (value.locationBuildingCode !== undefined) draft.locationBuildingCode = value.locationBuildingCode as string | null;
  if (value.locationRoom !== undefined) draft.locationRoom = value.locationRoom as string | null;
  if (value.locationText !== undefined) draft.locationText = value.locationText as string | null;
  if (value.color !== undefined) draft.color = value.color;
  return draft;
}

function parsePatch(value: unknown): PersonalItemPatch | null {
  if (
    !isRecord(value) ||
    Object.keys(value).length === 0 ||
    !exactKeys(value, [
      "title",
      "category",
      "term",
      "weekday",
      "startTime",
      "endTime",
      "locationBuildingCode",
      "locationRoom",
      "locationText",
      "color",
      "flexibility",
    ])
  ) {
    return null;
  }
  if (value.title !== undefined && !shortText(value.title)) return null;
  if (value.category !== undefined && !isCategory(value.category)) return null;
  if (value.term !== undefined && !isTerm(value.term)) return null;
  if (value.weekday !== undefined && !isWeekday(value.weekday)) return null;
  if (value.startTime !== undefined && !minute(value.startTime)) return null;
  if (value.endTime !== undefined && !minute(value.endTime)) return null;
  if (!optionalText(value.locationBuildingCode) || !optionalText(value.locationRoom) || !optionalText(value.locationText)) return null;
  if (!(value.color === undefined || value.color === null || (typeof value.color === "string" && value.color.length <= 32))) return null;
  const flexibility = value.flexibility === undefined ? undefined : parseFlexibility(value.flexibility);
  if (value.flexibility !== undefined && !flexibility) return null;
  return value as PersonalItemPatch;
}

function parseGapPatch(value: unknown): Partial<GapPreferences> | null {
  if (!isRecord(value) || Object.keys(value).length === 0) return null;
  const allowed = [
    "setupMinutes",
    "packUpMinutes",
    "lunchWindowStart",
    "lunchWindowEnd",
    "mealDurationMinutes",
    "willingToLeaveCampus",
    "oneWayHomeCommuteMinutes",
    "minimumHomeStayMinutes",
    "homeTurnaroundMinutes",
    "riskTolerance",
  ] as const;
  if (!exactKeys(value, allowed)) return null;
  return value as Partial<GapPreferences>;
}

function parseAction(value: unknown): AiAction | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 1) return null;
  if (value.kind === "create_personal_item" && exactKeys(value, ["schemaVersion", "kind", "expectedRevision", "item"])) {
    const item = parseDraft(value.item);
    return item
      ? { schemaVersion: 1, kind: "create_personal_item", expectedRevision: value.expectedRevision as number, item }
      : null;
  }
  if (
    value.kind === "update_personal_item" &&
    exactKeys(value, ["schemaVersion", "kind", "expectedRevision", "itemId", "patch"]) &&
    shortText(value.itemId)
  ) {
    const patch = parsePatch(value.patch);
    return patch
      ? {
          schemaVersion: 1,
          kind: "update_personal_item",
          expectedRevision: value.expectedRevision as number,
          itemId: value.itemId,
          patch,
        }
      : null;
  }
  if (
    value.kind === "delete_personal_item" &&
    exactKeys(value, ["schemaVersion", "kind", "expectedRevision", "itemId"]) &&
    shortText(value.itemId)
  ) {
    return {
      schemaVersion: 1,
      kind: "delete_personal_item",
      expectedRevision: value.expectedRevision as number,
      itemId: value.itemId,
    };
  }
  if (
    value.kind === "update_gap_preferences" &&
    exactKeys(value, ["schemaVersion", "kind", "expectedRevision", "patch"])
  ) {
    const patch = parseGapPatch(value.patch);
    return patch
      ? {
          schemaVersion: 1,
          kind: "update_gap_preferences",
          expectedRevision: value.expectedRevision as number,
          patch,
        }
      : null;
  }
  return null;
}

export function parsePendingAiActions(value: unknown): PendingAiAction[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const parsed: PendingAiAction[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !shortText(entry.id) || typeof entry.createdAt !== "string") return null;
    const action = parseAction(entry.action);
    if (!action) return null;
    parsed.push({ id: entry.id, createdAt: entry.createdAt, action });
  }
  return parsed;
}

function buildPersonalItem(actionId: string, draft: PersonalItemDraft, now: string): PersonalItem {
  const item: PersonalItem = {
    id: `ai-${actionId}`,
    title: draft.title,
    category: draft.category,
    term: draft.term,
    weekday: draft.weekday,
    flexibility: { ...draft.flexibility },
    createdAt: now,
    updatedAt: now,
  };
  if (draft.startTime !== undefined) item.startTime = draft.startTime;
  if (draft.endTime !== undefined) item.endTime = draft.endTime;
  if (draft.locationBuildingCode !== undefined) item.locationBuildingCode = draft.locationBuildingCode;
  if (draft.locationRoom !== undefined) item.locationRoom = draft.locationRoom;
  if (draft.locationText !== undefined) item.locationText = draft.locationText;
  if (draft.color !== undefined) item.color = draft.color;
  return item;
}

function patchPersonalItem(item: PersonalItem, patch: PersonalItemPatch, now: string): PersonalItem | null {
  const next: PersonalItem = { ...item, ...patch, updatedAt: now };
  if (patch.flexibility) next.flexibility = { ...patch.flexibility };
  if (next.flexibility.kind === "fixed") {
    if (!minute(next.startTime) || !minute(next.endTime) || next.endTime <= next.startTime) return null;
  } else {
    delete next.startTime;
    delete next.endTime;
  }
  return next;
}

export type AiActionBatchResult = {
  personalItems: PersonalItem[];
  gapPreferences: GapPreferences;
  applied: string[];
  rejected: Array<{ id: string; code: string }>;
};

export function applyAiActionBatch(input: {
  actions: PendingAiAction[];
  revision: number;
  personalItems: PersonalItem[];
  gapPreferences: GapPreferences;
}): AiActionBatchResult {
  let personalItems = [...input.personalItems];
  let gapPreferences = input.gapPreferences;
  const applied: string[] = [];
  const rejected: Array<{ id: string; code: string }> = [];
  const now = new Date().toISOString();

  for (const pending of input.actions) {
    const action = pending.action;
    if (action.expectedRevision !== input.revision) {
      rejected.push({ id: pending.id, code: "stale_revision" });
      continue;
    }
    if (action.kind === "create_personal_item") {
      const id = `ai-${pending.id}`;
      if (!personalItems.some((item) => item.id === id)) {
        personalItems.push(buildPersonalItem(pending.id, action.item, now));
      }
      applied.push(pending.id);
      continue;
    }
    if (action.kind === "update_personal_item") {
      const index = personalItems.findIndex((item) => item.id === action.itemId);
      if (index < 0) {
        rejected.push({ id: pending.id, code: "personal_item_missing" });
        continue;
      }
      const next = patchPersonalItem(personalItems[index]!, action.patch, now);
      if (!next) {
        rejected.push({ id: pending.id, code: "invalid_personal_item" });
        continue;
      }
      personalItems[index] = next;
      applied.push(pending.id);
      continue;
    }
    if (action.kind === "delete_personal_item") {
      const index = personalItems.findIndex((item) => item.id === action.itemId);
      if (index < 0) {
        rejected.push({ id: pending.id, code: "personal_item_missing" });
        continue;
      }
      personalItems.splice(index, 1);
      applied.push(pending.id);
      continue;
    }
    const next = sanitizeGapPreferences({ ...gapPreferences, ...action.patch });
    gapPreferences = next;
    applied.push(pending.id);
  }

  return { personalItems, gapPreferences, applied, rejected };
}

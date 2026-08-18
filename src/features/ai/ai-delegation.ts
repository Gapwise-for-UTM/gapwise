import type { GapPreferences } from "@/features/gaps/types";
import { sanitizeGapPreferences } from "@/features/gaps/preferences";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import type { UserPreferences } from "@/features/sync/preferences";
import type { PersonalItem, PersonalCategory, PersonalFlexibility } from "@/lib/personal-types";
import type { Meeting, Term, Weekday } from "@/lib/timetable-types";
import { requireSupabaseClient } from "@/lib/supabase";

export type AiPermissions = {
  readSchedule: true;
  readPersonal: boolean;
  writePersonal: boolean;
  readGapPreferences: boolean;
  writeGapPreferences: boolean;
  readRoutingPreferences: boolean;
};

export type AiDelegationStatus =
  | { enabled: false }
  | { enabled: true; revision: number; permissions: AiPermissions; updatedAt: string };

type AiPersonalDraft = {
  title: string;
  category: PersonalCategory;
  term: Term;
  weekday: Weekday;
  startTime?: number;
  endTime?: number;
  locationBuildingCode?: string | null;
  locationRoom?: string | null;
  locationText?: string | null;
  color?: string;
  flexibility: PersonalFlexibility;
};

type AiPersonalPatch = Partial<AiPersonalDraft> & { color?: string | null };

export type AiAction =
  | {
      schemaVersion: 1;
      kind: "create_personal_item";
      expectedRevision: number;
      item: AiPersonalDraft;
    }
  | {
      schemaVersion: 1;
      kind: "update_personal_item";
      expectedRevision: number;
      itemId: string;
      patch: AiPersonalPatch;
    }
  | {
      schemaVersion: 1;
      kind: "delete_personal_item";
      expectedRevision: number;
      itemId: string;
    }
  | {
      schemaVersion: 1;
      kind: "update_gap_preferences";
      expectedRevision: number;
      patch: Partial<GapPreferences>;
    };

export type PendingAiAction = { id: string; createdAt: string; action: AiAction };

const viteEnv = (
  import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }
).env;
const configuredOrigin = viteEnv?.["VITE_GAPWISE_AI_URL"]?.trim() ?? "";

function normalizeOrigin(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.pathname !== "/" || url.search || url.hash) return null;
    if (import.meta.env?.PROD && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const gapwiseAiOrigin = normalizeOrigin(configuredOrigin);
export const isGapwiseAiConfigured = gapwiseAiOrigin !== null;

async function accessToken(): Promise<string> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in before managing AI access.");
  return data.session.access_token;
}

async function aiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!gapwiseAiOrigin) throw new Error("Gapwise AI is not configured on this deployment.");
  const token = await accessToken();
  const response = await fetch(`${gapwiseAiOrigin}${path}`, {
    ...init,
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // The generic error below deliberately avoids echoing server response text.
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "Gapwise AI is temporarily unavailable.";
    throw new Error(message);
  }
  return body as T;
}

export function getAiDelegationStatus() {
  return aiRequest<AiDelegationStatus>("/api/delegation");
}

export function revokeAiDelegation() {
  return aiRequest<{ enabled: false }>("/api/delegation", { method: "DELETE" });
}

export function getPendingAiActions() {
  return aiRequest<{ actions: PendingAiAction[] }>("/api/delegation/actions");
}

export function completeAiAction(
  id: string,
  status: "applied" | "rejected",
  resultCode?: string,
) {
  return aiRequest<{ actionId: string; status: string; completedAt: string | null }>(
    `/api/delegation/actions/${encodeURIComponent(id)}/complete`,
    {
      method: "POST",
      body: JSON.stringify({ status, ...(resultCode ? { resultCode } : {}) }),
    },
  );
}

function delegatedMeeting(meeting: Meeting) {
  return {
    id: meeting.id,
    courseCode: meeting.courseCode,
    activityType: meeting.activityType,
    sectionCode: meeting.sectionCode,
    courseName: meeting.courseName,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    weekday: meeting.weekday,
    buildingCode: meeting.buildingCode,
    room: meeting.room,
    term: meeting.term,
    locationUnknown: meeting.locationUnknown,
    ...(meeting.locationType ? { locationType: meeting.locationType } : {}),
    ...(meeting.dateRange ? { dateRange: meeting.dateRange } : {}),
    ...(meeting.excludedDates ? { excludedDates: meeting.excludedDates } : {}),
    ...(meeting.recurrenceIntervalWeeks
      ? { recurrenceIntervalWeeks: meeting.recurrenceIntervalWeeks }
      : {}),
  };
}

function delegatedPersonal(item: PersonalItem) {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    term: item.term,
    weekday: item.weekday,
    ...(item.startTime !== undefined ? { startTime: item.startTime } : {}),
    ...(item.endTime !== undefined ? { endTime: item.endTime } : {}),
    ...(item.locationBuildingCode !== undefined
      ? { locationBuildingCode: item.locationBuildingCode }
      : {}),
    ...(item.locationRoom !== undefined ? { locationRoom: item.locationRoom } : {}),
    ...(item.locationText !== undefined ? { locationText: item.locationText } : {}),
    ...(item.color ? { color: item.color } : {}),
    flexibility: item.flexibility,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function routingPreferences(preferences: UserPreferences) {
  return {
    mode: preferences.mode,
    walkingSpeedMps: preferences.walkingSpeedMps,
    transitionBufferMinutes: preferences.transitionBufferMinutes,
    avoidStairs: preferences.avoidStairs,
    preferIndoor: preferences.preferIndoor,
    dayOrigin: preferences.dayOrigin,
    residenceBuildingCode: preferences.residenceBuildingCode,
    commuteMode: preferences.commuteMode,
    campusAccessPointId: preferences.campusAccessPointId,
  };
}

export function buildAiSnapshot(
  revision: number,
  permissions: AiPermissions,
  input: {
    meetings: Meeting[];
    personalItems: PersonalItem[];
    preferences: UserPreferences;
    gapPreferences: GapPreferences;
  },
) {
  return {
    schemaVersion: 1 as const,
    revision,
    generatedAt: new Date().toISOString(),
    permissions,
    schedule: input.meetings.map(delegatedMeeting),
    personalItems: permissions.readPersonal ? input.personalItems.map(delegatedPersonal) : [],
    gapPreferences: permissions.readGapPreferences ? input.gapPreferences : null,
    routingPreferences: permissions.readRoutingPreferences ? routingPreferences(input.preferences) : null,
  };
}

export function publishAiSnapshot(
  revision: number,
  permissions: AiPermissions,
  input: {
    meetings: Meeting[];
    personalItems: PersonalItem[];
    preferences: UserPreferences;
    gapPreferences: GapPreferences;
  },
) {
  return aiRequest<{ enabled: true; revision: number; updatedAt: string }>(
    "/api/delegation/snapshot",
    {
      method: "PUT",
      body: JSON.stringify(buildAiSnapshot(revision, permissions, input)),
    },
  );
}

function normalizePersonalDraft(item: AiPersonalDraft, now: string): PersonalItem {
  const base: PersonalItem = {
    id: `ai-${crypto.randomUUID()}`,
    title: item.title,
    category: item.category,
    term: item.term,
    weekday: item.weekday,
    flexibility: item.flexibility,
    createdAt: now,
    updatedAt: now,
  };
  if (item.locationBuildingCode !== undefined) base.locationBuildingCode = item.locationBuildingCode;
  if (item.locationRoom !== undefined) base.locationRoom = item.locationRoom;
  if (item.locationText !== undefined) base.locationText = item.locationText;
  if (item.color) base.color = item.color;
  if (item.flexibility.kind === "fixed") {
    if (
      !Number.isInteger(item.startTime) ||
      !Number.isInteger(item.endTime) ||
      item.startTime! < 0 ||
      item.endTime! > 24 * 60 ||
      item.endTime! <= item.startTime!
    ) {
      throw new Error("AI proposed an invalid fixed personal item.");
    }
    base.startTime = item.startTime;
    base.endTime = item.endTime;
  }
  return base;
}

function patchPersonal(existing: PersonalItem, patch: AiPersonalPatch, now: string): PersonalItem {
  const next = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt, updatedAt: now };
  if (patch.color === null) delete next.color;
  const flexibility = patch.flexibility ?? existing.flexibility;
  next.flexibility = flexibility;
  if (flexibility.kind === "flexible") {
    delete next.startTime;
    delete next.endTime;
  } else {
    if (
      !Number.isInteger(next.startTime) ||
      !Number.isInteger(next.endTime) ||
      next.startTime! < 0 ||
      next.endTime! > 24 * 60 ||
      next.endTime! <= next.startTime!
    ) {
      throw new Error("AI proposed an invalid fixed personal item update.");
    }
  }
  return next;
}

export function applyAiAction(
  payload: PrivateDataPayloadV1,
  action: AiAction,
): PrivateDataPayloadV1 {
  const now = new Date().toISOString();
  switch (action.kind) {
    case "create_personal_item":
      if (payload.personalItems.length >= 200) throw new Error("Personal item limit reached.");
      return {
        ...payload,
        personalItems: [...payload.personalItems, normalizePersonalDraft(action.item, now)],
      };
    case "update_personal_item": {
      const index = payload.personalItems.findIndex((item) => item.id === action.itemId);
      if (index < 0) throw new Error("The personal item no longer exists.");
      const next = [...payload.personalItems];
      next[index] = patchPersonal(next[index]!, action.patch, now);
      return { ...payload, personalItems: next };
    }
    case "delete_personal_item": {
      if (!payload.personalItems.some((item) => item.id === action.itemId)) {
        throw new Error("The personal item no longer exists.");
      }
      return {
        ...payload,
        personalItems: payload.personalItems.filter((item) => item.id !== action.itemId),
      };
    }
    case "update_gap_preferences":
      return {
        ...payload,
        gapPreferences: sanitizeGapPreferences({ ...payload.gapPreferences, ...action.patch }),
      };
  }
}

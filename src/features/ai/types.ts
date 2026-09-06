import type { GapAssessment, GapPreferences } from "@/features/gaps/types";
import type { UserPreferences } from "@/features/sync/preferences";
import type { PersonalCategory, PersonalFlexibility, PersonalItem } from "@/lib/personal-types";
import type {
  ActivityType,
  MeetingDateRange,
  MeetingLocationType,
  Term,
  Weekday,
} from "@/lib/timetable-types";

export type AiPermissions = {
  readSchedule: true;
  /** Legacy schema keys retained so existing delegated snapshots remain readable. */
  readPersonal: boolean;
  /** Personal Items are retired; this is always normalized to false. */
  writePersonal: boolean;
  readGapPlans: boolean;
  readGapPreferences: boolean;
  writeGapPreferences: boolean;
  readRoutingPreferences: boolean;
};

// Start with the smallest useful delegation. A user must explicitly opt into every
// additional private category and every write capability.
export const DEFAULT_AI_PERMISSIONS: AiPermissions = {
  readSchedule: true,
  readPersonal: false,
  writePersonal: false,
  readGapPlans: false,
  readGapPreferences: false,
  writeGapPreferences: false,
  readRoutingPreferences: false,
};

/** Canonicalize permissions from older AI snapshots after Personal Items were retired. */
export function normalizeAiPermissions(permissions: AiPermissions): AiPermissions {
  return {
    ...permissions,
    readSchedule: true,
    readPersonal: false,
    writePersonal: false,
  };
}

export type AiMeeting = {
  id: string;
  courseCode: string;
  activityType: ActivityType;
  sectionCode: string;
  courseName: string;
  startTime: number;
  endTime: number;
  weekday: Weekday;
  buildingCode: string | null;
  room: string | null;
  term: Term;
  locationUnknown: boolean;
  /** True only for ACORN's recurring placeholder windows used for possible assessments. */
  isReservedAssessmentWindow: boolean;
  locationType?: MeetingLocationType;
  dateRange?: MeetingDateRange;
  excludedDates?: string[];
  recurrenceIntervalWeeks?: number;
};

/** @deprecated Personal Items are retired. Retained for schema-v1 compatibility only. */
export type AiPersonalItem = Omit<PersonalItem, "notes">;

export type AiRoutingPreferences = Pick<
  UserPreferences,
  | "mode"
  | "walkingSpeedMps"
  | "transitionBufferMinutes"
  | "avoidStairs"
  | "preferIndoor"
  | "dayOrigin"
  | "residenceBuildingCode"
  | "commuteMode"
  | "campusAccessPointId"
>;

export type AiGapPlan = {
  id: string;
  term: Term;
  weekday: Weekday;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  previousMeetingId: string;
  nextMeetingId: string;
  assessment: GapAssessment;
};

export type AiSnapshot = {
  schemaVersion: 1;
  revision: number;
  generatedAt: string;
  permissions: AiPermissions;
  schedule: AiMeeting[];
  /** @deprecated Always empty. Kept so schema-v1 readers remain compatible. */
  personalItems: AiPersonalItem[];
  gapPlans: AiGapPlan[];
  gapPreferences: GapPreferences | null;
  routingPreferences: AiRoutingPreferences | null;
};

export type AiDelegationStatus =
  | { enabled: false }
  | {
      enabled: true;
      revision: number;
      permissions: AiPermissions;
      updatedAt: string;
    };

/** @deprecated Personal Items are retired. */
export type PersonalItemDraft = {
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

/** @deprecated Personal Items are retired. */
export type PersonalItemPatch = Partial<
  Omit<PersonalItemDraft, "flexibility"> & { flexibility: PersonalFlexibility }
> & { color?: string | null };

// Legacy Personal Item action variants remain parseable so an already-queued action can be
// rejected safely by old clients instead of making the whole action feed malformed.
export type AiAction =
  | {
      schemaVersion: 1;
      kind: "create_personal_item";
      expectedRevision: number;
      item: PersonalItemDraft;
    }
  | {
      schemaVersion: 1;
      kind: "update_personal_item";
      expectedRevision: number;
      itemId: string;
      patch: PersonalItemPatch;
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

export type PendingAiAction = {
  id: string;
  createdAt: string;
  action: AiAction;
};

export type AiActionCompletion = {
  status: "applied" | "rejected";
  resultCode?: string;
};

import { describe, expect, test } from "bun:test";
import { applyAiActionBatch, parsePendingAiActions } from "@/features/ai/actions";
import { aiSnapshotContent } from "@/features/ai/snapshot";
import { DEFAULT_AI_PERMISSIONS } from "@/features/ai/types";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import type { PersonalItem } from "@/lib/personal-types";
import { ASSESSMENT_WINDOW_NOTE, type Meeting } from "@/lib/timetable-types";

const meeting: Meeting = {
  id: "m1",
  courseCode: "CSC110Y5",
  activityType: "LEC",
  sectionCode: "LEC0101",
  courseName: "Foundations of Computer Science",
  startTime: 600,
  endTime: 660,
  weekday: "Monday",
  buildingCode: "MN",
  room: "1210",
  term: "Fall",
  locationUnknown: false,
  locationType: "physical",
  notes: "must not be delegated",
};

const nextMeeting: Meeting = {
  ...meeting,
  id: "m2",
  courseCode: "MAT157Y5",
  courseName: "Analysis I",
  startTime: 780,
  endTime: 840,
};

const hiddenPersonal: PersonalItem = {
  id: "private-appointment",
  title: "Appointment",
  category: "Appointment",
  term: "Fall",
  weekday: "Monday",
  startTime: 700,
  endTime: 720,
  notes: "sensitive detail",
  flexibility: { kind: "fixed" },
  createdAt: "2026-08-18T16:00:00.000Z",
  updatedAt: "2026-08-18T16:00:00.000Z",
};

describe("AI delegation", () => {
  test("academic snapshots omit notes and raw-only fields", () => {
    const content = aiSnapshotContent({
      meetings: [meeting],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      permissions: DEFAULT_AI_PERMISSIONS,
    });
    expect(content.schedule).toHaveLength(1);
    expect("notes" in content.schedule[0]!).toBe(false);
    expect(content.schedule[0]!.courseCode).toBe("CSC110Y5");
    expect(content.schedule[0]!.isReservedAssessmentWindow).toBe(false);
    expect(content.gapPlans).toEqual([]);
  });

  test("delegates reserved assessment semantics without exposing ACORN notes", () => {
    const reserved: Meeting = {
      ...meeting,
      id: "reserved",
      weekday: "Saturday",
      startTime: 780,
      endTime: 900,
      buildingCode: null,
      room: null,
      locationUnknown: true,
      locationType: "tba",
      notes: ASSESSMENT_WINDOW_NOTE,
    };
    const content = aiSnapshotContent({
      meetings: [reserved],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      permissions: DEFAULT_AI_PERMISSIONS,
    });
    expect(content.schedule[0]!.isReservedAssessmentWindow).toBe(true);
    expect("notes" in content.schedule[0]!).toBe(false);
  });

  test("delegates canonical Gapwise gap assessments only when explicitly enabled", () => {
    const content = aiSnapshotContent({
      meetings: [meeting, nextMeeting],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      permissions: { ...DEFAULT_AI_PERMISSIONS, readGapPlans: true },
    });

    expect(content.gapPlans).toHaveLength(1);
    expect(content.gapPlans[0]?.startTime).toBe(660);
    expect(content.gapPlans[0]?.endTime).toBe(780);
    expect(content.gapPlans[0]?.assessment.routeStatus).toBe("same-room");
    expect(content.gapPlans[0]?.assessment.confidenceLabel).toBe("high");
  });

  test("retired personal items are never delegated or used as AI gap boundaries", () => {
    const content = aiSnapshotContent({
      meetings: [meeting, nextMeeting],
      personalItems: [hiddenPersonal],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      permissions: {
        ...DEFAULT_AI_PERMISSIONS,
        readGapPlans: true,
        readPersonal: true,
        writePersonal: true,
      },
    });

    expect(content.permissions.readPersonal).toBe(false);
    expect(content.permissions.writePersonal).toBe(false);
    expect(content.personalItems).toEqual([]);
    expect(content.gapPlans.map((gap) => [gap.startTime, gap.endTime])).toEqual([[660, 780]]);
  });

  test("AI actions cannot invent an academic-meeting mutation kind", () => {
    expect(
      parsePendingAiActions([
        {
          id: "00000000-0000-4000-8000-000000000001",
          createdAt: "2026-08-18T16:30:00.000Z",
          action: {
            schemaVersion: 1,
            kind: "update_academic_meeting",
            expectedRevision: 1,
            itemId: "m1",
            patch: { startTime: 700 },
          },
        },
      ]),
    ).toBeNull();
  });

  test("stale writes are rejected without changing private state", () => {
    const result = applyAiActionBatch({
      revision: 5,
      personalItems: [],
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      permissions: { writePersonal: true, writeGapPreferences: false },
      actions: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          createdAt: "2026-08-18T16:30:00.000Z",
          action: {
            schemaVersion: 1,
            kind: "create_personal_item",
            expectedRevision: 4,
            item: {
              title: "Study MAT157",
              category: "Study",
              term: "Fall",
              weekday: "Monday",
              startTime: 720,
              endTime: 780,
              flexibility: { kind: "fixed" },
            },
          },
        },
      ],
    });
    expect(result.personalItems).toEqual([]);
    expect(result.rejected).toEqual([
      { id: "00000000-0000-4000-8000-000000000002", code: "stale_revision" },
    ]);
  });

  test("legacy create actions use deterministic ids for retry safety", () => {
    const action = {
      id: "00000000-0000-4000-8000-000000000003",
      createdAt: "2026-08-18T16:30:00.000Z",
      action: {
        schemaVersion: 1 as const,
        kind: "create_personal_item" as const,
        expectedRevision: 1,
        item: {
          title: "Lunch",
          category: "Food" as const,
          term: "Fall" as const,
          weekday: "Tuesday" as const,
          startTime: 720,
          endTime: 750,
          flexibility: { kind: "fixed" as const },
        },
      },
    };
    const first = applyAiActionBatch({
      revision: 1,
      personalItems: [],
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      permissions: { writePersonal: true, writeGapPreferences: false },
      actions: [action],
    });
    const second = applyAiActionBatch({
      revision: 1,
      personalItems: first.personalItems,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      permissions: { writePersonal: true, writeGapPreferences: false },
      actions: [action],
    });
    expect(first.personalItems[0]!.id).toBe(`ai-${action.id}`);
    expect(second.personalItems).toHaveLength(1);
  });

  test("client action application enforces current write permissions", () => {
    const result = applyAiActionBatch({
      revision: 1,
      personalItems: [],
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      permissions: { writePersonal: false, writeGapPreferences: false },
      actions: [
        {
          id: "00000000-0000-4000-8000-000000000004",
          createdAt: "2026-08-18T16:30:00.000Z",
          action: {
            schemaVersion: 1,
            kind: "create_personal_item",
            expectedRevision: 1,
            item: {
              title: "Blocked write",
              category: "Study",
              term: "Fall",
              weekday: "Monday",
              startTime: 720,
              endTime: 780,
              flexibility: { kind: "fixed" },
            },
          },
        },
      ],
    });

    expect(result.personalItems).toEqual([]);
    expect(result.rejected).toEqual([
      { id: "00000000-0000-4000-8000-000000000004", code: "permission_denied" },
    ]);
  });
});
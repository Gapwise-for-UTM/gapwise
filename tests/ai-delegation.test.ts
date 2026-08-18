import { describe, expect, test } from "bun:test";
import { applyAiActionBatch, parsePendingAiActions } from "@/features/ai/actions";
import { aiSnapshotContent } from "@/features/ai/snapshot";
import { DEFAULT_AI_PERMISSIONS } from "@/features/ai/types";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import type { Meeting } from "@/lib/timetable-types";

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

  test("create actions use deterministic ids for retry safety", () => {
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
      actions: [action],
    });
    const second = applyAiActionBatch({
      revision: 1,
      personalItems: first.personalItems,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      actions: [action],
    });
    expect(first.personalItems[0]!.id).toBe(`ai-${action.id}`);
    expect(second.personalItems).toHaveLength(1);
  });
});

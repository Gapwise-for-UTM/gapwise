import { describe, expect, test } from "bun:test";
import {
  canUseFeature,
  FREE_ENTITLEMENT,
  resolveEntitlement,
} from "@/features/entitlements/entitlements";
import {
  completeBlock,
  createManualCoursework,
  EMPTY_ACADEMIC_STATE,
} from "@/features/academic/state";
import {
  createPrivateDataPayload,
  validatePrivateDataPayload,
} from "@/features/security/private-data";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";

describe("free product capabilities", () => {
  test("historical billing-era rows never gate current capabilities", () => {
    expect(resolveEntitlement(null)).toEqual(FREE_ENTITLEMENT);
    expect(resolveEntitlement({ tier: "pro", expires_at: "2020-01-01T00:00:00Z" })).toEqual(
      FREE_ENTITLEMENT,
    );
    expect(resolveEntitlement({ tier: "founder", expires_at: "2020-01-01" })).toEqual(
      FREE_ENTITLEMENT,
    );

    for (const capability of [
      "academic_planner",
      "coursework_management",
      "planned_work_blocks",
    ] as const) {
      expect(canUseFeature(FREE_ENTITLEMENT, capability)).toBe(true);
    }
  });
});

describe("private academic state", () => {
  const base = {
    schedule: [],
    personalItems: [],
    preferences: DEFAULT_USER_PREFERENCES,
    gapPreferences: DEFAULT_GAP_PREFERENCES,
  };
  test("restores legacy v1 payloads with safe academic defaults", () => {
    expect(validatePrivateDataPayload({ schemaVersion: 1, ...base }).academic).toEqual(
      EMPTY_ACADEMIC_STATE,
    );
  });
  test("roundtrips manual coursework and accepted blocks", () => {
    const item = createManualCoursework({
      courseCode: "mat157",
      title: "Problem Set 4",
      kind: "assignment",
      dueAt: null,
      estimatedMinutes: 240,
      priority: "high",
    });
    const block = {
      id: "study:1",
      courseworkId: item.id,
      start: "2026-08-21T14:00:00Z",
      end: "2026-08-21T15:30:00Z",
      allocatedMinutes: 90,
      status: "accepted" as const,
      origin: "deterministic_planner" as const,
      locked: true,
      revision: "r1",
      reasons: ["work_remaining"],
    };
    const payload = createPrivateDataPayload({
      ...base,
      academic: { coursework: [item], blocks: [block], proposalRevision: "r1" },
    });
    expect(validatePrivateDataPayload(payload).academic.blocks[0]?.status).toBe("accepted");
    expect(
      completeBlock(payload.academic, block.id).coursework[0]?.workEstimate.remainingMinutes,
    ).toBe(150);
  });
  test("rejects malformed estimates and validates manual duration", () => {
    expect(() =>
      createManualCoursework({
        courseCode: "MAT157",
        title: "PS",
        kind: "assignment",
        dueAt: "2020-01-01T00:00:00Z",
        estimatedMinutes: -1,
        priority: "normal",
      }),
    ).toThrow();
    const payload = createPrivateDataPayload(base);
    expect(() =>
      validatePrivateDataPayload({
        ...payload,
        academic: { coursework: [{ id: "bad" }], blocks: [], proposalRevision: null },
      }),
    ).toThrow();
  });
});

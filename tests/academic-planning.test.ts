import { describe, expect, test } from "bun:test";
import {
  normalizeProviderAssignment,
  reconcileCoursework,
  type ProviderAssignmentSnapshot,
} from "@/features/academic/provider-adapter";
import { createStudyPlan, transitionBlock } from "@/features/academic/planner";
import type { AcademicPlanningContext, CourseworkItem } from "@/features/academic/types";
import { needsScheduledWork } from "@/features/academic/types";
import { resolveWorkEstimate } from "@/features/academic/workload";
import { buildWorkWindows, torontoInstant } from "@/features/academic/windows";
import { meeting } from "./fixtures";

const raw: ProviderAssignmentSnapshot = {
  id: 4,
  courseId: 10,
  courseCode: "DEM101H5",
  name: "Problem Set",
  description: "<p>Two proofs</p><script>alert(1)</script>",
  dueAt: "2026-09-12T03:59:00Z",
  updatedAt: "2026-09-01T12:00:00Z",
  pointsPossible: 20,
  submission: { workflowState: "unsubmitted" },
};
const item = (overrides: Partial<CourseworkItem> = {}): CourseworkItem => ({
  ...normalizeProviderAssignment(raw),
  ...overrides,
});
const context = (overrides: Partial<AcademicPlanningContext> = {}): AcademicPlanningContext => ({
  horizon: {
    startDate: "2026-09-07",
    endDate: "2026-09-07",
    dayStartMinute: 8 * 60,
    dayEndMinute: 18 * 60,
    timeZone: "America/Toronto",
  },
  academicMeetings: [
    meeting({ id: "class-a", weekday: "Monday", startTime: 9 * 60, endTime: 10 * 60 }),
    meeting({ id: "class-b", weekday: "Monday", startTime: 13 * 60, endTime: 14 * 60 }),
  ],
  fixedPersonalCommitments: [],
  coursework: [
    item({
      workEstimate: {
        estimatedTotalMinutes: 180,
        remainingMinutes: 180,
        confidence: "high",
        provenance: "user_supplied",
      },
    }),
  ],
  courseProfiles: [],
  existingBlocks: [],
  preferences: {
    minimumBlockMinutes: 30,
    maximumBlockMinutes: 90,
    setupMinutes: 5,
    packUpMinutes: 5,
    maxDailyMinutes: 240,
  },
  ...overrides,
});

describe("provider-neutral coursework", () => {
  test("normalizes safe content, missing deadlines, and distinct submission states", () => {
    expect(normalizeProviderAssignment(raw)).toMatchObject({
      id: "provider:10:4",
      dueAt: raw.dueAt,
      submissionState: "unsubmitted",
      content: { plainTextSummary: "Two proofs" },
    });
    expect(normalizeProviderAssignment({ ...raw, dueAt: null }).dueAt).toBeNull();
    expect(
      normalizeProviderAssignment({
        ...raw,
        submission: { workflowState: "submitted", late: true },
      }).submissionState,
    ).toBe("late");
    expect(
      normalizeProviderAssignment({ ...raw, submission: { workflowState: "graded" } })
        .submissionState,
    ).toBe("graded");
  });
  test("reconciles changes while preserving student-owned progress and workload", () => {
    const prior = item({
      localProgress: "in_progress",
      priority: "high",
      workEstimate: {
        estimatedTotalMinutes: 240,
        remainingMinutes: 200,
        confidence: "high",
        provenance: "user_supplied",
      },
    });
    const result = reconcileCoursework(
      [prior],
      [
        {
          ...raw,
          name: "Revised set",
          dueAt: "2026-09-09T03:59:00Z",
          updatedAt: "2026-09-02T12:00:00Z",
          submission: { workflowState: "submitted" },
        },
      ],
      "2026-09-03T00:00:00Z",
    );
    expect(result.changes.map((c) => c.type)).toEqual([
      "due_date_changed",
      "assignment_changed",
      "became_submitted",
    ]);
    expect(result.coursework[0]).toMatchObject({
      localProgress: "in_progress",
      priority: "high",
      workEstimate: { provenance: "user_supplied", remainingMinutes: 200 },
    });
  });
  test("manual and provider completion remain distinguishable", () => {
    expect(
      needsScheduledWork(
        item({ localProgress: "completed_manually", submissionState: "unsubmitted" }),
      ),
    ).toBeFalse();
    expect(
      needsScheduledWork(item({ localProgress: "not_started", submissionState: "missing" })),
    ).toBeTrue();
    expect(needsScheduledWork(item({ submissionState: "submitted" }))).toBeFalse();
  });
});

describe("workload provenance and calibration", () => {
  test("uses generic, course, and user precedence", () => {
    expect(resolveWorkEstimate({ genericMinutes: 90 }).provenance).toBe("generic_fallback");
    expect(
      resolveWorkEstimate({
        genericMinutes: 90,
        courseProfile: {
          courseId: "x",
          characteristics: [],
          typicalMinutes: { min: 100, max: 140 },
          confidence: "medium",
          provenance: "course_prior",
        },
      }),
    ).toMatchObject({
      estimatedTotalMinutes: 120,
      provenance: "course_prior",
      confidence: "medium",
    });
    expect(
      resolveWorkEstimate({ genericMinutes: 90, analysisMinutes: 130, userOverrideMinutes: 75 }),
    ).toMatchObject({ estimatedTotalMinutes: 75, provenance: "user_supplied", confidence: "high" });
  });
  test("observations move conservatively toward actual work", () => {
    const one = resolveWorkEstimate({
      genericMinutes: 100,
      observations: [
        {
          estimatedMinutes: 100,
          actualMinutes: 150,
          courseId: "x",
          characteristics: [],
          completedAt: "2026-01-01",
        },
      ],
    });
    const many = resolveWorkEstimate({
      genericMinutes: 100,
      observations: Array.from({ length: 8 }, () => ({
        estimatedMinutes: 100,
        actualMinutes: 150,
        courseId: "x",
        characteristics: [] as const,
        completedAt: "2026-01-01",
      })),
    });
    expect(one.estimatedTotalMinutes).toBe(110);
    expect(many.estimatedTotalMinutes).toBeGreaterThan(one.estimatedTotalMinutes);
  });
});

describe("concrete Toronto windows and planner", () => {
  test("uses Toronto civil time and only labels between-commitment time as a gap", () => {
    expect(torontoInstant("2026-01-12", 9 * 60)).toBe("2026-01-12T14:00:00.000Z");
    expect(torontoInstant("2026-09-07", 9 * 60)).toBe("2026-09-07T13:00:00.000Z");
    const windows = buildWorkWindows(context(), () => 15);
    expect(windows.map((w) => w.kind)).toEqual([
      "free_window",
      "between_commitments",
      "free_window",
    ]);
    expect(windows[1]).toMatchObject({ availableMinutes: 155, routeMinutes: 15 });
  });
  test("unknown required route closes the actual gap and personal/locked work blocks time", () => {
    expect(
      buildWorkWindows(context(), () => null).every((w) => w.kind === "free_window"),
    ).toBeTrue();
    const personal = meeting({
      id: "job",
      weekday: "Monday",
      startTime: 10 * 60,
      endTime: 13 * 60,
    });
    expect(
      buildWorkWindows(context({ fixedPersonalCommitments: [personal] }), () => 0).some(
        (w) => w.start < "2026-09-07T17:00:00.000Z" && w.end > "2026-09-07T14:00:00.000Z",
      ),
    ).toBeFalse();
  });
  test("is deterministic, stable, deadline-safe, split, and reports overflow", () => {
    const input = context();
    const a = createStudyPlan(input, () => 15),
      b = createStudyPlan(input, () => 15);
    expect(a).toEqual(b);
    expect(a.blocks.length).toBeGreaterThan(1);
    expect(a.blocks.every((x) => x.end <= raw.dueAt!)).toBeTrue();
    const impossible = createStudyPlan(
      context({
        coursework: [
          item({
            dueAt: "2026-09-07T14:00:00.000Z",
            workEstimate: {
              estimatedTotalMinutes: 500,
              remainingMinutes: 500,
              confidence: "low",
              provenance: "generic_fallback",
            },
          }),
        ],
      }),
      () => 15,
    );
    expect(impossible.unscheduledMinutes[item().id]).toBeGreaterThan(0);
    expect(impossible.warnings).toHaveLength(1);
  });
  test("submitted work is not planned and deadlines change the revision", () => {
    expect(
      createStudyPlan(context({ coursework: [item({ submissionState: "submitted" })] }), () => 0)
        .blocks,
    ).toEqual([]);
    const later = createStudyPlan(context(), () => 0);
    const sooner = createStudyPlan(
      context({ coursework: [item({ dueAt: "2026-09-07T16:00:00Z" })] }),
      () => 0,
    );
    expect(later.revision).not.toBe(sooner.revision);
    expect(sooner.blocks.reduce((n, b) => n + b.allocatedMinutes, 0)).toBeLessThan(
      later.blocks.reduce((n, b) => n + b.allocatedMinutes, 0),
    );
  });
  test("enforces block lifecycle and stale revisions", () => {
    const proposed = createStudyPlan(context(), () => 0).blocks[0]!;
    const accepted = transitionBlock(proposed, "accepted", proposed.revision);
    expect(accepted).toMatchObject({ status: "accepted", locked: true });
    expect(() => transitionBlock(accepted, "completed", "old")).toThrow("Stale");
    expect(transitionBlock(accepted, "missed").status).toBe("missed");
  });
});

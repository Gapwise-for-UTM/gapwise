import { describe, expect, test } from "bun:test";
import {
  normalizeCanvasAssignment,
  reconcileCoursework,
  type CanvasAssignmentSnapshot,
} from "@/features/academic/canvas-adapter";
import { createStudyPlan } from "@/features/academic/planner";
import type { AcademicPlanningContext } from "@/features/academic/types";
import { needsScheduledWork } from "@/features/academic/types";

const base: CanvasAssignmentSnapshot = {
  id: 12,
  courseId: 34,
  courseCode: "DEM101H5",
  name: "Problem Set",
  dueAt: "2026-09-12T03:59:00Z",
  updatedAt: "2026-09-01T12:00:00Z",
  submission: { workflowState: "unsubmitted" },
};

describe("provider submission completion semantics", () => {
  test("late-but-submitted coursework is complete for scheduling", () => {
    const coursework = normalizeCanvasAssignment({
      ...base,
      submission: {
        workflowState: "submitted",
        submittedAt: "2026-09-12T04:10:00Z",
        late: true,
      },
    });

    expect(coursework.submissionState).toBe("late");
    expect(needsScheduledWork(coursework)).toBeFalse();

    const context: AcademicPlanningContext = {
      horizon: {
        startDate: "2026-09-07",
        endDate: "2026-09-07",
        dayStartMinute: 8 * 60,
        dayEndMinute: 18 * 60,
        timeZone: "America/Toronto",
      },
      academicMeetings: [],
      fixedPersonalCommitments: [],
      coursework: [coursework],
      courseProfiles: [],
      existingBlocks: [],
      preferences: {
        minimumBlockMinutes: 30,
        maximumBlockMinutes: 90,
        setupMinutes: 5,
        packUpMinutes: 5,
        maxDailyMinutes: 240,
      },
    };

    expect(createStudyPlan(context, () => 0).blocks).toEqual([]);
  });

  test("a new unsubmitted attempt after a late submission is detected as reopened", () => {
    const prior = normalizeCanvasAssignment({
      ...base,
      submission: {
        workflowState: "submitted",
        submittedAt: "2026-09-12T04:10:00Z",
        late: true,
      },
    });

    const result = reconcileCoursework(
      [prior],
      [
        {
          ...base,
          updatedAt: "2026-09-13T12:00:00Z",
          submission: { workflowState: "unsubmitted", attempt: 2 },
        },
      ],
      "2026-09-10T00:00:00Z",
    );

    expect(result.changes.map((change) => change.type)).toContain("reopened");
    expect(needsScheduledWork(result.coursework[0]!)).toBeTrue();
  });
});

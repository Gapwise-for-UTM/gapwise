import { describe, expect, test } from "bun:test";
import { plannedWorkMeetings } from "@/features/academic/integration";
import { createStudyPlan } from "@/features/academic/planner";
import {
  createManualCoursework,
  setManualCourseworkCompletion,
  type AcademicState,
} from "@/features/academic/state";
import type { AcademicPlanningContext, PlannedWorkBlock } from "@/features/academic/types";
import {
  buildWorkWindows,
  torontoLocalDateTimeInstant,
} from "@/features/academic/windows";
import { meeting } from "./fixtures";

const coursework = () =>
  createManualCoursework(
    {
      courseCode: "MAT157",
      title: "Problem Set",
      kind: "assignment",
      dueAt: "2026-09-12T03:59:00.000Z",
      estimatedMinutes: 180,
      priority: "normal",
    },
    new Date("2026-09-01T12:00:00Z"),
  );

const acceptedBlock = (courseworkId: string): PlannedWorkBlock => ({
  id: "study:accepted",
  courseworkId,
  start: "2026-09-07T14:30:00.000Z",
  end: "2026-09-07T15:30:00.000Z",
  allocatedMinutes: 60,
  status: "accepted",
  origin: "deterministic_planner",
  locked: true,
  revision: "r1",
  reasons: ["between_commitments"],
});

function context(
  item = coursework(),
  overrides: Partial<AcademicPlanningContext> = {},
): AcademicPlanningContext {
  return {
    horizon: {
      startDate: "2026-09-07",
      endDate: "2026-09-08",
      dayStartMinute: 8 * 60,
      dayEndMinute: 18 * 60,
      timeZone: "America/Toronto",
    },
    routingRevision: "fastest:1.35:5",
    academicMeetings: [
      meeting({ id: "before", weekday: "Monday", startTime: 9 * 60, endTime: 10 * 60 }),
      meeting({ id: "after", weekday: "Monday", startTime: 13 * 60, endTime: 14 * 60 }),
    ],
    fixedPersonalCommitments: [],
    coursework: [item],
    courseProfiles: [],
    existingBlocks: [],
    preferences: {
      minimumBlockMinutes: 30,
      maximumBlockMinutes: 90,
      setupMinutes: 0,
      packUpMinutes: 0,
      maxDailyMinutes: 240,
    },
    ...overrides,
  };
}

describe("Pro planning release regressions", () => {
  test("interprets datetime-local coursework deadlines in Toronto, not the device timezone", () => {
    expect(torontoLocalDateTimeInstant("2026-09-11T23:59")).toBe(
      "2026-09-12T03:59:00.000Z",
    );
    expect(torontoLocalDateTimeInstant("2026-01-12T09:00")).toBe(
      "2026-01-12T14:00:00.000Z",
    );
  });

  test("clips today's planning windows to notBefore", () => {
    const windows = buildWorkWindows(
      context(coursework(), {
        horizon: {
          startDate: "2026-09-07",
          endDate: "2026-09-07",
          dayStartMinute: 8 * 60,
          dayEndMinute: 18 * 60,
          timeZone: "America/Toronto",
          notBefore: "2026-09-07T16:00:00.000Z",
        },
      }),
      () => 0,
    );
    expect(windows.every((window) => Date.parse(window.start) >= Date.parse("2026-09-07T16:00:00Z"))).toBeTrue();
  });

  test("an accepted one-off block occupies only its concrete Toronto date", () => {
    const item = coursework();
    const block = acceptedBlock(item.id);
    const windows = buildWorkWindows(context(item, { existingBlocks: [block] }), () => 0);
    const mondayBlockStart = Date.parse(block.start);
    const mondayBlockEnd = Date.parse(block.end);
    expect(
      windows.some(
        (window) =>
          Date.parse(window.start) < mondayBlockEnd && Date.parse(window.end) > mondayBlockStart,
      ),
    ).toBeFalse();
    expect(
      windows.some(
        (window) =>
          window.start.startsWith("2026-09-08T12:00:00") &&
          window.end.startsWith("2026-09-08T22:00:00"),
      ),
    ).toBeTrue();
  });

  test("replanning does not schedule workload that is already accepted", () => {
    const item = coursework();
    const block = acceptedBlock(item.id);
    const proposal = createStudyPlan(context(item, { existingBlocks: [block] }), () => 0);
    expect(proposal.blocks.reduce((total, candidate) => total + candidate.allocatedMinutes, 0)).toBe(
      120,
    );
    expect(proposal.unscheduledMinutes[item.id]).toBe(0);
  });

  test("manual completion cancels active allocations but preserves completed history", () => {
    const item = coursework();
    const active = acceptedBlock(item.id);
    const historical = { ...active, id: "study:done", status: "completed" as const };
    const state: AcademicState = {
      coursework: [item],
      blocks: [active, historical],
      proposalRevision: "r1",
    };
    const completed = setManualCourseworkCompletion(state, item.id, true);
    expect(completed.coursework[0]?.localProgress).toBe("completed_manually");
    expect(completed.blocks.find((block) => block.id === active.id)?.status).toBe("cancelled");
    expect(completed.blocks.find((block) => block.id === historical.id)?.status).toBe("completed");
  });

  test("weekly timetable overlay does not stack blocks from a later week", () => {
    const item = coursework();
    const first = acceptedBlock(item.id);
    const nextWeek: PlannedWorkBlock = {
      ...first,
      id: "study:next-week",
      start: "2026-09-14T14:30:00.000Z",
      end: "2026-09-14T15:30:00.000Z",
    };
    const meetings = plannedWorkMeetings(
      { coursework: [item], blocks: [first, nextWeek], proposalRevision: "r1" },
      "Fall",
      new Date("2026-09-07T13:00:00Z"),
    );
    expect(meetings.map((entry) => entry.id)).toEqual([first.id]);
  });
});

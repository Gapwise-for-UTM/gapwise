import type { CourseworkItem, PlannedWorkBlock } from "./types";

export interface AcademicState {
  coursework: CourseworkItem[];
  blocks: PlannedWorkBlock[];
  proposalRevision: string | null;
}
export const EMPTY_ACADEMIC_STATE: AcademicState = {
  coursework: [],
  blocks: [],
  proposalRevision: null,
};

export function createManualCoursework(
  input: {
    courseCode: string;
    title: string;
    kind: CourseworkItem["kind"];
    dueAt: string | null;
    estimatedMinutes: number;
    priority: CourseworkItem["priority"];
  },
  now = new Date(),
): CourseworkItem {
  const courseCode = input.courseCode.trim().toUpperCase();
  const title = input.title.trim();
  if (!courseCode || !title) throw new Error("Course and title are required.");
  if (
    !Number.isInteger(input.estimatedMinutes) ||
    input.estimatedMinutes < 15 ||
    input.estimatedMinutes > 10_080
  )
    throw new Error("Estimated work must be between 15 minutes and 7 days.");
  if (input.dueAt !== null && !Number.isFinite(Date.parse(input.dueAt)))
    throw new Error("Due date is invalid.");
  const id = `manual:${crypto.randomUUID()}`;
  return {
    id,
    provider: { provider: "other", courseRef: courseCode, itemRef: id },
    courseId: courseCode,
    courseCode,
    title,
    kind: input.kind,
    availableAt: null,
    dueAt: input.dueAt,
    providerUpdatedAt: now.toISOString(),
    pointsPossible: null,
    weightPercent: null,
    content: {},
    priority: input.priority,
    submissionState: "unsubmitted",
    localProgress: "not_started",
    provenance: { source: "manual", confidence: "high" },
    workEstimate: {
      estimatedTotalMinutes: input.estimatedMinutes,
      remainingMinutes: input.estimatedMinutes,
      confidence: "high",
      provenance: "user_supplied",
    },
  };
}

export function completeBlock(state: AcademicState, blockId: string): AcademicState {
  const block = state.blocks.find((candidate) => candidate.id === blockId);
  if (!block || block.status !== "accepted") throw new Error("Block is not active.");
  return {
    ...state,
    blocks: state.blocks.map((candidate) =>
      candidate.id === blockId ? { ...candidate, status: "completed", locked: true } : candidate,
    ),
    coursework: state.coursework.map((item) =>
      item.id === block.courseworkId
        ? {
            ...item,
            workEstimate: {
              ...item.workEstimate,
              remainingMinutes: Math.max(
                0,
                item.workEstimate.remainingMinutes - block.allocatedMinutes,
              ),
            },
          }
        : item,
    ),
    proposalRevision: null,
  };
}

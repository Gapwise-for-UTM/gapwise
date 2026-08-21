import type { CourseworkItem, PlannedWorkBlock } from "./types";
import type { Meeting } from "@/lib/timetable-types";
import { meetingOccursOnDate } from "@/lib/calendar-awareness";
import { torontoDateForInstant } from "./windows";

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

export function setManualCourseworkCompletion(
  state: AcademicState,
  courseworkId: string,
  completed: boolean,
): AcademicState {
  const item = state.coursework.find((candidate) => candidate.id === courseworkId);
  if (!item) throw new Error("Coursework was not found.");
  return {
    ...state,
    coursework: state.coursework.map((candidate) =>
      candidate.id === courseworkId
        ? {
            ...candidate,
            localProgress: completed ? "completed_manually" : "in_progress",
          }
        : candidate,
    ),
    blocks: completed
      ? state.blocks.map((block) =>
          block.courseworkId === courseworkId && block.status === "accepted"
            ? { ...block, status: "cancelled", locked: false }
            : block,
        )
      : state.blocks,
    proposalRevision: null,
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

function localNoonForCalendarDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Study date is invalid.");
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function rescheduleAcceptedBlock(
  state: AcademicState,
  blockId: string,
  newStart: string,
  fixedMeetings: readonly Meeting[],
  now = new Date(),
): AcademicState {
  const block = state.blocks.find((candidate) => candidate.id === blockId);
  if (!block || block.status !== "accepted" || !block.locked)
    throw new Error("Only active accepted study work can be rescheduled.");
  const item = state.coursework.find((candidate) => candidate.id === block.courseworkId);
  if (!item || item.workEstimate.remainingMinutes <= 0)
    throw new Error("This coursework no longer requires work.");
  const startMs = Date.parse(newStart);
  const durationMs = Date.parse(block.end) - Date.parse(block.start);
  if (!Number.isFinite(startMs) || durationMs <= 0) throw new Error("Choose a valid start time.");
  if (startMs < now.getTime()) throw new Error("Study work cannot be moved into elapsed time.");
  const endMs = startMs + durationMs;
  if (item.dueAt && endMs > Date.parse(item.dueAt))
    throw new Error("Study work must finish before the coursework deadline.");

  const date = torontoDateForInstant(new Date(startMs));
  const torontoCivilDate = localNoonForCalendarDate(date);
  const clock = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const minute = (instant: number) => {
    const parts = Object.fromEntries(
      clock.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    );
    return (Number(parts["hour"]) % 24) * 60 + Number(parts["minute"]);
  };
  const startMinute = minute(startMs);
  const endMinute = minute(endMs);
  if (torontoDateForInstant(new Date(endMs - 1)) !== date || startMinute >= endMinute)
    throw new Error("Study work must start and finish on the same Toronto date.");
  const overlaps = (start: number, end: number) => startMinute < end && endMinute > start;
  if (
    fixedMeetings.some(
      (meeting) =>
        meetingOccursOnDate(meeting, torontoCivilDate) &&
        overlaps(meeting.startTime, meeting.endTime),
    )
  )
    throw new Error("That time overlaps a class or fixed personal commitment.");
  if (
    state.blocks.some(
      (candidate) =>
        candidate.id !== blockId &&
        candidate.status === "accepted" &&
        startMs < Date.parse(candidate.end) &&
        endMs > Date.parse(candidate.start),
    )
  )
    throw new Error("That time overlaps other accepted study work.");

  return {
    ...state,
    blocks: state.blocks.map((candidate) =>
      candidate.id === blockId
        ? {
            ...candidate,
            start: new Date(startMs).toISOString(),
            end: new Date(endMs).toISOString(),
            revision: `moved:${new Date(startMs).toISOString()}`,
          }
        : candidate,
    ),
    proposalRevision: null,
  };
}

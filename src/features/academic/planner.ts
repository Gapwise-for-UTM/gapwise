import type { AcademicPlanningContext, PlannedWorkBlock } from "./types";
import type { Meeting } from "@/lib/timetable-types";
import { needsScheduledWork } from "./types";
import { buildWorkWindows, torontoDateForInstant } from "./windows";

export interface StudyPlanProposal {
  blocks: PlannedWorkBlock[];
  unscheduledMinutes: Record<string, number>;
  warnings: string[];
  revision: string;
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function fingerprint(context: AcademicPlanningContext) {
  return hash(
    JSON.stringify({
      h: context.horizon,
      m: context.academicMeetings,
      p: context.fixedPersonalCommitments,
      c: context.coursework,
      b: context.existingBlocks,
      x: context.preferences,
    }),
  );
}

function acceptedMinutesForCoursework(
  context: AcademicPlanningContext,
  courseworkId: string,
  dueAt: string | null,
) {
  const deadline = dueAt ? Date.parse(dueAt) : Infinity;
  return context.existingBlocks
    .filter(
      (block) =>
        block.courseworkId === courseworkId &&
        block.status === "accepted" &&
        block.locked &&
        Date.parse(block.end) <= deadline,
    )
    .reduce((total, block) => total + block.allocatedMinutes, 0);
}

export function createStudyPlan(
  context: AcademicPlanningContext,
  routeMinutes: (from: Meeting, to: Meeting) => number | null,
): StudyPlanProposal {
  const revision = fingerprint(context);
  const windows = buildWorkWindows(context, routeMinutes).map((window) => ({
    ...window,
    cursor: Date.parse(window.start),
    remaining: window.availableMinutes,
  }));
  const items = context.coursework.filter(needsScheduledWork).sort((a, b) => {
    const ad = a.dueAt ?? "9999";
    const bd = b.dueAt ?? "9999";
    return (
      ad.localeCompare(bd) ||
      { high: 0, normal: 1, low: 2 }[a.priority] -
        { high: 0, normal: 1, low: 2 }[b.priority] ||
      a.id.localeCompare(b.id)
    );
  });
  const blocks: PlannedWorkBlock[] = [];
  const unscheduledMinutes: Record<string, number> = {};
  const daily = new Map<string, number>();

  for (const block of context.existingBlocks) {
    if (block.status !== "accepted" || !block.locked) continue;
    const day = torontoDateForInstant(block.start);
    daily.set(day, (daily.get(day) ?? 0) + block.allocatedMinutes);
  }

  for (const item of items) {
    let remaining = Math.max(
      0,
      item.workEstimate.remainingMinutes -
        acceptedMinutesForCoursework(context, item.id, item.dueAt),
    );
    const preferLong = context.courseProfiles
      .find((profile) => profile.courseId === item.courseId)
      ?.characteristics.includes("prefers_long_sessions");
    const candidates = [...windows]
      .filter((window) => !item.dueAt || window.cursor < Date.parse(item.dueAt))
      .sort(
        (a, b) =>
          (preferLong ? b.remaining - a.remaining : 0) ||
          a.cursor - b.cursor ||
          a.id.localeCompare(b.id),
      );

    for (const window of candidates) {
      if (remaining < context.preferences.minimumBlockMinutes) break;
      const day = torontoDateForInstant(new Date(window.cursor));
      const cap = context.preferences.maxDailyMinutes - (daily.get(day) ?? 0);
      const deadline = item.dueAt
        ? Math.floor((Date.parse(item.dueAt) - window.cursor) / 60_000)
        : Infinity;
      const minutes = Math.min(
        remaining,
        window.remaining,
        context.preferences.maximumBlockMinutes,
        cap,
        deadline,
      );
      if (minutes < context.preferences.minimumBlockMinutes) continue;
      const start = new Date(window.cursor).toISOString();
      const end = new Date(window.cursor + minutes * 60_000).toISOString();
      const id = `study:${hash(`${revision}|${item.id}|${start}|${minutes}`)}`;
      blocks.push({
        id,
        courseworkId: item.id,
        start,
        end,
        allocatedMinutes: minutes,
        status: "proposed",
        origin: "deterministic_planner",
        locked: false,
        revision,
        reasons: [item.dueAt ? "due_soon" : "work_remaining", window.kind],
      });
      remaining -= minutes;
      window.cursor += minutes * 60_000;
      window.remaining -= minutes;
      daily.set(day, (daily.get(day) ?? 0) + minutes);
    }
    unscheduledMinutes[item.id] = remaining;
  }

  const warnings = Object.values(unscheduledMinutes).some((value) => value > 0)
    ? ["Some work does not fit before its deadline in this horizon."]
    : [];
  return { blocks, unscheduledMinutes, warnings, revision };
}

export function transitionBlock(
  block: PlannedWorkBlock,
  status: PlannedWorkBlock["status"],
  expectedRevision?: string,
): PlannedWorkBlock {
  if (expectedRevision && block.revision !== expectedRevision)
    throw new Error("Stale planned-work revision");
  const allowed: Record<string, string[]> = {
    proposed: ["accepted", "cancelled"],
    accepted: ["completed", "missed", "cancelled"],
    completed: [],
    missed: [],
    cancelled: [],
  };
  if (!allowed[block.status]!.includes(status))
    throw new Error(`Invalid block transition: ${block.status} -> ${status}`);
  return { ...block, status, locked: status === "accepted" || status === "completed" };
}

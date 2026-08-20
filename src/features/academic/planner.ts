import type { AcademicPlanningContext, PlannedWorkBlock } from "./types";
import type { Meeting } from "@/lib/timetable-types";
import { needsScheduledWork } from "./types";
import { buildWorkWindows } from "./windows";

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
function fingerprint(c: AcademicPlanningContext) {
  return hash(
    JSON.stringify({
      h: c.horizon,
      m: c.academicMeetings,
      p: c.fixedPersonalCommitments,
      c: c.coursework,
      b: c.existingBlocks,
      x: c.preferences,
    }),
  );
}
export function createStudyPlan(
  context: AcademicPlanningContext,
  routeMinutes: (from: Meeting, to: Meeting) => number | null,
): StudyPlanProposal {
  const revision = fingerprint(context);
  const windows = buildWorkWindows(context, routeMinutes).map((w) => ({
    ...w,
    cursor: Date.parse(w.start),
    remaining: w.availableMinutes,
  }));
  const items = context.coursework.filter(needsScheduledWork).sort((a, b) => {
    const ad = a.dueAt ?? "9999",
      bd = b.dueAt ?? "9999";
    return (
      ad.localeCompare(bd) ||
      { high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority] ||
      a.id.localeCompare(b.id)
    );
  });
  const blocks: PlannedWorkBlock[] = [];
  const unscheduledMinutes: Record<string, number> = {};
  const daily = new Map<string, number>();
  for (const item of items) {
    let remaining = item.workEstimate.remainingMinutes;
    const preferLong = context.courseProfiles
      .find((p) => p.courseId === item.courseId)
      ?.characteristics.includes("prefers_long_sessions");
    const candidates = [...windows]
      .filter((w) => !item.dueAt || w.cursor < Date.parse(item.dueAt))
      .sort(
        (a, b) =>
          (preferLong ? b.remaining - a.remaining : 0) ||
          a.cursor - b.cursor ||
          a.id.localeCompare(b.id),
      );
    for (const w of candidates) {
      if (remaining < context.preferences.minimumBlockMinutes) break;
      const day = new Date(w.cursor).toISOString().slice(0, 10);
      const cap = context.preferences.maxDailyMinutes - (daily.get(day) ?? 0);
      const deadline = item.dueAt
        ? Math.floor((Date.parse(item.dueAt) - w.cursor) / 60000)
        : Infinity;
      const minutes = Math.min(
        remaining,
        w.remaining,
        context.preferences.maximumBlockMinutes,
        cap,
        deadline,
      );
      if (minutes < context.preferences.minimumBlockMinutes) continue;
      const start = new Date(w.cursor).toISOString(),
        end = new Date(w.cursor + minutes * 60000).toISOString();
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
        reasons: [item.dueAt ? "due_soon" : "work_remaining", w.kind],
      });
      remaining -= minutes;
      w.cursor += minutes * 60000;
      w.remaining -= minutes;
      daily.set(day, (daily.get(day) ?? 0) + minutes);
    }
    unscheduledMinutes[item.id] = remaining;
  }
  const warnings = Object.values(unscheduledMinutes).some((v) => v > 0)
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

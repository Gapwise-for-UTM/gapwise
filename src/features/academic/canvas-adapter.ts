import type { CourseworkItem, CourseworkKind, SubmissionState } from "./types";
import { isProviderSubmissionComplete } from "./types";
import { resolveWorkEstimate } from "./workload";

export interface CanvasAssignmentSnapshot {
  id: number;
  courseId: number;
  courseCode: string;
  name: string;
  description?: string | null;
  dueAt?: string | null;
  unlockAt?: string | null;
  updatedAt: string;
  pointsPossible?: number | null;
  submissionTypes?: string[];
  locked?: boolean;
  kind?: CourseworkKind;
  submission?: {
    workflowState?: "unsubmitted" | "submitted" | "graded";
    submittedAt?: string | null;
    gradedAt?: string | null;
    late?: boolean;
    missing?: boolean;
    attempt?: number;
  } | null;
}

function plainText(html?: string | null): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 1000) : undefined;
}

function submissionState(value: CanvasAssignmentSnapshot["submission"]): SubmissionState {
  if (!value) return "unknown";
  if (value.workflowState === "graded" || value.gradedAt) return "graded";
  if (value.workflowState === "submitted" || value.submittedAt)
    return value.late ? "late" : "submitted";
  if (value.missing) return "missing";
  return "unsubmitted";
}

export function normalizeCanvasAssignment(raw: CanvasAssignmentSnapshot): CourseworkItem {
  const summary = plainText(raw.description);
  const content: CourseworkItem["content"] = {};
  if (summary !== undefined) content.plainTextSummary = summary;
  if (raw.submissionTypes !== undefined) content.submissionTypes = raw.submissionTypes;
  return {
    id: `canvas:${raw.courseId}:${raw.id}`,
    provider: { provider: "canvas", courseRef: String(raw.courseId), itemRef: String(raw.id) },
    courseId: String(raw.courseId),
    courseCode: raw.courseCode,
    title: raw.name.trim(),
    kind: raw.kind ?? "assignment",
    availableAt: raw.unlockAt ?? null,
    dueAt: raw.dueAt ?? null,
    providerUpdatedAt: raw.updatedAt,
    pointsPossible: raw.pointsPossible ?? null,
    weightPercent: null,
    content,
    workEstimate: resolveWorkEstimate({ genericMinutes: 90 }),
    priority: "normal",
    submissionState: submissionState(raw.submission),
    localProgress: "not_started",
    provenance: { source: "canvas_fixture", confidence: "high" },
  };
}

export type CourseworkChange = {
  courseworkId: string;
  type:
    | "new"
    | "due_date_changed"
    | "assignment_changed"
    | "became_submitted"
    | "became_graded"
    | "became_overdue"
    | "reopened";
  from?: string | null;
  to?: string | null;
};
export function reconcileCoursework(
  previous: readonly CourseworkItem[],
  snapshots: readonly CanvasAssignmentSnapshot[],
  now: string,
) {
  const old = new Map(previous.map((item) => [item.id, item]));
  const changes: CourseworkChange[] = [];
  const coursework = snapshots.map((snapshot) => {
    const fresh = normalizeCanvasAssignment(snapshot);
    const prior = old.get(fresh.id);
    if (!prior) changes.push({ courseworkId: fresh.id, type: "new" });
    else {
      if (prior.dueAt !== fresh.dueAt)
        changes.push({
          courseworkId: fresh.id,
          type: "due_date_changed",
          from: prior.dueAt,
          to: fresh.dueAt,
        });
      if (prior.title !== fresh.title || prior.providerUpdatedAt !== fresh.providerUpdatedAt)
        changes.push({ courseworkId: fresh.id, type: "assignment_changed" });
      if (
        !isProviderSubmissionComplete(prior.submissionState) &&
        (fresh.submissionState === "submitted" || fresh.submissionState === "late")
      )
        changes.push({ courseworkId: fresh.id, type: "became_submitted" });
      if (prior.submissionState !== "graded" && fresh.submissionState === "graded")
        changes.push({ courseworkId: fresh.id, type: "became_graded" });
      if (
        isProviderSubmissionComplete(prior.submissionState) &&
        !isProviderSubmissionComplete(fresh.submissionState)
      )
        changes.push({ courseworkId: fresh.id, type: "reopened" });
      if (
        fresh.dueAt &&
        fresh.dueAt < now &&
        !isProviderSubmissionComplete(fresh.submissionState) &&
        (!prior.dueAt || prior.dueAt >= now)
      )
        changes.push({ courseworkId: fresh.id, type: "became_overdue" });
    }
    // Provider refresh owns provider facts, never student progress/estimates/priority.
    return prior
      ? {
          ...fresh,
          workEstimate: prior.workEstimate,
          localProgress: prior.localProgress,
          priority: prior.priority,
        }
      : fresh;
  });
  return { coursework, changes };
}

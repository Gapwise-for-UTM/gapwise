import type { CourseworkItem, CourseworkKind, SubmissionState } from "./types";
import { isProviderSubmissionComplete } from "./types";
import { resolveWorkEstimate } from "./workload";

export const MAX_PROVIDER_DESCRIPTION_LENGTH = 4_000;
const MAX_PROVIDER_HTML_INPUT_LENGTH = 64_000;

function decodeTextEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00a0",
  };
  let result = "";
  for (let index = 0; index < value.length; index++) {
    if (value[index] !== "&") {
      result += value[index];
      continue;
    }
    const semicolon = value.indexOf(";", index + 1);
    if (semicolon < 0 || semicolon - index > 12) {
      result += "&";
      continue;
    }
    const entity = value.slice(index + 1, semicolon);
    let decoded = named[entity];
    if (!decoded && entity[0] === "#") {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const digits = entity.slice(hexadecimal ? 2 : 1);
      const point = Number.parseInt(digits, hexadecimal ? 16 : 10);
      if (/^[0-9a-f]+$/i.test(digits) && point > 0 && point <= 0x10ffff)
        decoded = String.fromCodePoint(point);
    }
    if (decoded === undefined) {
      result += value.slice(index, semicolon + 1);
      index = semicolon;
      continue;
    }
    result += decoded;
    index = semicolon;
  }
  return result;
}

export interface ProviderAssignmentSnapshot {
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

/**
 * Converts provider-shaped HTML to bounded inert text without constructing or rendering a DOM.
 * The scanner deliberately decodes each text node exactly once, so encoded markup stays text.
 */
export function normalizeProviderDescription(html?: string | null): string | undefined {
  if (!html) return undefined;
  const source = html.slice(0, MAX_PROVIDER_HTML_INPUT_LENGTH);
  const blockElements = new Set([
    "br",
    "div",
    "p",
    "li",
    "ul",
    "ol",
    "tr",
    "td",
    "th",
    "blockquote",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
  ]);
  let output = "";
  let cursor = 0;
  let ignored: "script" | "style" | null = null;
  const append = (value: string) => {
    if (output.length >= MAX_PROVIDER_DESCRIPTION_LENGTH) return;
    output += value.slice(0, MAX_PROVIDER_DESCRIPTION_LENGTH - output.length);
  };

  while (cursor < source.length && output.length < MAX_PROVIDER_DESCRIPTION_LENGTH) {
    const tagStart = source.indexOf("<", cursor);
    if (tagStart < 0) {
      if (!ignored) append(decodeTextEntities(source.slice(cursor)));
      break;
    }
    if (!ignored && tagStart > cursor) append(decodeTextEntities(source.slice(cursor, tagStart)));
    if (source.startsWith("<!--", tagStart)) {
      const end = source.indexOf("-->", tagStart + 4);
      cursor = end < 0 ? source.length : end + 3;
      continue;
    }
    const tagEnd = source.indexOf(">", tagStart + 1);
    if (tagEnd < 0) {
      if (!ignored) append(decodeTextEntities(source.slice(tagStart)));
      break;
    }
    const rawTag = source.slice(tagStart + 1, tagEnd).trim();
    const closing = rawTag.startsWith("/");
    const nameStart = closing ? 1 : 0;
    let nameEnd = nameStart;
    while (nameEnd < rawTag.length && /[A-Za-z0-9:-]/.test(rawTag[nameEnd]!)) nameEnd++;
    const name = rawTag.slice(nameStart, nameEnd).toLowerCase();
    if (!closing && (name === "script" || name === "style")) ignored = name;
    else if (closing && name === ignored) ignored = null;
    else if (!ignored && blockElements.has(name)) append("\n");
    cursor = tagEnd + 1;
  }

  const text = output
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\r?\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return text || undefined;
}

function submissionState(value: ProviderAssignmentSnapshot["submission"]): SubmissionState {
  if (!value) return "unknown";
  if (value.workflowState === "graded" || value.gradedAt) return "graded";
  if (value.workflowState === "submitted" || value.submittedAt)
    return value.late ? "late" : "submitted";
  if (value.missing) return "missing";
  return "unsubmitted";
}

export function normalizeProviderAssignment(raw: ProviderAssignmentSnapshot): CourseworkItem {
  const summary = normalizeProviderDescription(raw.description);
  const content: CourseworkItem["content"] = {};
  if (summary !== undefined) content.plainTextSummary = summary;
  if (raw.submissionTypes !== undefined) content.submissionTypes = raw.submissionTypes;
  return {
    id: `provider:${raw.courseId}:${raw.id}`,
    provider: { provider: "other", courseRef: String(raw.courseId), itemRef: String(raw.id) },
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
    provenance: { source: "provider_fixture", confidence: "high" },
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
  snapshots: readonly ProviderAssignmentSnapshot[],
  now: string,
) {
  const old = new Map(previous.map((item) => [item.id, item]));
  const changes: CourseworkChange[] = [];
  const coursework = snapshots.map((snapshot) => {
    const fresh = normalizeProviderAssignment(snapshot);
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

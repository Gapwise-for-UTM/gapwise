import type { Meeting } from "./timetable-types";

type CourseTitleShard = {
  prefix?: unknown;
  titles?: unknown;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

// U of T course identifiers use a three-letter subject family, but the next
// character is not always numeric: UTSC uses codes such as CSCA08H3 and MATA31H3.
const PREFIX_PATTERN = /^([A-Z]{3})[A-Z0-9]\d{2}[A-Z]\d?$/;
const REQUEST_TIMEOUT_MS = 2_500;
const shardCache = new Map<string, Promise<Readonly<Record<string, string>>>>();

function coursePrefix(courseCode: string): string | null {
  return courseCode.trim().toUpperCase().match(PREFIX_PATTERN)?.[1] ?? null;
}

function normalizeTitles(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const titles: Record<string, string> = {};
  for (const [rawCode, rawTitle] of Object.entries(value)) {
    if (typeof rawTitle !== "string") continue;
    const code = rawCode.trim().toUpperCase();
    const title = rawTitle.trim();
    if (!code || !title) continue;
    titles[code] = title;
  }
  return titles;
}

async function requestShard(
  prefix: string,
  fetchImpl: FetchLike,
): Promise<Readonly<Record<string, string>>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`/api/course-titles?prefix=${encodeURIComponent(prefix)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return {};

    const payload = (await response.json()) as CourseTitleShard;
    if (typeof payload.prefix !== "string" || payload.prefix.toUpperCase() !== prefix) return {};
    return normalizeTitles(payload.titles);
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

async function loadShard(
  prefix: string,
  fetchImpl: FetchLike,
): Promise<Readonly<Record<string, string>>> {
  // Production requests are cached by subject prefix for the lifetime of the page.
  // Custom fetch implementations are intentionally uncached so tests and callers
  // that inject transport behavior cannot contaminate the browser cache.
  if (fetchImpl !== globalThis.fetch) return requestShard(prefix, fetchImpl);

  const cached = shardCache.get(prefix);
  if (cached) return cached;

  const pending = requestShard(prefix, fetchImpl).then((titles) => {
    if (Object.keys(titles).length === 0) shardCache.delete(prefix);
    return titles;
  });
  shardCache.set(prefix, pending);
  return pending;
}

/**
 * Replace ACORN's sometimes-truncated DESCRIPTION title with the canonical title
 * returned by Gapwise's subject-prefix catalog endpoint.
 *
 * The raw .ics file and exact course list remain browser-local. The only lookup
 * keys sent to Gapwise are three-letter subject prefixes such as CSC or MAT.
 * Failure is non-fatal: the ACORN title already parsed into each meeting remains
 * the fallback so timetable import never depends on this enrichment service.
 */
export async function enrichCourseTitles(
  meetings: readonly Meeting[],
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<Meeting[]> {
  const prefixes = [
    ...new Set(meetings.map((meeting) => coursePrefix(meeting.courseCode)).filter(Boolean)),
  ] as string[];

  if (prefixes.length === 0 || typeof fetchImpl !== "function") return [...meetings];

  const shards = await Promise.all(
    prefixes.map(async (prefix) => [prefix, await loadShard(prefix, fetchImpl)] as const),
  );
  const byPrefix = new Map(shards);

  return meetings.map((meeting) => {
    const prefix = coursePrefix(meeting.courseCode);
    if (!prefix) return meeting;
    const canonicalTitle = byPrefix.get(prefix)?.[meeting.courseCode.trim().toUpperCase()];
    if (!canonicalTitle || canonicalTitle === meeting.courseName) return meeting;
    return { ...meeting, courseName: canonicalTitle };
  });
}

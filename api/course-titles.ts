const TTB_REFERENCE_URL = "https://api.easi.utoronto.ca/ttb/reference-data";
const TTB_COURSES_URL = "https://api.easi.utoronto.ca/ttb/getPageableCourses";
const PAGE_SIZE = 100;
const MAX_PAGES = 25;
const UPSTREAM_TIMEOUT_MS = 7_500;
const REFERENCE_CACHE_MS = 6 * 60 * 60 * 1_000;

type Facets = {
  sessions: string[];
  divisions: string[];
};

let referenceCache: { expiresAt: number; facets: Facets } | null = null;

function json(data: unknown, status = 200, cacheControl?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  return new Response(JSON.stringify(data), { status, headers });
}

function upstreamHeaders(jsonBody = false): HeadersInit {
  return {
    Accept: "application/json",
    ...(jsonBody ? { "Content-Type": "application/json" } : {}),
    Referer: "https://ttb.utoronto.ca/",
    "User-Agent": "Gapwise/1.0 (+https://gapwise.ca)",
  };
}

function optionValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item) => item && typeof item === "object" && (item as { header?: unknown }).header !== true)
        .map((item) => (item as { value?: unknown }).value)
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim()),
    ),
  ];
}

function referenceFacets(value: unknown): Facets | null {
  if (!value || typeof value !== "object") return null;
  const payload = (value as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return null;

  const sessions = optionValues((payload as { currentSessions?: unknown }).currentSessions);
  const divisions = optionValues((payload as { divisions?: unknown }).divisions);
  if (sessions.length === 0 || divisions.length === 0) return null;
  return { sessions, divisions };
}

async function getReferenceFacets(fetchImpl: typeof fetch, signal: AbortSignal): Promise<Facets> {
  const canUseSharedCache = fetchImpl === globalThis.fetch;
  if (canUseSharedCache && referenceCache && referenceCache.expiresAt > Date.now()) {
    return referenceCache.facets;
  }

  const response = await fetchImpl(TTB_REFERENCE_URL, {
    method: "GET",
    headers: upstreamHeaders(),
    signal,
  });
  if (!response.ok) throw new Error(`Timetable Builder reference data returned ${response.status}.`);

  const facets = referenceFacets(await response.json());
  if (!facets) throw new Error("Timetable Builder reference data had an unexpected payload.");

  if (canUseSharedCache) {
    referenceCache = { expiresAt: Date.now() + REFERENCE_CACHE_MS, facets };
  }
  return facets;
}

function searchBody(prefix: string, page: number, facets: Facets) {
  return {
    courseCodeAndTitleProps: {
      courseCode: prefix,
      courseTitle: "",
      courseSectionCode: "",
    },
    departmentProps: [],
    campuses: [],
    sessions: facets.sessions,
    requirementProps: [],
    instructor: "",
    courseLevels: [],
    deliveryModes: [],
    dayPreferences: [],
    timePreferences: [],
    divisions: facets.divisions,
    creditWeights: [],
    availableSpace: false,
    waitListable: false,
    page,
    pageSize: PAGE_SIZE,
    direction: "asc",
  };
}

function pageableCourse(value: unknown): { courses: unknown[]; total: number } | null {
  if (!value || typeof value !== "object") return null;
  const payload = (value as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return null;
  const pageable = (payload as { pageableCourse?: unknown }).pageableCourse;
  if (!pageable || typeof pageable !== "object") return null;

  const courses = (pageable as { courses?: unknown }).courses;
  const total = (pageable as { total?: unknown }).total;
  if (!Array.isArray(courses) || typeof total !== "number") return null;
  return { courses, total };
}

function addTitles(
  prefix: string,
  courses: readonly unknown[],
  titles: Record<string, string>,
): void {
  for (const rawCourse of courses) {
    if (!rawCourse || typeof rawCourse !== "object") continue;
    const rawCode = (rawCourse as { code?: unknown }).code;
    const rawName = (rawCourse as { name?: unknown }).name;
    if (typeof rawCode !== "string" || typeof rawName !== "string") continue;

    const code = rawCode.trim().toUpperCase();
    const name = rawName.trim();
    if (!code.startsWith(prefix) || !name || titles[code]) continue;
    titles[code] = name;
  }
}

export async function fetchCourseTitlesByPrefix(
  prefix: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Readonly<Record<string, string>>> {
  const normalizedPrefix = prefix.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedPrefix)) {
    throw new TypeError("Course-title prefix must be exactly three letters.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const titles: Record<string, string> = {};

  try {
    const facets = await getReferenceFacets(fetchImpl, controller.signal);
    let seen = 0;
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await fetchImpl(TTB_COURSES_URL, {
        method: "POST",
        headers: upstreamHeaders(true),
        body: JSON.stringify(searchBody(normalizedPrefix, page, facets)),
        signal: controller.signal,
      });

      // The TTB API returns 404 for a valid search with no matches.
      if (response.status === 404 && page === 1) return {};
      if (!response.ok) throw new Error(`Timetable Builder returned ${response.status}.`);

      const parsed = pageableCourse(await response.json());
      if (!parsed) throw new Error("Timetable Builder returned an unexpected payload.");

      addTitles(normalizedPrefix, parsed.courses, titles);
      seen += parsed.courses.length;
      if (parsed.courses.length === 0 || seen >= parsed.total) return titles;
    }

    throw new Error("Timetable Builder pagination exceeded the safety limit.");
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request: Request) {
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed", message: "Use GET." }, 405);
    }

    const prefix = new URL(request.url).searchParams.get("prefix")?.trim().toUpperCase() ?? "";
    if (!/^[A-Z]{3}$/.test(prefix)) {
      return json(
        { error: "invalid_prefix", message: "Provide a three-letter course subject prefix." },
        400,
      );
    }

    try {
      const titles = await fetchCourseTitlesByPrefix(prefix);
      return json(
        {
          schemaVersion: 1,
          prefix,
          source: "University of Toronto Timetable Builder",
          titles,
        },
        200,
        "public, s-maxage=86400, stale-while-revalidate=604800",
      );
    } catch (error) {
      console.error("course-title lookup failed", error);
      return json(
        {
          error: "course_title_lookup_unavailable",
          message: "Canonical course titles are temporarily unavailable.",
        },
        502,
        "public, s-maxage=60",
      );
    }
  },
};

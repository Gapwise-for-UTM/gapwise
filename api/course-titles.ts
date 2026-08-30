const TTB_REFERENCE_URL = "https://api.easi.utoronto.ca/ttb/reference-data";
const TTB_COURSES_URL = "https://api.easi.utoronto.ca/ttb/getPageableCourses";
const REQUESTED_PAGE_SIZE = 100;
const UPSTREAM_TIMEOUT_MS = 8_500;
const REFERENCE_CACHE_MS = 6 * 60 * 60 * 1_000;
const MAX_CACHED_PAGES = 64;
const MAX_PREFIX_PAGES = 20;

type Facets = {
  sessions: string[];
  divisions: string[];
};

type CourseRow = {
  code: string;
  name: string;
};

type CoursePage = {
  courses: CourseRow[];
  total: number;
  page: number;
  pageSize: number;
};

let referenceCache: { expiresAt: number; facets: Facets } | null = null;
const pageCache = new Map<string, Promise<CoursePage>>();

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
        .filter(
          (item) =>
            item && typeof item === "object" && (item as { header?: unknown }).header !== true,
        )
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
  if (!response.ok) {
    throw new Error(`Timetable Builder reference data returned ${response.status}.`);
  }

  const facets = referenceFacets(await response.json());
  if (!facets) throw new Error("Timetable Builder reference data had an unexpected payload.");

  if (canUseSharedCache) {
    referenceCache = { expiresAt: Date.now() + REFERENCE_CACHE_MS, facets };
  }
  return facets;
}

function searchBody(page: number, facets: Facets) {
  return {
    // TTB's course-code field is an exact-code search, not a prefix search. We
    // therefore page the alphabetically sorted catalog and locate the requested
    // subject prefix without ever receiving the student's exact course codes.
    courseCodeAndTitleProps: {
      courseCode: "",
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
    pageSize: REQUESTED_PAGE_SIZE,
    direction: "asc",
  };
}

function normalizePage(value: unknown, requestedPage: number): CoursePage | null {
  if (!value || typeof value !== "object") return null;
  const payload = (value as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return null;
  const pageable = (payload as { pageableCourse?: unknown }).pageableCourse;
  if (!pageable || typeof pageable !== "object") return null;

  const rawCourses = (pageable as { courses?: unknown }).courses;
  const total = (pageable as { total?: unknown }).total;
  const rawPage = (pageable as { page?: unknown }).page;
  const rawPageSize = (pageable as { pageSize?: unknown }).pageSize;
  if (!Array.isArray(rawCourses) || typeof total !== "number") return null;

  const courses = rawCourses
    .map((course): CourseRow | null => {
      if (!course || typeof course !== "object") return null;
      const rawCode = (course as { code?: unknown }).code;
      const rawName = (course as { name?: unknown }).name;
      if (typeof rawCode !== "string" || typeof rawName !== "string") return null;
      const code = rawCode.trim().toUpperCase();
      const name = rawName.trim();
      return code && name ? { code, name } : null;
    })
    .filter((course): course is CourseRow => course !== null);

  const page = Number.isInteger(rawPage) && Number(rawPage) >= 1 ? Number(rawPage) : requestedPage;
  const pageSize =
    Number.isInteger(rawPageSize) && Number(rawPageSize) >= 1
      ? Number(rawPageSize)
      : Math.max(courses.length, 1);

  for (let index = 1; index < courses.length; index += 1) {
    if (courses[index - 1]!.code.localeCompare(courses[index]!.code) > 0) {
      throw new Error("Timetable Builder course ordering changed unexpectedly.");
    }
  }

  return { courses, total, page, pageSize };
}

function pageCacheKey(page: number, facets: Facets): string {
  return `${facets.sessions.join(",")}|${facets.divisions.join(",")}|${page}`;
}

function rememberPage(key: string, value: Promise<CoursePage>): void {
  pageCache.set(key, value);
  while (pageCache.size > MAX_CACHED_PAGES) {
    const oldest = pageCache.keys().next().value as string | undefined;
    if (!oldest) break;
    pageCache.delete(oldest);
  }
}

async function requestPage(
  page: number,
  facets: Facets,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<CoursePage> {
  const response = await fetchImpl(TTB_COURSES_URL, {
    method: "POST",
    headers: upstreamHeaders(true),
    body: JSON.stringify(searchBody(page, facets)),
    signal,
  });
  if (!response.ok)
    throw new Error(`Timetable Builder returned ${response.status} for page ${page}.`);

  const parsed = normalizePage(await response.json(), page);
  if (!parsed) throw new Error("Timetable Builder returned an unexpected course payload.");
  return parsed;
}

async function getPage(
  page: number,
  facets: Facets,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<CoursePage> {
  if (fetchImpl !== globalThis.fetch) return requestPage(page, facets, fetchImpl, signal);

  const key = pageCacheKey(page, facets);
  const cached = pageCache.get(key);
  if (cached) return cached;

  const pending = requestPage(page, facets, fetchImpl, signal).catch((error) => {
    pageCache.delete(key);
    throw error;
  });
  rememberPage(key, pending);
  return pending;
}

function maxCode(page: CoursePage): string | null {
  return page.courses.at(-1)?.code ?? null;
}

function addMatchingTitles(
  prefix: string,
  courses: readonly CourseRow[],
  titles: Record<string, string>,
): void {
  for (const course of courses) {
    if (course.code.startsWith(prefix) && !titles[course.code]) titles[course.code] = course.name;
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
  const prefixUpperBound = `${normalizedPrefix}\uffff`;

  try {
    const facets = await getReferenceFacets(fetchImpl, controller.signal);
    const pages = new Map<number, CoursePage>();
    const loadPage = async (pageNumber: number): Promise<CoursePage> => {
      const cached = pages.get(pageNumber);
      if (cached) return cached;
      const page = await getPage(pageNumber, facets, fetchImpl, controller.signal);
      pages.set(pageNumber, page);
      return page;
    };

    const firstPage = await loadPage(1);
    if (firstPage.total <= 0 || firstPage.courses.length === 0) return titles;

    const effectivePageSize = firstPage.pageSize;
    const totalPages = Math.max(1, Math.ceil(firstPage.total / effectivePageSize));

    // Find the first page whose final course code is not lexicographically before
    // the requested prefix. TTB sorts course results ascending by course code.
    let low = 1;
    let high = totalPages;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const page = await loadPage(middle);
      const last = maxCode(page);
      if (!last) throw new Error(`Timetable Builder returned an empty page ${middle}.`);
      if (last.localeCompare(normalizedPrefix) < 0) low = middle + 1;
      else high = middle;
    }

    let pagesRead = 0;
    for (let pageNumber = low; pageNumber <= totalPages; pageNumber += 1) {
      pagesRead += 1;
      if (pagesRead > MAX_PREFIX_PAGES) {
        throw new Error(`Course prefix ${normalizedPrefix} exceeded the page safety limit.`);
      }

      const page = await loadPage(pageNumber);
      addMatchingTitles(normalizedPrefix, page.courses, titles);

      const last = maxCode(page);
      if (!last || last.localeCompare(prefixUpperBound) > 0) break;
    }

    return titles;
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

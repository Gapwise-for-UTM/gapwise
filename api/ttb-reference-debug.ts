const REFERENCE = "https://api.easi.utoronto.ca/ttb/reference-data";
const COURSES = "https://api.easi.utoronto.ca/ttb/getPageableCourses";

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Referer: "https://ttb.utoronto.ca/",
  "User-Agent": "Gapwise/1.0 (+https://gapwise.ca)",
};

function body(divisions: string[], pageSize: number) {
  return {
    courseCodeAndTitleProps: { courseCode: "", courseTitle: "", courseSectionCode: "" },
    departmentProps: [],
    campuses: [],
    sessions: ["20269"],
    requirementProps: [],
    instructor: "",
    courseLevels: [],
    deliveryModes: [],
    dayPreferences: [],
    timePreferences: [],
    divisions,
    creditWeights: [],
    availableSpace: false,
    waitListable: false,
    page: 1,
    pageSize,
    direction: "asc",
  };
}

async function probe(label: string, divisions: string[], pageSize: number) {
  const started = Date.now();
  const response = await fetch(COURSES, {
    method: "POST",
    headers,
    body: JSON.stringify(body(divisions, pageSize)),
  });
  const data = (await response.json()) as {
    payload?: { pageableCourse?: { total?: unknown; courses?: unknown[] } };
  };
  const pageable = data.payload?.pageableCourse;
  return {
    label,
    status: response.status,
    elapsedMs: Date.now() - started,
    total: pageable?.total ?? null,
    returned: Array.isArray(pageable?.courses) ? pageable.courses.length : null,
  };
}

export default {
  async fetch() {
    const reference = await fetch(REFERENCE, {
      headers: { Accept: "application/json", Referer: "https://ttb.utoronto.ca/" },
    });
    const ref = (await reference.json()) as {
      payload?: { divisions?: Array<{ value?: string; header?: boolean }> };
    };
    const divisions = [
      ...new Set(
        (ref.payload?.divisions ?? [])
          .filter((item) => item.header !== true && typeof item.value === "string")
          .map((item) => item.value!),
      ),
    ];
    const probes = await Promise.all([
      probe("ERIN-100", ["ERIN"], 100),
      probe("ERIN-1000", ["ERIN"], 1000),
      probe("ALL-1000", divisions, 1000),
      probe("ALL-10000", divisions, 10000),
    ]);
    return new Response(JSON.stringify({ divisions, probes }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

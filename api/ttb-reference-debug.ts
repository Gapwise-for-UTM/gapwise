const REFERENCE = "https://api.easi.utoronto.ca/ttb/reference-data";
const COURSES = "https://api.easi.utoronto.ca/ttb/getPageableCourses";

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Referer: "https://ttb.utoronto.ca/",
  "User-Agent": "Gapwise/1.0 (+https://gapwise.ca)",
};

function body(courseCode: string) {
  return {
    courseCodeAndTitleProps: { courseCode, courseTitle: "", courseSectionCode: "" },
    departmentProps: [],
    campuses: [],
    sessions: ["20269"],
    requirementProps: [],
    instructor: "",
    courseLevels: [],
    deliveryModes: [],
    dayPreferences: [],
    timePreferences: [],
    divisions: ["ERIN"],
    creditWeights: [],
    availableSpace: false,
    waitListable: false,
    page: 1,
    pageSize: 10,
    direction: "asc",
  };
}

async function probe(courseCode: string) {
  const response = await fetch(COURSES, {
    method: "POST",
    headers,
    body: JSON.stringify(body(courseCode)),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  const pageable =
    data && typeof data === "object"
      ? (data as { payload?: { pageableCourse?: { total?: unknown; courses?: unknown[] } } }).payload
          ?.pageableCourse
      : undefined;
  return {
    query: courseCode,
    status: response.status,
    total: pageable?.total ?? null,
    courses: Array.isArray(pageable?.courses)
      ? pageable.courses.slice(0, 5).map((course) => {
          const row = course as { code?: unknown; name?: unknown };
          return { code: row.code, name: row.name };
        })
      : [],
  };
}

export default {
  async fetch() {
    const reference = await fetch(REFERENCE, {
      headers: { Accept: "application/json", Referer: "https://ttb.utoronto.ca/" },
    });
    const probes = await Promise.all(["CSC", "CSC*", "CSC%", "CSC110Y5", ""].map(probe));
    return new Response(JSON.stringify({ referenceStatus: reference.status, probes }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

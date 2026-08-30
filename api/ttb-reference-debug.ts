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
    pageSize: 20,
    direction: "asc",
  };
}

export default {
  async fetch() {
    const response = await fetch(COURSES, {
      method: "POST",
      headers,
      body: JSON.stringify(body("CSC110Y5")),
    });
    const data = (await response.json()) as {
      payload?: { pageableCourse?: { courses?: unknown[] } };
    };
    return new Response(
      JSON.stringify({ status: response.status, course: data.payload?.pageableCourse?.courses?.[0] ?? null }),
      { headers: { "Content-Type": "application/json" } },
    );
  },
};

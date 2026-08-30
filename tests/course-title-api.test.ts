import { describe, expect, test } from "bun:test";
import { fetchCourseTitlesByPrefix } from "../api/course-titles";

describe("course-title API source adapter", () => {
  test("queries the U of T timetable by subject prefix and returns canonical names", async () => {
    const bodies: unknown[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/reference-data")) {
        return new Response(
          JSON.stringify({
            payload: {
              currentSessions: [
                { value: "Fall", header: true },
                { value: "20269", header: false },
                { value: "20271", header: false },
              ],
              divisions: [
                { value: "ARTSC", header: false },
                { value: "ERIN", header: false },
                { value: "SCAR", header: false },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response(
        JSON.stringify({
          payload: {
            pageableCourse: {
              courses: [
                { code: "CSC110Y5", name: "Foundations of Computer Science 1" },
                { code: "CSC111H5", name: "Foundations of Computer Science 2" },
                { code: "MAT157H5", name: "Analysis I" },
              ],
              total: 3,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const titles = await fetchCourseTitlesByPrefix("csc", fakeFetch);

    expect(titles).toEqual({
      CSC110Y5: "Foundations of Computer Science 1",
      CSC111H5: "Foundations of Computer Science 2",
    });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      courseCodeAndTitleProps: { courseCode: "CSC" },
      sessions: ["20269", "20271"],
      divisions: ["ARTSC", "ERIN", "SCAR"],
      page: 1,
      pageSize: 100,
    });
  });

  test("rejects arbitrary lookup keys before contacting the upstream service", async () => {
    let called = false;
    const fakeFetch: typeof fetch = async () => {
      called = true;
      return new Response();
    };

    await expect(fetchCourseTitlesByPrefix("CSC110Y5", fakeFetch)).rejects.toThrow(
      "exactly three letters",
    );
    expect(called).toBe(false);
  });
});

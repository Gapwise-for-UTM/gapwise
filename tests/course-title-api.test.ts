import { describe, expect, test } from "bun:test";
import { fetchCourseTitlesByPrefix } from "../api/course-titles";

type MockCourse = { code: string; name: string };

const MOCK_PAGES: Record<number, MockCourse[]> = {
  1: [
    { code: "ANT100H1", name: "Introduction to Anthropology" },
    { code: "BIO120H1", name: "Adaptation and Biodiversity" },
  ],
  2: [
    { code: "CSC110Y5", name: "Foundations of Computer Science 1" },
    { code: "CSC111H5", name: "Foundations of Computer Science 2" },
  ],
  3: [
    { code: "MAT157H5", name: "Analysis I" },
    { code: "PSY100H5", name: "Introduction to Psychology" },
  ],
};

describe("course-title API source adapter", () => {
  test("locates a subject prefix without sending exact course codes upstream", async () => {
    const bodies: Array<Record<string, unknown>> = [];
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

      const requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      bodies.push(requestBody);
      const page = Number(requestBody["page"] ?? 1);
      return new Response(
        JSON.stringify({
          payload: {
            pageableCourse: {
              courses: MOCK_PAGES[page] ?? [],
              total: 6,
              page,
              pageSize: 2,
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
    expect(bodies.map((body) => body["page"])).toEqual([1, 2, 3]);
    for (const body of bodies) {
      expect(body).toMatchObject({
        courseCodeAndTitleProps: { courseCode: "" },
        sessions: ["20269", "20271"],
        divisions: ["ARTSC", "ERIN", "SCAR"],
        pageSize: 100,
      });
      expect(JSON.stringify(body)).not.toContain("CSC110Y5");
    }
  });

  test("returns an empty map when the prefix falls between catalog ranges", async () => {
    const fakeFetch: typeof fetch = async (input, init) => {
      if (String(input).endsWith("/reference-data")) {
        return new Response(
          JSON.stringify({
            payload: {
              currentSessions: [{ value: "20269", header: false }],
              divisions: [{ value: "ERIN", header: false }],
            },
          }),
          { status: 200 },
        );
      }
      const requestBody = JSON.parse(String(init?.body ?? "{}")) as { page?: number };
      const page = Number(requestBody.page ?? 1);
      return new Response(
        JSON.stringify({
          payload: {
            pageableCourse: {
              courses: MOCK_PAGES[page] ?? [],
              total: 6,
              page,
              pageSize: 2,
            },
          },
        }),
        { status: 200 },
      );
    };

    await expect(fetchCourseTitlesByPrefix("ECO", fakeFetch)).resolves.toEqual({});
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

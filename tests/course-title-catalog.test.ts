import { describe, expect, test } from "bun:test";
import { enrichCourseTitles } from "@/lib/course-title-catalog";
import { parseIcs } from "@/lib/ics-parser";

function truncatedCscIcs() {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:csc110@gapwise.test",
    "DTSTART:20260909T090000",
    "DTEND:20260909T110000",
    "SUMMARY:CSC110Y5 LEC0101",
    "DESCRIPTION:Foundations of Computer\\nMAANJIWE NENDAMOWINAN",
    "LOCATION:MN 1270",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

describe("canonical course title enrichment", () => {
  test("keeps ACORN's exported title as the parser fallback with no hardcoded course names", () => {
    const parsed = parseIcs(truncatedCscIcs());
    expect(parsed.meetings).toHaveLength(1);
    expect(parsed.meetings[0]?.courseCode).toBe("CSC110Y5");
    expect(parsed.meetings[0]?.courseName).toBe("Foundations of Computer");
  });

  test("replaces a truncated title from a subject-prefix catalog lookup", async () => {
    const parsed = parseIcs(truncatedCscIcs());
    const requests: string[] = [];
    const fakeFetch = async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(
        JSON.stringify({
          schemaVersion: 1,
          prefix: "CSC",
          titles: { CSC110Y5: "Foundations of Computer Science 1" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const enriched = await enrichCourseTitles(parsed.meetings, fakeFetch);

    expect(enriched[0]?.courseName).toBe("Foundations of Computer Science 1");
    expect(requests).toEqual(["/api/course-titles?prefix=CSC"]);
    expect(requests[0]).not.toContain("CSC110Y5");
  });

  test("preserves the ACORN fallback when canonical lookup is unavailable", async () => {
    const parsed = parseIcs(truncatedCscIcs());
    const fakeFetch = async () => new Response("unavailable", { status: 502 });

    const enriched = await enrichCourseTitles(parsed.meetings, fakeFetch);

    expect(enriched[0]?.courseName).toBe("Foundations of Computer");
  });
});

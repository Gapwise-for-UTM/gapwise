import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("mobile Today summary uses the selected-term meeting count", () => {
  const source = readFileSync(new URL("../src/routes/_app.tsx", import.meta.url), "utf8");

  expect(source).toContain("meetingCount={termMeetings.length}");
  expect(source).not.toContain("meetingCount={meetings.length}");
});

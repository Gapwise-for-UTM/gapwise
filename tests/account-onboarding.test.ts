import { describe, expect, test } from "bun:test";
import { getAccountOnboardingAction } from "@/features/onboarding/account-onboarding-action";

describe("account onboarding next action", () => {
  test("returns students with a browser timetable to their day", () => {
    expect(getAccountOnboardingAction(true)).toEqual({
      label: "Back to my day",
      kind: "continue",
    });
  });

  test("starts the server-confirmed import handoff for an empty browser", () => {
    expect(getAccountOnboardingAction(false)).toEqual({
      label: "Import ACORN timetable",
      kind: "import",
    });
  });
});

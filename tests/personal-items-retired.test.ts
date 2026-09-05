import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

describe("retired Personal Items surface", () => {
  test("current timetable and gap calculations ignore legacy personal items", async () => {
    const [app, context] = await Promise.all([
      readFile("src/routes/_app.tsx", "utf8"),
      readFile("src/features/schedule/use-selected-schedule-context.ts", "utf8"),
    ]);
    expect(app).not.toContain("Add personal");
    expect(app).not.toContain("PersonalItemForm");
    expect(app).not.toContain("onCreatePersonal=");
    expect(context).toContain("composeTermSchedule(meetings ?? EMPTY_MEETINGS, [], term)");
    expect(context).not.toContain("PersonalItem");
  });

  test("personal-item form/commands are gone but encrypted compatibility storage remains", async () => {
    expect(existsSync("src/components/PersonalItemForm.tsx")).toBe(false);
    expect(existsSync("src/features/personal/use-personal-item-commands.ts")).toBe(false);
    expect(existsSync("src/lib/personal-types.ts")).toBe(true);
    const [app, privateData] = await Promise.all([
      readFile("src/routes/_app.tsx", "utf8"),
      readFile("src/features/security/private-data.ts", "utf8"),
    ]);
    expect(app).toContain("personalItems={personalItems}");
    expect(privateData).toContain("personalItems");
  });

  test("desktop and mobile gaps are actionable and exact-selection aware", async () => {
    const [grid, mobile, gapPlan] = await Promise.all([
      readFile("src/components/TimetableGrid.tsx", "utf8"),
      readFile("src/components/mobile/MobileTimetable.tsx", "utf8"),
      readFile("src/components/GapPlan.tsx", "utf8"),
    ]);
    expect(grid).toContain('data-gap-interactive="true"');
    expect(grid).toContain("onOpenGap?.(gap)");
    expect(grid).toContain("Open gap plan.");
    expect(grid).not.toContain("onCreatePersonal");
    expect(grid).not.toContain("onResizePersonal");
    expect(mobile).toContain("onOpenGapPlan(gap)");
    expect(mobile).not.toContain("Add personal item");
    expect(gapPlan).toContain("peekQueuedGapPlanSelection");
    expect(gapPlan).toContain("subscribeGapPlanSelection");
  });
});

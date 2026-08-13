import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectLanding, watchForAppFailures } from "./helpers";

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        html: node.html,
        failureSummary: node.failureSummary,
      })),
    })),
    "serious or critical axe violations",
  ).toEqual([]);
}

test("core release journey has no serious or critical automatic a11y violations", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "axe gate runs once in desktop Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await expectLanding(page);
  await expectNoSeriousAccessibilityViolations(page);

  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page.getByRole("heading", { name: "Demo timetable" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  const viewMode = page.getByRole("group", { name: "View mode" });
  await viewMode.getByRole("button", { name: "Gap plan" }).click();
  await expect(page.getByText("Tune gap recommendations")).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  await viewMode.getByRole("button", { name: "Day route" }).click();
  await expect(page.getByRole("heading", { name: "Route preferences" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  guard.assertClean();
});

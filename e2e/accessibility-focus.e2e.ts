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

async function openStableDemo(page: Page) {
  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page.getByRole("heading", { name: "Demo timetable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update timetable" })).toBeEnabled();
}

async function openTimetableExport(page: Page) {
  await page.getByRole("button", { name: "Account settings" }).click();
  const settings = page.getByRole("dialog", { name: "Account settings" });
  await expect(settings).toBeVisible();
  await settings.getByRole("tab", { name: "Exports" }).click();
  await settings.getByRole("button", { name: "Export timetable" }).click();
}

test("timetable export dialog is keyboard operable and restores trigger focus", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "keyboard focus gate runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await openStableDemo(page);

  await page.getByRole("button", { name: "Account settings" }).click();
  const settings = page.getByRole("dialog", { name: "Account settings" });
  await settings.getByRole("tab", { name: "Exports" }).click();
  const exportTrigger = settings.getByRole("button", { name: "Export timetable" });
  await exportTrigger.focus();
  await expect(exportTrigger).toBeFocused();
  await exportTrigger.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Export timetable image" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  await expectNoSeriousAccessibilityViolations(page);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(exportTrigger).toBeFocused();

  guard.assertClean();
});

test("export format controls expose deterministic radio state to assistive technology", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "export semantics gate runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await openStableDemo(page);
  await openTimetableExport(page);

  const formatGroup = page.getByRole("radiogroup", { name: "Export format" });
  const image = formatGroup.getByRole("radio", { name: /Share image/ });
  const print = formatGroup.getByRole("radio", { name: /Print-ready B&W/ });

  await expect(image).toHaveAttribute("aria-checked", "true");
  await expect(print).toHaveAttribute("aria-checked", "false");
  await print.focus();
  await print.press("Space");
  await expect(print).toHaveAttribute("aria-checked", "true");
  await expect(image).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("dialog", { name: "Print timetable" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  guard.assertClean();
});

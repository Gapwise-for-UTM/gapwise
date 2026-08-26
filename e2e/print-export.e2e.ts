import { expect, test } from "@playwright/test";
import { expectLanding, watchForAppFailures } from "./helpers";

test("unified timetable export exposes the print-ready vector flow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "print export coverage runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page).toHaveURL(/\/timetable$/);

  await expect(page.getByRole("button", { name: "Print-ready" })).toHaveCount(0);
  await page.getByRole("button", { name: "Export timetable", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Export timetable image" })).toBeVisible();

  const formats = page.getByRole("radiogroup", { name: "Export format" });
  const printOption = formats.getByRole("radio", { name: /Print-ready B&W/ });
  await expect(printOption).toHaveAttribute("aria-checked", "false");
  await printOption.click();
  await expect(page.getByRole("dialog", { name: "Print timetable" })).toBeVisible();
  await expect(page.getByText("Built specifically for paper")).toBeVisible();
  await expect(page.getByText(/Scale it to any printer DPI or page size/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Download print-ready SVG" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Export appearance" })).toHaveCount(0);

  await formats.getByRole("radio", { name: /Share image/ }).click();
  await expect(page.getByRole("radiogroup", { name: "Export appearance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate image" })).toBeVisible();
  guard.assertClean();
});

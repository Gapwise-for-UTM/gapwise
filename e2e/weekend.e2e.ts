import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectLanding, watchForAppFailures } from "./helpers";

const weekendFixturePath = path.join(process.cwd(), "tests", "fixtures", "weekend-timetable.ics");

test("weekend classes flow through timetable, gaps, and day route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "weekend workflow gate runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await expectLanding(page);
  await page.locator('input[type="file"]').first().setInputFiles(weekendFixturePath);
  await expect(page).toHaveURL(/\/timetable$/);

  await expect(page.getByText("2 meetings in Fall · 1 gaps detected", { exact: true })).toBeVisible();
  await expect(page.getByText("Saturday", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Sunday", { exact: true })).toHaveCount(0);
  await expect(page.getByText("CSC110Y5").first()).toBeVisible();

  const viewMode = page.getByRole("group", { name: "View mode" });
  await viewMode.getByRole("button", { name: "Gap plan" }).click();
  await expect(page).toHaveURL(/\/gaps$/);
  const gapPlan = page.locator(".dot-field:not([hidden])");
  await expect(gapPlan).toBeVisible();
  await expect(gapPlan.getByRole("button", { name: /2h gap/i })).toBeVisible();

  await viewMode.getByRole("button", { name: "Day route" }).click();
  await expect(page).toHaveURL(/\/route\/?$/);
  const routeDay = page.getByRole("group", { name: "Route weekday" });
  await expect(routeDay.getByRole("button", { name: "Saturday" })).toBeVisible();
  await expect(routeDay.getByRole("button", { name: "Sunday" })).toHaveCount(0);
  await routeDay.getByRole("button", { name: "Saturday" }).click();
  await expect(page.getByText("CSC110Y5").first()).toBeVisible();
  await expect(page.getByText("MAT102H5").first()).toBeVisible();

  guard.assertClean();
});

import { expect, test } from "@playwright/test";
import { isMobileProject, watchForAppFailures } from "./helpers";

async function expectSelectedGapDuration(page: import("@playwright/test").Page, duration?: string) {
  if (!duration) return;
  await expect(
    page.locator('button[aria-pressed="true"]').filter({ hasText: duration }).first(),
  ).toBeVisible();
}

test("a timetable gap opens Gap Plan with that exact interval selected", async ({
  page,
}, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  const mobile = isMobileProject(testInfo.project.name);

  await page.goto("/");
  await page.getByRole("button", { name: "Try a demo" }).click();

  if (mobile) {
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Timetable" }).click();
    await expect(page.getByText("Day timetable")).toBeVisible();
    const weekdays = page.getByRole("group", { name: "Weekday" });
    await weekdays.getByRole("button", { name: /Mon/ }).click();
    const gap = page.getByRole("button", { name: /gap.*View gap plan/i }).first();
    await expect(gap).toBeVisible();
    const label = await gap.getAttribute("aria-label");
    const duration = (label ?? "").match(/^(.*?) gap/)?.[1];
    await gap.click();
    await expect(page).toHaveURL(/\/gaps$/);
    await expectSelectedGapDuration(page, duration);
  } else {
    const gap = page.locator("[data-gap-interactive='true']").first();
    const gapId = await gap.getAttribute("data-gap-id");
    const label = await gap.getAttribute("aria-label");
    const duration = (label ?? "").match(/^(.*?) gap/)?.[1];
    expect(gapId).toBeTruthy();
    await gap.click();
    await expect(page).toHaveURL(/\/gaps$/);
    await expectSelectedGapDuration(page, duration);
  }

  guard.assertClean();
});

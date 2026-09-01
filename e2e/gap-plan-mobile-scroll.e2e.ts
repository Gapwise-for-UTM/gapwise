import { expect, test } from "@playwright/test";
import { expectLanding, watchForAppFailures } from "./helpers";

test("mobile gap tool sheets keep their content vertically scrollable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "iPhone sheet regression runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Timetable" })
    .click();
  await expect(page).toHaveURL(/\/timetable$/);

  // Keep this regression independent of the calendar day on which CI runs. The demo
  // timetable always has multiple Monday meetings with gaps, while some weekdays have
  // only one meeting and therefore intentionally render no gap card.
  await page.getByRole("button", { name: /Mon/ }).click();

  const gapCard = page.locator(".mobile-gap-card").first();
  await expect(gapCard).toBeVisible();
  await gapCard.click();
  await expect(page).toHaveURL(/\/gaps$/);

  await page.getByRole("button", { name: "Tune", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const content = dialog.locator(".gap-sheet-content");
  await expect(dialog.getByRole("heading", { name: "Tune your gaps" })).toBeVisible();

  const tuneMetrics = await content.evaluate((element) => {
    const style = getComputedStyle(element);
    const dialogStyle = getComputedStyle(element.closest('[role="dialog"]') as HTMLElement);
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: style.overflowY,
      touchAction: style.touchAction,
      dialogDisplay: dialogStyle.display,
    };
  });

  expect(tuneMetrics.dialogDisplay).toBe("flex");
  expect(["auto", "scroll"]).toContain(tuneMetrics.overflowY);
  expect(tuneMetrics.touchAction).toContain("pan-y");
  expect(tuneMetrics.scrollHeight).toBeGreaterThan(tuneMetrics.clientHeight);

  await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "Friend gaps", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Friend gaps", exact: true })).toBeVisible();
  const friendStyles = await content.evaluate((element) => {
    const style = getComputedStyle(element);
    return { overflowY: style.overflowY, touchAction: style.touchAction };
  });
  expect(["auto", "scroll"]).toContain(friendStyles.overflowY);
  expect(friendStyles.touchAction).toContain("pan-y");

  guard.assertClean();
});

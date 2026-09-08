import { expect, test } from "@playwright/test";
import { expectLanding, watchForAppFailures } from "./helpers";

test("mobile gap tool sheets keep their content vertically scrollable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "iPhone sheet regression runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Timetable" }).click();
  await expect(page.getByText("Day timetable")).toBeVisible();
  await page.evaluate(() => {
    window.history.pushState({}, "", "/gaps");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/gaps$/);

  await page.getByRole("button", { name: "Tune", exact: true }).first().click();
  let dialog = page.getByRole("dialog", { name: "Tune gap recommendations" });
  await expect(dialog.getByRole("heading", { name: "Tune gap recommendations" })).toBeVisible();

  const tuneMetrics = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: style.overflowY,
      display: style.display,
    };
  });

  expect(tuneMetrics.display).toBe("flex");
  expect(["auto", "scroll"]).toContain(tuneMetrics.overflowY);
  expect(tuneMetrics.scrollHeight).toBeGreaterThan(tuneMetrics.clientHeight);

  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Friend gaps", exact: true }).first().click();
  dialog = page.getByRole("dialog", { name: "Friend gaps" });
  await expect(dialog.getByRole("heading", { name: "Friend gaps", exact: true })).toBeVisible();
  const friendStyles = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return { overflowY: style.overflowY };
  });
  expect(["auto", "scroll"]).toContain(friendStyles.overflowY);

  guard.assertClean();
});

import { expect, test, type Page } from "@playwright/test";
import { expectLanding, watchForAppFailures } from "./helpers";

async function setUserActivation(page: Page, isActive: boolean) {
  await page.evaluate((active) => {
    Object.defineProperty(navigator, "userActivation", {
      configurable: true,
      value: { isActive: active, hasBeenActive: true },
    });
  }, isActive);
}

test("iPhone timetable export stages files when the original gesture expires", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "iPhone export regression runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Timetable" })
    .click();
  await expect(page).toHaveURL(/\/timetable$/);

  await page.getByRole("button", { name: "Export timetable" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Export timetable image" })).toBeVisible();

  await setUserActivation(page, false);
  await dialog.getByRole("button", { name: "Generate image" }).click();

  await expect(dialog.getByRole("status")).toContainText(
    "Image is ready. Tap below to share or download it.",
  );
  await expect(dialog.getByRole("alert")).toHaveCount(0);

  await dialog.getByRole("radio", { name: "Print-ready B&W" }).click();
  await expect(dialog.getByRole("heading", { name: "Print timetable" })).toBeVisible();

  await setUserActivation(page, false);
  await dialog.getByRole("button", { name: "Prepare print-ready SVG" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Print-ready SVG is ready. Tap below to download it.",
  );

  await setUserActivation(page, true);
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download print-ready SVG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/timetable-print\.svg$/);

  guard.assertClean();
});

import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectLanding, isMobileProject, watchForAppFailures } from "./helpers";

const fixturePath = path.join(process.cwd(), "tests", "fixtures", "sample-timetable.ics");

async function expectSignInDialogWhenAvailable(page: import("@playwright/test").Page) {
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });
  await expect(signIn).toBeVisible();
  if (!(await signIn.isEnabled())) {
    await expect(signIn).toBeDisabled();
    return;
  }

  await signIn.click();
  const dialog = page.getByRole("dialog", { name: "Sign in to sync" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Sign in to sync" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with Microsoft" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  expect(box!.y + box!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
}

test("AND-66 first-run landing keeps activation clear on a narrow phone", async ({
  page,
}, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await page.setViewportSize({ width: 360, height: 740 });
  await expectLanding(page);

  await expect(
    page.getByRole("heading", { name: "Make every gap on campus count." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "One precise workspace for your timetable, the time between classes, and moving across UTM.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try a demo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Campus arrival settings" })).toHaveCount(0);

  const importAction = page.getByRole("button", { name: "Import ACORN" });
  await importAction.scrollIntoViewIfNeeded();
  await expect(importAction).toBeVisible();
  const ctaBox = await importAction.boundingBox();
  expect(ctaBox).not.toBeNull();
  expect(ctaBox!.height).toBeGreaterThanOrEqual(40);
  expect(ctaBox!.width).toBeGreaterThanOrEqual(180);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await expectSignInDialogWhenAvailable(page);
  guard.assertClean();
});

test("landing sign-in dialog remains usable at tablet width", async ({ page }, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await page.setViewportSize({ width: 900, height: 650 });
  await expectLanding(page);
  await expectSignInDialogWhenAvailable(page);
  guard.assertClean();
});

test("AND-66 real Import ACORN action hands a successful local parse to Today", async ({
  page,
}, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import ACORN" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(fixturePath);

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText(/Schedule ready — 2 classes imported\./)).toBeVisible();
  if (isMobileProject(testInfo.project.name)) {
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Today" }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("group", { name: "View mode" }).getByRole("button", { name: "Today" }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await expect(page.locator(".first-value-emphasis")).toBeVisible();
  guard.assertClean();
});

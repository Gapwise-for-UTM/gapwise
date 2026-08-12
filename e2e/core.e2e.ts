import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectLanding, isMobileProject, watchForAppFailures } from "./helpers";

const fixturePath = path.join(process.cwd(), "tests", "fixtures", "sample-timetable.ics");

test("landing page is usable without an account", async ({ page }, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);
  await expect(page.getByText("Original .ics files never leave your device")).toBeVisible();
  guard.assertClean();
});

test("synthetic ACORN import reaches a usable timetable", async ({ page }, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.locator("#ics-file").setInputFiles(fixturePath);

  if (isMobileProject(testInfo.project.name)) {
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await page.getByRole("button", { name: "Timetable" }).click();
    await expect(page.getByText("Day timetable")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Monday" })).toBeVisible();
    await expect(page.getByText("CSC108H5")).toBeVisible();
    await expect(page.getByText("MAT102H5")).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Your timetable" })).toBeVisible();
    await expect(page.getByText(/2 meetings in Fall/)).toBeVisible();
    const viewMode = page.getByRole("group", { name: "View mode" });
    await expect(viewMode.getByRole("button", { name: "Weekly timetable" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }

  guard.assertClean();
});

test("malformed calendar fails safely with a useful error", async ({ page }, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.locator("#ics-file").setInputFiles({
    name: "broken.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from("not an ics calendar"),
  });

  await expect(page.getByRole("alert")).toContainText("doesn't look like a calendar export");
  await expect(
    page.getByRole("heading", { name: "Make every gap on campus count." }),
  ).toBeVisible();
  guard.assertClean();
});

test("desktop demo moves between timetable, gaps, and route", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), "desktop view-mode coverage");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page.getByRole("heading", { name: "Demo timetable" })).toBeVisible();

  const viewMode = page.getByRole("group", { name: "View mode" });
  await viewMode.getByRole("button", { name: "Gap plan" }).click();
  await expect(page.getByText("Tune gap recommendations")).toBeVisible();

  await viewMode.getByRole("button", { name: "Day route" }).click();
  await expect(page.getByRole("heading", { name: "Route preferences" })).toBeVisible();
  guard.assertClean();
});

test("mobile demo exposes the primary timetable and map navigation", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo.project.name), "mobile navigation coverage");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.getByRole("button", { name: "Try a demo" }).click();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Today" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Timetable" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Map" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "More" })).toBeVisible();

  await nav.getByRole("button", { name: "Timetable" }).click();
  await expect(page.getByText("Day timetable")).toBeVisible();

  await nav.getByRole("button", { name: "Map" }).click();
  await expect(page.getByText("Campus route")).toBeVisible();
  await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
  guard.assertClean();
});

test("guest import never writes plaintext timetable persistence", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for storage policy");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.locator("#ics-file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "Your timetable" })).toBeVisible();

  const stored = await page.evaluate(() => ({
    timetable: window.localStorage.getItem("gapwise:timetable"),
    remember: window.localStorage.getItem("gapwise:remember"),
  }));
  expect(stored).toEqual({ timetable: null, remember: null });

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Make every gap on campus count." }),
  ).toBeVisible();
  guard.assertClean();
});

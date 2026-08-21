import { expect, test } from "@playwright/test";
import { isMobileProject, watchForAppFailures } from "./helpers";

test("privacy and terms are public, responsive, and independent of an account", async ({
  page,
}, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await page.goto("/privacy");
  await expect(page).toHaveTitle("Privacy — Gapwise for UTM");
  await expect(page.getByRole("heading", { name: "Your schedule stays yours." })).toBeVisible();
  await expect(page.getByText("The original file is not uploaded")).toBeVisible();
  await page.getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveTitle("Terms — Gapwise for UTM");
  await expect(page.getByRole("heading", { name: "A practical student utility." })).toBeVisible();
  guard.assertClean();
});

test("visible Pro planning journey accepts work and exposes safe block actions", async ({
  page,
}, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await page.goto("/");
  await page.getByRole("button", { name: "Try a demo" }).click();
  await page.getByRole("button", { name: /Academic work/ }).click();
  await expect(page.getByRole("heading", { name: "Academic work" })).toBeVisible();

  await page.getByLabel("Course").fill("MAT157");
  await page.getByLabel("Title").fill("Problem Set 4");
  await page.getByLabel("Estimated hours").fill("1.5");
  await page.getByRole("button", { name: "Add coursework" }).click();
  await page.getByRole("button", { name: /Build my plan/i }).click();
  await expect(page.getByRole("heading", { name: "Proposed study plan" })).toBeVisible();
  await expect(page.getByText(/MAT157 · Problem Set 4/)).toBeVisible();
  await page.getByRole("button", { name: "Add to timetable" }).click();
  await expect(page.getByRole("button", { name: /Reschedule MAT157 Problem Set 4/ })).toBeVisible();
  await page.getByRole("button", { name: /Reschedule MAT157 Problem Set 4/ }).click();
  await expect(page.getByRole("dialog", { name: "Reschedule study work" })).toBeVisible();
  await expect(page.getByLabel("New study start")).toBeVisible();
  if (isMobileProject(testInfo.project.name)) {
    await expect(page.getByRole("button", { name: "Move study block" })).toBeInViewport();
  }
  guard.assertClean();
});

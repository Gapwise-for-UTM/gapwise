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

test("vulnerability policy and canonical security contact are public", async ({ page }) => {
  await page.goto("/security");
  await expect(page).toHaveTitle("Vulnerability Disclosure — Gapwise for UTM");
  await expect(
    page.getByRole("heading", { name: "Vulnerability Disclosure Policy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "private vulnerability reporting form" }),
  ).toHaveAttribute("href", "https://github.com/andrewmuratov/gapwise/security/advisories/new");
  await expect(page.getByText("operational goals, not guaranteed")).toBeVisible();

  const response = await page.request.get("/.well-known/security.txt");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const securityTxt = await response.text();
  expect(securityTxt).toContain("Canonical: https://gapwise.ca/.well-known/security.txt");
  expect(securityTxt).toContain("Policy: https://gapwise.ca/security");
  expect(securityTxt).toContain(
    "Contact: https://github.com/andrewmuratov/gapwise/security/advisories/new",
  );
});

test("visible Pro planning journey accepts work and exposes safe block actions", async ({
  page,
}, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  const mobile = isMobileProject(testInfo.project.name);
  await page.goto("/");
  await page.getByRole("button", { name: "Try a demo" }).click();

  if (mobile) {
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Academic work", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Academic work", exact: true }).click();
  }

  const academicWork = page.getByRole("dialog", { name: "Academic work" });
  await expect(academicWork).toBeVisible();
  await academicWork.getByRole("textbox", { name: "Course", exact: true }).fill("MAT157");
  await academicWork.getByRole("textbox", { name: "Title", exact: true }).fill("Problem Set 4");
  await academicWork.getByLabel("Estimated hours", { exact: true }).fill("1.5");
  await academicWork.getByRole("button", { name: "Add coursework" }).click();
  await academicWork.getByRole("button", { name: /Build my plan/i }).click();
  await expect(academicWork.getByRole("heading", { name: "Proposed study plan" })).toBeVisible();
  await expect(academicWork.getByText(/MAT157 · Problem Set 4/).first()).toBeVisible();
  await academicWork.getByRole("button", { name: "Add to timetable" }).click();
  const rescheduleButton = academicWork
    .getByRole("button", {
      name: /Reschedule MAT157 Problem Set 4/,
    })
    .first();
  await expect(rescheduleButton).toBeVisible();
  await rescheduleButton.click();
  const rescheduleDialog = page.getByRole("dialog", { name: "Reschedule study work" });
  await expect(rescheduleDialog).toBeVisible();
  await expect(rescheduleDialog.getByLabel("New study start")).toBeVisible();
  if (mobile) {
    await expect(
      rescheduleDialog.getByRole("button", { name: "Move study block" }),
    ).toBeInViewport();
  }
  guard.assertClean();
});

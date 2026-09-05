import AxeBuilder from "@axe-core/playwright";
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
  await expect(
    page.getByText(/does not describe this design as zero-knowledge or end-to-end encryption/),
  ).toBeVisible();
  await expect(page.getByText(/OpenFreeMap for map style and tile delivery/)).toBeVisible();
  await expect(
    page.getByText(/Resend for configured transactional authentication email/),
  ).toBeVisible();
  await expect(page.getByText(/Cloudflare for DNS, inbound Gapwise email routing/)).toBeVisible();
  await expect(page.getByText(/Web Analytics as cookie-free and anonymized/)).toBeVisible();
  await expect(
    page.getByText(/Delete your account and associated application cloud data/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveTitle("Terms — Gapwise for UTM");
  await expect(page.getByRole("heading", { name: "A practical student utility." })).toBeVisible();
  await expect(page.getByText(/without paid feature tiers or a product checkout/)).toBeVisible();
  await expect(
    page.getByText(/Nothing here limits rights that cannot lawfully be waived/),
  ).toBeVisible();
  guard.assertClean();
});

test("accessibility statement publishes scoped evidence and limitations", async ({ page }) => {
  await page.goto("/accessibility");

  await expect(page.getByRole("heading", { name: "Access is an ongoing practice." })).toBeVisible();
  await expect(page.getByText(/process commitment, not a claim/)).toBeVisible();
  await expect(page.getByText(/No documented, repeatable manual screen-reader/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Gapwise GitHub repository" })).toHaveAttribute(
    "href",
    "https://github.com/Gapwise-for-UTM/gapwise/issues",
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});

test("trust center exposes evidence-backed boundaries and limitations", async ({ page }) => {
  await page.goto("/trust");
  await expect(page).toHaveTitle("Trust Center — Gapwise for UTM");
  await expect(page.getByRole("heading", { name: "Evidence before promises." })).toBeVisible();
  await expect(page.getByText("Gapwise does not ask for your ACORN password.")).toBeVisible();
  await expect(
    page.getByText(/does not call the design end-to-end encrypted or zero knowledge/),
  ).toBeVisible();
  await expect(
    page.getByText(/dedicated public service-status surface at status\.gapwise\.ca/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Service status" }).first()).toHaveAttribute(
    "href",
    "https://status.gapwise.ca/",
  );
  await expect(page.getByRole("link", { name: "Report a vulnerability" })).toHaveAttribute(
    "href",
    "/security",
  );
  await expect(page.getByRole("link", { name: "Accessibility Statement" })).toHaveAttribute(
    "href",
    "/accessibility",
  );
  await expect(page.getByRole("link", { name: "Data and trust inventory" })).toHaveAttribute(
    "href",
    "https://github.com/Gapwise-for-UTM/gapwise/blob/main/docs/TRUST_DATA_INVENTORY.md",
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});

test("vulnerability policy and canonical security contact are public", async ({ page }) => {
  await page.goto("/security");
  await expect(page).toHaveTitle("Vulnerability Disclosure — Gapwise for UTM");
  await expect(
    page.getByRole("heading", { name: "Vulnerability Disclosure Policy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "private vulnerability reporting form" }),
  ).toHaveAttribute("href", "https://github.com/Gapwise-for-UTM/gapwise/security/advisories/new");
  await expect(page.getByText("operational goals, not guaranteed")).toBeVisible();

  const response = await page.request.get("/.well-known/security.txt");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const securityTxt = await response.text();
  expect(securityTxt).toContain("Canonical: https://gapwise.ca/.well-known/security.txt");
  expect(securityTxt).toContain("Policy: https://gapwise.ca/security");
  expect(securityTxt).toContain(
    "Contact: https://github.com/Gapwise-for-UTM/gapwise/security/advisories/new",
  );
});

test("academic planning journey accepts work and exposes safe block actions", async ({
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

import { expect, test } from "@playwright/test";
import { watchForAppFailures } from "./helpers";

test.use({ timezoneId: "America/Toronto" });

test("Today checks canonical destinations inside a live gap on mobile Safari", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "destination checker mobile release gate");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await page.clock.setFixedTime(new Date("2026-09-07T15:30:00.000Z"));

  await page.goto("/");
  await page.getByRole("button", { name: "Try Demo Schedule" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Can I go there?" })).toBeVisible();
  await expect(
    page.getByText("Travel feasibility only — no amenity or building-access claim."),
  ).toBeVisible();

  const destination = page.getByLabel("Destination building");
  await destination.selectOption("RAWC");
  await expect(page.getByText(/usable at RAWC$/)).toBeVisible();
  await expect(page.getByText("From previous class")).toBeVisible();
  await expect(page.getByText("To next class")).toBeVisible();
  await expect(page.getByText("Protected buffer:")).toBeVisible();
  await expect(page.getByText("Gapwise can't verify both legs")).toHaveCount(0);

  await destination.selectOption("IC");
  await expect(page.getByText("Gapwise can't verify both legs")).toBeVisible();
  await expect(
    page.getByText(
      "Gapwise recognizes IC, but mapped routing coverage is unavailable; it will not guess either travel leg.",
    ),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
  guard.assertClean();
});

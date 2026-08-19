import { expect, test } from "@playwright/test";
import { watchForAppFailures } from "./helpers";

test("developer playground handles modes, API errors, and timeout recovery", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "platform playground coverage runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  let behavior: "success" | "api-error" | "timeout" = "success";

  await page.route("**/api/utm-*", async (route) => {
    if (behavior === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, 5_500));
      await route.abort().catch(() => undefined);
      return;
    }

    if (behavior === "api-error") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "demo_failure", message: "Try again" }),
      });
      return;
    }

    const pathname = new URL(route.request().url()).pathname;
    const payload = pathname.endsWith("/api/utm-buildings")
      ? { service: "gapwise-public-campus", buildings: [{ code: "MN" }] }
      : pathname.endsWith("/api/utm-gap-plan")
        ? { service: "gapwise-public-campus", gapPlan: { dataVersion: "test" } }
        : { service: "gapwise-public-campus", route: { status: "routed" } };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  await page.goto("/developers");
  await expect(
    page.getByRole("heading", { name: "UTM campus intelligence, open to build on." }),
  ).toBeVisible();
  const output = page.locator("pre").last();
  const run = page.getByRole("button", { name: "Run live example" });

  await run.click();
  await expect(output).toContainText('"status": "routed"');

  await page.getByRole("button", { name: "11–1 gap plan" }).click();
  await run.click();
  await expect(output).toContainText('"gapPlan"');

  await page.getByRole("button", { name: "Building inventory" }).click();
  await run.click();
  await expect(output).toContainText('"buildings"');

  behavior = "api-error";
  await run.click();
  await expect(output).toContainText('"demo_failure"');

  behavior = "timeout";
  await run.click();
  await expect(page.getByRole("button", { name: "Running…" })).toBeDisabled();
  await expect(output).toContainText("The live example timed out. Try again.", { timeout: 6_500 });
  await expect(run).toBeEnabled();

  behavior = "success";
  await run.click();
  await expect(output).toContainText('"buildings"');
  guard.assertClean();
});

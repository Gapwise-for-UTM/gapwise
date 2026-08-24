import { expect, test } from "@playwright/test";
import { watchForAppFailures } from "./helpers";

test("developer playground handles modes, API errors, and timeout recovery", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "platform playground coverage runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  let behavior: "success" | "api-error" | "timeout" = "success";

  await page.route("**/v1/**", async (route) => {
    if (behavior === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, 5_500));
      await route.abort().catch(() => undefined);
      return;
    }

    if (behavior === "api-error") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "demo_failure", message: "Try again" },
          meta: { apiVersion: "v1", requestId: "e2e-request" },
        }),
      });
      return;
    }

    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith("/v1/buildings")
      ? [{ code: "MN" }]
      : pathname.endsWith("/v1/gaps/plan")
        ? { dataVersion: "test", assessment: { primary: { title: "Study" } } }
        : { status: "routed" };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data,
        meta: { apiVersion: "v1", dataVersion: "test", requestId: "e2e-request" },
      }),
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
  await expect(output).toContainText('"assessment"');

  await page.getByRole("button", { name: "Building inventory" }).click();
  await run.click();
  await expect(output).toContainText('"code": "MN"');
  guard.assertClean();

  behavior = "api-error";
  await run.click();
  await expect(output).toContainText('"code": "demo_failure"');
  await expect(output).toContainText('"requestId": "e2e-request"');

  behavior = "timeout";
  await run.click();
  await expect(page.getByRole("button", { name: "Running…" })).toBeDisabled();
  await expect(output).toContainText("The live example timed out. Try again.", { timeout: 6_500 });
  await expect(run).toBeEnabled();

  behavior = "success";
  const recoveryGuard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await run.click();
  await expect(output).toContainText('"code": "MN"');
  recoveryGuard.assertClean();
});

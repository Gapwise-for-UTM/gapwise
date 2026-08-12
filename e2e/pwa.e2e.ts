import { expect, test } from "@playwright/test";
import { expectLanding, watchForAppFailures } from "./helpers";

test("PWA metadata, service worker, and cached app shell are functional", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "PWA gate runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await expectLanding(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/site.webmanifest");

  const manifest = await page.evaluate(async () => {
    const response = await fetch("/site.webmanifest");
    return { status: response.status, json: await response.json() };
  });
  expect(manifest.status).toBe(200);
  expect(manifest.json).toMatchObject({
    name: "Gapwise for UTM",
    short_name: "Gapwise",
    start_url: "/",
    display: "standalone",
  });

  const swStatus = await page.evaluate(async () => (await fetch("/sw.js")).status);
  expect(swStatus).toBe(200);

  const workerState = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "unsupported";
    const timeout = new Promise<string>((resolve) =>
      window.setTimeout(() => resolve("timeout"), 10_000),
    );
    const ready = navigator.serviceWorker.ready.then(
      (registration) => registration.active?.state ?? "missing-active-worker",
    );
    return Promise.race([ready, timeout]);
  });
  expect(workerState).toBe("activated");

  // The first load installs the worker. A second online navigation must be controlled
  // before an offline navigation can prove the cached app shell is actually serving Gapwise.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)))
    .toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Make every gap on campus count." }),
    ).toBeVisible();
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true);
  } finally {
    await context.setOffline(false);
  }

  guard.assertClean();
});

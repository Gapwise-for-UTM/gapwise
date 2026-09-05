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
    name: "Gapwise",
    short_name: "Gapwise",
    start_url: "/",
    display: "standalone",
  });

  const swStatus = await page.evaluate(async () => (await fetch("/sw.js")).status);
  expect(swStatus).toBe(200);

  const workerState = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "unsupported";
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 10_000)),
    ]);
    if (!registration) return "timeout";

    const worker = registration.active;
    if (!worker) return "missing-active-worker";
    if (worker.state === "activated") return worker.state;

    return new Promise<string>((resolve) => {
      const finish = (state: string) => {
        worker.removeEventListener("statechange", onStateChange);
        window.clearTimeout(timeout);
        resolve(state);
      };
      const onStateChange = () => {
        if (worker.state === "activated" || worker.state === "redundant") {
          finish(worker.state);
        }
      };
      const timeout = window.setTimeout(() => finish(`timeout:${worker.state}`), 10_000);
      worker.addEventListener("statechange", onStateChange);
      onStateChange();
    });
  });
  expect(workerState).toBe("activated");

  // The first load installs the worker. A second online navigation must be controlled
  // before an offline navigation can prove the cached app shell is actually serving Gapwise.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)))
    .toBe(true);

  // Validate the online stage before deliberately taking the browser offline. Third-party
  // resources may correctly fail while offline; the release gate below is the cached Gapwise
  // shell itself remaining available and controlled by the service worker.
  guard.assertClean();

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
});

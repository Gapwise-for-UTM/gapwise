import { expect, test } from "@playwright/test";
import { watchForAppFailures } from "./helpers";

test.describe("map-first Day Route", () => {
  test("shows chronological time markers with non-overlapping controls", async ({ page, baseURL }) => {
    test.skip(!["chromium", "mobile-chromium"].includes(test.info().project.name));
    if (!baseURL) throw new Error("Playwright baseURL is required");
    const failures = watchForAppFailures(page, baseURL);

    await page.goto("/");
    await page.getByRole("button", { name: "Try a demo" }).click();
    await page.goto("/route");

    await expect(page.getByText("Day order", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Times on the map match this left-to-right sequence."),
    ).toBeVisible();

    const timeMarkers = page.locator(".map-time-marker");
    await expect(timeMarkers.first()).toBeVisible();
    const markerLabels = await timeMarkers.allTextContents();
    expect(markerLabels.length).toBeGreaterThan(1);
    for (const label of markerLabels) {
      expect(label.trim()).toMatch(/^\d{1,2}:\d{2} (?:AM|PM)$/);
      expect(label.trim()).not.toMatch(/^\d+$/);
    }

    await expect(page.locator(".maplibregl-ctrl-compass")).toHaveCount(0);
    const fitRoute = page.getByRole("button", { name: "Fit the active day route" });
    await expect(fitRoute).toBeVisible();

    const navigation = page.locator(".maplibregl-ctrl-top-right .maplibregl-ctrl-group").first();
    await expect(navigation).toBeVisible();
    const [navigationBox, fitBox] = await Promise.all([
      navigation.boundingBox(),
      fitRoute.boundingBox(),
    ]);
    expect(navigationBox).not.toBeNull();
    expect(fitBox).not.toBeNull();
    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(fitBox!.y - 4);

    failures.assertClean();
  });
});

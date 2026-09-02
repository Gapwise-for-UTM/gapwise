import { expect, test } from "@playwright/test";
import { watchForAppFailures } from "./helpers";

type Box = { x: number; y: number; width: number; height: number };

function boxesOverlap(a: Box, b: Box) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

test.describe("map-first Day Route", () => {
  test("uses timetable semantics, stable controls, and auto-fits when the selected day changes", async ({
    page,
    baseURL,
  }) => {
    test.skip(!["chromium", "mobile-chromium"].includes(test.info().project.name));
    if (!baseURL) throw new Error("Playwright baseURL is required");
    const failures = watchForAppFailures(page, baseURL);

    await page.addInitScript(() => {
      const originalClick = HTMLButtonElement.prototype.click;
      (window as typeof window & { __gapwiseAutoFitClicks?: number }).__gapwiseAutoFitClicks = 0;
      HTMLButtonElement.prototype.click = function click() {
        const label = this.getAttribute("aria-label");
        if (label === "Fit the active day route" || label === "Return to campus overview") {
          const state = window as typeof window & { __gapwiseAutoFitClicks?: number };
          state.__gapwiseAutoFitClicks = (state.__gapwiseAutoFitClicks ?? 0) + 1;
        }
        return originalClick.call(this);
      };
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Try a demo" }).click();

    if (test.info().project.name === "mobile-chromium") {
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav).toBeVisible();
      await nav.getByRole("link", { name: "Map" }).click();
    } else {
      await expect(page.getByRole("heading", { name: "Demo timetable" })).toBeVisible();
      const viewMode = page.getByRole("group", { name: "View mode" });
      await viewMode.getByRole("button", { name: "Day route" }).click();
    }

    const weekdayGroup = page.getByRole("group", { name: "Route weekday" });
    await expect(weekdayGroup).toBeVisible();
    await weekdayGroup
      .getByRole("button", {
        name: test.info().project.name === "mobile-chromium" ? "Mon" : "Monday",
        exact: true,
      })
      .click();

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

    const activities = await timeMarkers.evaluateAll((markers) =>
      markers.map((marker) => marker.getAttribute("data-activity")),
    );
    expect(
      activities.every(
        (activity) => activity !== null && ["LEC", "TUT", "PRA", "OTHER"].includes(activity),
      ),
    ).toBe(true);

    const lecture = page.locator('.map-time-marker[data-activity="LEC"]').first();
    const tutorial = page.locator('.map-time-marker[data-activity="TUT"]').first();
    if ((await lecture.count()) > 0 && (await tutorial.count()) > 0) {
      const [lectureColor, tutorialColor] = await Promise.all([
        lecture.evaluate((marker) => getComputedStyle(marker).backgroundColor),
        tutorial.evaluate((marker) => getComputedStyle(marker).backgroundColor),
      ]);
      expect(lectureColor).not.toBe(tutorialColor);
    }

    await timeMarkers.nth(1).click();
    const meetingDetails = page.getByTestId("map-meeting-details");
    await expect(meetingDetails).toBeVisible();
    await expect(meetingDetails).toContainText(/DEM\d+/);
    await expect(meetingDetails.getByText("Time", { exact: true })).toBeVisible();
    await expect(meetingDetails.getByText("Location", { exact: true })).toBeVisible();
    await expect(meetingDetails.getByText("Component", { exact: true })).toBeVisible();
    await expect(meetingDetails.getByText("Day", { exact: true })).toBeVisible();
    await expect(meetingDetails).toContainText("Instructional Centre");
    await expect(meetingDetails).toContainText("2nd floor · Room 245");
    await expect(meetingDetails).toContainText("TUT");

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

    await fitRoute.click();
    await page.waitForTimeout(650);
    const actionBox = await page.locator(".campus-map-actions").boundingBox();
    expect(actionBox).not.toBeNull();
    const markerBoxes = await timeMarkers.evaluateAll((markers) =>
      markers.map((marker) => {
        const box = marker.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
    for (const markerBox of markerBoxes) {
      expect(boxesOverlap(markerBox, actionBox!)).toBe(false);
    }

    await page.evaluate(() => {
      (window as typeof window & { __gapwiseAutoFitClicks?: number }).__gapwiseAutoFitClicks = 0;
    });
    const anotherDay = weekdayGroup.locator('button[aria-pressed="false"]').last();
    await anotherDay.click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __gapwiseAutoFitClicks?: number })
              .__gapwiseAutoFitClicks ?? 0,
        ),
      )
      .toBeGreaterThan(0);

    failures.assertClean();
  });
});

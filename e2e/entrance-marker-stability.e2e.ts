import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectLanding, watchForAppFailures } from "./helpers";

type MarkerGeometry = {
  anchorCenter: { x: number; y: number };
  buttonCenter: { x: number; y: number };
  anchorScale: string;
  anchorTranslate: string;
  anchorTransform: string;
  entranceId: string | null;
  longitude: string | null;
  latitude: string | null;
};

async function markerGeometry(anchor: Locator): Promise<MarkerGeometry> {
  return anchor.evaluate((element) => {
    const button = element.querySelector<HTMLElement>(".map-entrance-marker");
    if (!button) throw new Error("Entrance marker button is missing from its geographic anchor.");
    const anchorRect = element.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const anchorStyle = getComputedStyle(element);
    return {
      anchorCenter: {
        x: anchorRect.left + anchorRect.width / 2,
        y: anchorRect.top + anchorRect.height / 2,
      },
      buttonCenter: {
        x: buttonRect.left + buttonRect.width / 2,
        y: buttonRect.top + buttonRect.height / 2,
      },
      anchorScale: anchorStyle.scale,
      anchorTranslate: anchorStyle.translate,
      anchorTransform: anchorStyle.transform,
      entranceId: element.getAttribute("data-entrance-id"),
      longitude: element.getAttribute("data-longitude"),
      latitude: element.getAttribute("data-latitude"),
    };
  });
}

async function expectMarkerCentered(anchor: Locator) {
  await expect(anchor).toHaveCount(1);
  await expect(anchor.locator(":scope > .map-entrance-marker")).toHaveCount(1);
  const geometry = await markerGeometry(anchor);
  expect(Math.abs(geometry.anchorCenter.x - geometry.buttonCenter.x)).toBeLessThan(0.75);
  expect(Math.abs(geometry.anchorCenter.y - geometry.buttonCenter.y)).toBeLessThan(0.75);
  expect(geometry.anchorScale).toBe("none");
  expect(geometry.anchorTranslate).toBe("none");
  expect(geometry.anchorTransform).not.toBe("none");
  return geometry;
}

async function selectBuilding(page: Page, query: string, heading: string) {
  const search = page.getByRole("searchbox", { name: "Search UTM buildings" });
  await search.fill(query);
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

test("entrance markers keep MapLibre projection isolated from interactive styling", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "map marker projection regression runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  await page
    .getByRole("group", { name: "View mode" })
    .getByRole("button", { name: "Day route" })
    .click();
  await expect(page.getByRole("heading", { name: "Route preferences" })).toBeVisible();

  await selectBuilding(page, "MN", "Maanjiwe nendamowinan");
  const mnAnchor = page.locator(".map-entrance-marker-anchor").first();
  const mnButton = mnAnchor.locator(":scope > .map-entrance-marker");
  await expect(mnAnchor).toHaveClass(/maplibregl-marker/);
  await expect(mnButton).not.toHaveClass(/maplibregl-marker/);

  const original = await expectMarkerCentered(mnAnchor);
  expect(original.entranceId).toBeTruthy();
  expect(original.longitude).toBeTruthy();
  expect(original.latitude).toBeTruthy();

  await mnButton.hover();
  await expect(mnButton).toHaveClass(/is-selected/);
  await expectMarkerCentered(mnAnchor);
  await mnButton.focus();
  await expectMarkerCentered(mnAnchor);
  await page.keyboard.press("Tab");

  await page.getByRole("button", { name: "Fit the active day route" }).click();
  await page.waitForTimeout(700);
  await expectMarkerCentered(mnAnchor);

  const canvas = page.locator(".maplibregl-canvas").first();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Campus map canvas bounds are unavailable.");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -550);
  await page.waitForTimeout(350);
  await expectMarkerCentered(mnAnchor);

  await page.mouse.move(bounds.x + bounds.width * 0.55, bounds.y + bounds.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.45, bounds.y + bounds.height * 0.48, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForTimeout(250);
  await expectMarkerCentered(mnAnchor);

  const themeToggle = page.getByRole("button", { name: /Switch to (dark|light) mode/ });
  await themeToggle.click();
  await page.waitForTimeout(350);
  const themedMnAnchor = page.locator(".map-entrance-marker-anchor").first();
  const themed = await expectMarkerCentered(themedMnAnchor);
  expect(themed.entranceId).toBe(original.entranceId);
  expect(themed.longitude).toBe(original.longitude);
  expect(themed.latitude).toBe(original.latitude);

  await selectBuilding(page, "Deerfield", "Deerfield Hall");
  await expect(page.locator(".map-entrance-marker-anchor")).toHaveCount(3);
  for (const anchor of await page.locator(".map-entrance-marker-anchor").all()) {
    await expectMarkerCentered(anchor);
  }

  await selectBuilding(page, "MN", "Maanjiwe nendamowinan");
  const restoredMnAnchor = page.locator(".map-entrance-marker-anchor").first();
  const restored = await expectMarkerCentered(restoredMnAnchor);
  expect(restored.entranceId).toBe(original.entranceId);
  expect(restored.longitude).toBe(original.longitude);
  expect(restored.latitude).toBe(original.latitude);

  guard.assertClean();
});

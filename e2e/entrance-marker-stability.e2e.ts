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

const MN_ENTRANCE = {
  id: "mn-13738201127",
  longitude: -79.6654141,
  latitude: 43.5513221,
} as const;

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

function isNeutralTransformLonghand(value: string) {
  return value === "" || value === "none";
}

function expectAuditedMnCoordinate(geometry: MarkerGeometry) {
  expect(geometry.entranceId).toBe(MN_ENTRANCE.id);
  expect(Number(geometry.longitude)).toBe(MN_ENTRANCE.longitude);
  expect(Number(geometry.latitude)).toBe(MN_ENTRANCE.latitude);
}

async function expectMarkerCentered(anchor: Locator) {
  await expect(anchor).toHaveCount(1);
  await expect(anchor.locator(":scope > .map-entrance-marker")).toHaveCount(1);
  const geometry = await markerGeometry(anchor);
  expect(Math.abs(geometry.anchorCenter.x - geometry.buttonCenter.x)).toBeLessThan(0.75);
  expect(Math.abs(geometry.anchorCenter.y - geometry.buttonCenter.y)).toBeLessThan(0.75);
  expect(isNeutralTransformLonghand(geometry.anchorScale)).toBe(true);
  expect(isNeutralTransformLonghand(geometry.anchorTranslate)).toBe(true);
  expect(geometry.anchorTransform).not.toBe("none");
  return geometry;
}

function expectSameGeographicAnchor(before: MarkerGeometry, after: MarkerGeometry) {
  expect(after.entranceId).toBe(before.entranceId);
  expect(after.longitude).toBe(before.longitude);
  expect(after.latitude).toBe(before.latitude);
}

function expectStationaryProjection(before: MarkerGeometry, after: MarkerGeometry) {
  expectSameGeographicAnchor(before, after);
  expect(after.anchorTransform).toBe(before.anchorTransform);
  expect(Math.abs(after.anchorCenter.x - before.anchorCenter.x)).toBeLessThan(0.75);
  expect(Math.abs(after.anchorCenter.y - before.anchorCenter.y)).toBeLessThan(0.75);
}

async function waitForProjectionSettled(anchor: Locator) {
  let previous = await expectMarkerCentered(anchor);
  // Building focus uses a 620 ms MapLibre fitBounds transition. Requiring a
  // longer quiet window prevents a pre-animation snapshot from being mistaken
  // for the settled geographic projection on slower CI runners.
  for (let stableSamples = 0; stableSamples < 8;) {
    await anchor.page().waitForTimeout(100);
    const current = await expectMarkerCentered(anchor);
    expectSameGeographicAnchor(previous, current);
    const stationary =
      current.anchorTransform === previous.anchorTransform &&
      Math.abs(current.anchorCenter.x - previous.anchorCenter.x) < 0.75 &&
      Math.abs(current.anchorCenter.y - previous.anchorCenter.y) < 0.75;
    stableSamples = stationary ? stableSamples + 1 : 0;
    previous = current;
  }
  return previous;
}

async function expectProjectionMoved(anchor: Locator, before: MarkerGeometry) {
  await expect
    .poll(async () => {
      const after = await markerGeometry(anchor);
      expectSameGeographicAnchor(before, after);
      return after.anchorTransform;
    })
    .not.toBe(before.anchorTransform);
  return waitForProjectionSettled(anchor);
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

  const original = await waitForProjectionSettled(mnAnchor);
  expectAuditedMnCoordinate(original);

  // Interactive child styling cannot own, replace, or compose with MapLibre's
  // geographic transform. First wait for the building-selection fitBounds to
  // finish, then verify hover/focus leave the inert geographic anchor stable.
  await mnButton.dispatchEvent("mouseenter");
  await expect(mnButton).toHaveClass(/is-selected/);
  const hovered = await expectMarkerCentered(mnAnchor);
  expectStationaryProjection(original, hovered);

  await mnButton.dispatchEvent("mouseleave");
  await expect(mnButton).not.toHaveClass(/is-selected/);
  const unhovered = await expectMarkerCentered(mnAnchor);
  expectStationaryProjection(original, unhovered);

  await mnButton.focus();
  await expect(mnButton).toHaveClass(/is-selected/);
  const focused = await expectMarkerCentered(mnAnchor);
  expectStationaryProjection(original, focused);
  await page.keyboard.press("Tab");

  // Force the camera away from the building-selection fit, then require route
  // fitting to produce a real MapLibre-owned geographic reprojection while the
  // marker remains bound to the exact audited WGS84 entrance coordinate.
  await page.getByRole("button", { name: "Zoom in" }).click();
  const zoomed = await expectProjectionMoved(mnAnchor, original);
  expectAuditedMnCoordinate(zoomed);

  await page.getByRole("button", { name: "Fit the active day route" }).click();
  const routeFitted = await expectProjectionMoved(mnAnchor, zoomed);
  expectAuditedMnCoordinate(routeFitted);

  // MapLibre's keyboard handler performs a real map pan without relying on
  // synthetic drag coordinates that can be intercepted by map overlays.
  const canvas = page.locator(".maplibregl-canvas").first();
  await canvas.focus();
  await canvas.press("ArrowRight");
  const panned = await expectProjectionMoved(mnAnchor, routeFitted);
  expectAuditedMnCoordinate(panned);

  // A style/theme reload must not move a geographic marker when the camera did
  // not move. This catches reattachment bugs that preserve IDs but shift pixels.
  const themeToggle = page.getByRole("button", { name: /Switch to (dark|light) mode/ });
  await themeToggle.click();
  const themedMnAnchor = page.locator(".map-entrance-marker-anchor").first();
  const themed = await waitForProjectionSettled(themedMnAnchor);
  expectStationaryProjection(panned, themed);
  expectAuditedMnCoordinate(themed);

  await selectBuilding(page, "Deerfield", "Deerfield Hall");
  await expect(page.locator(".map-entrance-marker-anchor")).toHaveCount(3);
  for (const anchor of await page.locator(".map-entrance-marker-anchor").all()) {
    await waitForProjectionSettled(anchor);
  }

  // Re-selecting MN exercises building fitBounds again. Compare two repeated
  // MN fits under the same current UI/theme state: the earlier pre-route MN
  // selection can legitimately use different focus padding/camera state.
  await selectBuilding(page, "MN", "Maanjiwe nendamowinan");
  const restoredMnAnchor = page.locator(".map-entrance-marker-anchor").first();
  const restored = await waitForProjectionSettled(restoredMnAnchor);
  expectSameGeographicAnchor(original, restored);
  expectAuditedMnCoordinate(restored);

  await selectBuilding(page, "Deerfield", "Deerfield Hall");
  await expect(page.locator(".map-entrance-marker-anchor")).toHaveCount(3);
  for (const anchor of await page.locator(".map-entrance-marker-anchor").all()) {
    await waitForProjectionSettled(anchor);
  }

  await selectBuilding(page, "MN", "Maanjiwe nendamowinan");
  const repeatedMnAnchor = page.locator(".map-entrance-marker-anchor").first();
  const repeated = await waitForProjectionSettled(repeatedMnAnchor);
  expectSameGeographicAnchor(restored, repeated);
  expectAuditedMnCoordinate(repeated);
  expect(Math.abs(repeated.anchorCenter.x - restored.anchorCenter.x)).toBeLessThan(0.75);
  expect(Math.abs(repeated.anchorCenter.y - restored.anchorCenter.y)).toBeLessThan(0.75);

  guard.assertClean();
});

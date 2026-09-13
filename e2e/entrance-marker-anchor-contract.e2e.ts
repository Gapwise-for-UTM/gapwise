import { expect, test } from "@playwright/test";
import { expectLanding, watchForAppFailures } from "./helpers";

test("entrance geographic anchor stays dimensionless and MapLibre-owned", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "map marker anchor contract runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  await page
    .getByRole("group", { name: "View mode" })
    .getByRole("button", { name: "Day route" })
    .click();
  await expect(page.getByRole("heading", { name: "Route preferences" })).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search UTM buildings" });
  await search.fill("MN");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Maanjiwe nendamowinan" })).toBeVisible();

  const anchor = page.locator(".map-entrance-marker-anchor").first();
  const button = anchor.locator(":scope > .map-entrance-marker");
  await expect(anchor).toHaveCount(1);
  await expect(anchor).toHaveClass(/maplibregl-marker/);
  await expect(button).toHaveCount(1);
  await expect(button).not.toHaveClass(/maplibregl-marker/);

  const contract = await anchor.evaluate((element) => {
    const child = element.querySelector<HTMLElement>(".map-entrance-marker");
    if (!child) throw new Error("Entrance marker button is missing from its geographic anchor.");

    const anchorRect = element.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    const anchorStyle = getComputedStyle(element);
    const childStyle = getComputedStyle(child);

    return {
      anchorWidth: anchorRect.width,
      anchorHeight: anchorRect.height,
      anchorPointerEvents: anchorStyle.pointerEvents,
      anchorTranslate: anchorStyle.translate,
      anchorRotate: anchorStyle.rotate,
      anchorScale: anchorStyle.scale,
      childPosition: childStyle.position,
      childPointerEvents: childStyle.pointerEvents,
      centerDeltaX: Math.abs(
        anchorRect.left + anchorRect.width / 2 - (childRect.left + childRect.width / 2),
      ),
      centerDeltaY: Math.abs(
        anchorRect.top + anchorRect.height / 2 - (childRect.top + childRect.height / 2),
      ),
    };
  });

  expect(contract.anchorWidth).toBe(0);
  expect(contract.anchorHeight).toBe(0);
  expect(contract.anchorPointerEvents).toBe("none");
  expect(["", "none"]).toContain(contract.anchorTranslate);
  expect(["", "none"]).toContain(contract.anchorRotate);
  expect(["", "none"]).toContain(contract.anchorScale);
  expect(contract.childPosition).toBe("absolute");
  expect(contract.childPointerEvents).toBe("auto");
  expect(contract.centerDeltaX).toBeLessThan(0.75);
  expect(contract.centerDeltaY).toBeLessThan(0.75);

  guard.assertClean();
});

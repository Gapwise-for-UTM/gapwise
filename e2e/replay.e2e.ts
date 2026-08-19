import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { watchForAppFailures } from "./helpers";

const fixturePath = path.join(process.cwd(), "tests", "fixtures", "sample-timetable.ics");

async function setReplayMinute(page: Page, minute: number) {
  const slider = page.getByRole("slider", { name: "Replay time" });
  await slider.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("HTMLInputElement value setter is unavailable");
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, minute);
  await expect(slider).toHaveValue(String(minute));
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
}

test("Day Replay demonstrates deterministic gaps, route uncertainty, playback, terms, and local import", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "full replay journey runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/replay");
  await expect(page.getByRole("heading", { name: "Replay an entire UTM day." })).toBeVisible();
  await expect(page.getByText(".ics parsed locally")).toBeVisible();
  await expect(page.getByText("No replay backend")).toBeVisible();

  await page.getByRole("button", { name: "Use demo timetable" }).click();
  await expect(page.getByText("Synthetic demo timetable")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Replay Monday" })).toBeVisible();
  await expect(page.getByText("0 route lines visible")).toBeVisible();

  await setReplayMinute(page, 660);
  await expect(page.getByText("Between classes")).toBeVisible();
  await expect(page.getByText("Gapwise plan")).toBeVisible();
  await expect(page.getByText("Route:")).toContainText(/Mapped|Verified|Approximate/);
  await expect(page.getByText("1 route line visible")).toBeVisible();

  await page.getByRole("button", { name: "Restart day replay" }).click();
  const slider = page.getByRole("slider", { name: "Replay time" });
  const startMinute = Number(await slider.inputValue());
  await page.getByRole("button", { name: "Play day" }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(startMinute);
  await page.getByRole("button", { name: "Pause" }).click();

  const weekdays = page.getByRole("group", { name: "Replay weekday" });
  await weekdays.getByRole("button", { name: "Wednesday" }).click();
  await expect(page.getByRole("heading", { name: "Replay Wednesday" })).toBeVisible();
  await setReplayMinute(page, 660);
  await expect(page.getByText("Route: Location unavailable")).toBeVisible();
  await expect(page.getByText("0 route lines visible")).toBeVisible();
  await expect(page.getByText("1 transition without a map line")).toBeVisible();

  const terms = page.getByRole("group", { name: "Replay term" });
  await terms.getByRole("button", { name: "Winter" }).click();
  await expect(page.getByRole("button", { name: /^DEM250H5\b/ })).toBeVisible();

  await page.locator('input[type="file"][accept*=".ics"]').setInputFiles(fixturePath);
  await expect(page.getByText("Local ACORN import")).toBeVisible();
  await expect(page.getByText("CSC108H5")).toBeVisible();
  guard.assertClean();
});

test("Day Replay stays usable in mobile Safari", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "mobile Safari replay gate");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/replay");
  await page.getByRole("button", { name: "Use demo timetable" }).click();
  await expect(page.getByRole("heading", { name: "Replay Monday" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Replay time" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play day" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Replay weekday" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  guard.assertClean();
});

test("Day Replay stays usable at an iPad-sized Safari viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit", "iPad-sized Safari replay gate");
  await page.setViewportSize({ width: 768, height: 1024 });
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/replay");
  await page.getByRole("button", { name: "Use demo timetable" }).click();
  await expect(page.getByRole("heading", { name: "Replay Monday" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Replay time" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play day" })).toBeVisible();
  await expect(page.getByText("Map and replay run in your browser")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  guard.assertClean();
});

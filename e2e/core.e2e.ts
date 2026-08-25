import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectLanding, isMobileProject, watchForAppFailures } from "./helpers";

const fixturePath = path.join(process.cwd(), "tests", "fixtures", "sample-timetable.ics");
const twoTermFixturePath = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "sample-two-term-timetable.ics",
);

test("landing page is usable without an account", async ({ page }, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);
  await expect(
    page.getByText(
      isMobileProject(testInfo.project.name)
        ? "Your calendar stays on this device. No account required."
        : "Original .ics files never leave your device",
    ),
  ).toBeVisible();
  guard.assertClean();
});

test("bare fragments are removed without enabling hash routing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "URL behavior gate runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/#");
  await expect(
    page.getByRole("heading", { name: "Make every gap on campus count." }),
  ).toBeVisible();
  await expect.poll(() => page.url().endsWith("#")).toBe(false);

  await page.evaluate(() => {
    window.location.hash = "";
  });
  await expect.poll(() => page.url().endsWith("#")).toBe(false);
  expect(new URL(page.url()).pathname).toBe("/");
  guard.assertClean();
});

test("path navigation, refresh, and browser history use the SPA fallback", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "URL behavior gate runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  const response = await page.goto("/url-behavior-check");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await page.getByRole("link", { name: "Go home" }).click();
  await expect(
    page.getByRole("heading", { name: "Make every gap on campus count." }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  expect(new URL(page.url()).hash).toBe("");

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Make every gap on campus count." }),
  ).toBeVisible();
  guard.assertClean();
});

test("first-class product URLs load directly with intentional empty states", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "route entry coverage runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  const routes = [
    {
      path: "/timetable",
      title: "Timetable — Gapwise for UTM",
      heading: "Add your timetable",
    },
    {
      path: "/gaps",
      title: "Gap Plan — Gapwise for UTM",
      heading: "Add a timetable to plan your gaps",
    },
    {
      path: "/today",
      title: "Today — Gapwise for UTM",
      heading: "Add a timetable to see today",
    },
    {
      path: "/route",
      title: "Campus Route — Gapwise for UTM",
      heading: "Find your way around campus",
    },
  ] as const;

  for (const route of routes) {
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(route.title);
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: "Find your way around campus" })).toBeVisible();
  expect(new URL(page.url()).pathname.replace(/\/$/, "")).toBe("/route");
  guard.assertClean();
});

test("route-driven navigation preserves a loaded timetable through history", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "history state coverage runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page).toHaveURL(/\/timetable$/);
  await expect(page.getByRole("heading", { name: "Demo timetable" })).toBeVisible();

  const viewMode = page.getByRole("group", { name: "View mode" });
  await viewMode.getByRole("button", { name: "Gap plan" }).click();
  await expect(page).toHaveURL(/\/gaps$/);
  await expect(viewMode.getByRole("button", { name: "Gap plan" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await viewMode.getByRole("button", { name: "Day route" }).click();
  await expect(page).toHaveURL(/\/route\/?$/);
  await expect(viewMode.getByRole("button", { name: "Day route" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goBack();
  await expect(page).toHaveURL(/\/gaps$/);
  await expect(viewMode.getByRole("button", { name: "Gap plan" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("DEM101H5").first()).toBeAttached();

  await page.goForward();
  await expect(page).toHaveURL(/\/route\/?$/);
  await expect(page.getByRole("heading", { name: "Route preferences" })).toBeVisible();

  await page.getByRole("link", { name: "Gapwise for UTM home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Make every gap on campus count." }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/route\/?$/);
  await expect(page.getByRole("heading", { name: "Route preferences" })).toBeVisible();
  guard.assertClean();
});

test("timetable export offers available terms and downloads light and dark PNGs", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "PNG export coverage runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page).toHaveURL(/\/timetable$/);

  await page.getByRole("button", { name: "Export image" }).click();
  await expect(page.getByRole("dialog", { name: "Export timetable image" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Fall" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Winter" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Summer" })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "All available terms" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("radio", { name: "Light", exact: true }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate image" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("fall-winter-timetable.png");

  await page.getByRole("button", { name: "Export image" }).click();
  await page.getByRole("radio", { name: "Dark", exact: true }).click();
  const darkDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate image" }).click();
  expect((await darkDownloadPromise).suggestedFilename()).toBe("fall-winter-timetable.png");
  guard.assertClean();
});

test("campus explorer supports public building deep links and local search", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "map explorer coverage runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/route?building=MN");
  await expect(page.getByRole("heading", { name: "Maanjiwe nendamowinan" })).toBeVisible();
  await expect(
    page.getByTestId("entrance-coverage-summary").getByText("Partial coverage"),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("building")).toBe("MN");

  await page.getByRole("button", { name: "Close Maanjiwe nendamowinan details" }).click();
  await expect(page.getByRole("heading", { name: "Maanjiwe nendamowinan" })).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("building")).toBe(false);

  const search = page.getByRole("searchbox", { name: "Search UTM buildings" });
  const scrollBeforeSearch = await page.evaluate(() => window.scrollY);
  await search.fill("Kaneff");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Kaneff Centre" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Accessible main entrance A/ }).first(),
  ).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeSearch);

  await search.fill("Deerfield");
  await expect(page.getByRole("button", { name: /DH Deerfield Hall/ })).toBeVisible();
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Deerfield Hall" })).toBeVisible();
  const deerfieldDetails = page.getByRole("region", { name: "Deerfield Hall" });
  await expect(deerfieldDetails.getByRole("button", { name: /^Main entrance A / })).toBeVisible();
  await expect(deerfieldDetails.getByRole("button", { name: /^Main entrance B / })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("building")).toBe("DH");

  await search.fill("MN 3120");
  await search.press("Enter");
  await expect(page.getByText("MN 3120 · Floor 3")).toBeVisible();
  await expect(page.getByText(/Exact indoor room routing is not mapped/)).toBeVisible();
  expect(new URL(page.url()).searchParams.get("building")).toBe("MN");

  await page.goto("/route?building=NOT_A_BUILDING");
  await expect(page.getByRole("heading", { name: "Find your way around campus" })).toBeVisible();
  await expect(page.locator(".campus-building-card")).toHaveCount(0);
  guard.assertClean();
});

test("campus-day arrival settings route transit and parking through the map", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "commuter route coverage runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  await page
    .getByRole("group", { name: "View mode" })
    .getByRole("button", { name: "Day route" })
    .click();
  await expect(page.getByRole("heading", { name: "Route preferences" })).toBeVisible();

  await page.getByRole("button", { name: "Campus arrival settings" }).click();
  await page.getByRole("radio", { name: /Public transit/ }).click();
  await page.getByLabel("Campus arrival point").selectOption("miway-utm-bus-station");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Arrive on campus", { exact: true })).toBeVisible();
  await expect(page.getByText("Leave campus", { exact: true })).toBeVisible();
  await expect(page.getByText("UTM Bus Station (MiWay)").first()).toBeVisible();
  await expect(page.getByTestId("campus-day-anchor-marker")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Fit the active day route" })).toBeVisible();

  await page.getByRole("button", { name: "Campus arrival settings" }).click();
  await page.getByRole("radio", { name: /Drive \/ park/ }).click();
  await page.getByLabel("Campus arrival point").selectOption("parking-p8");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Park", { exact: true })).toBeVisible();
  await expect(page.getByText("Return to car", { exact: true })).toBeVisible();
  await expect(page.getByText("Parking Lot P8").first()).toBeVisible();
  await expect(page.getByTestId("campus-day-anchor-marker")).toHaveCount(1);
  guard.assertClean();
});

test("live map location appears only for accurate on-campus positions", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "geolocation privacy coverage runs once");
  await page.addInitScript(() => {
    const state: {
      success: PositionCallback | null;
      failure: PositionErrorCallback | null;
      cleared: number[];
    } = { success: null, failure: null, cleared: [] };
    Object.defineProperty(window, "__gapwiseGeolocationTest", { value: state });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition(success: PositionCallback, failure: PositionErrorCallback) {
          state.success = success;
          state.failure = failure;
          return 17;
        },
        clearWatch(id: number) {
          state.cleared.push(id);
        },
      },
    });
  });
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  const postBodies: string[] = [];
  page.on("request", (request) => {
    const body = request.postData();
    if (body) postBodies.push(body);
  });
  await page.goto("/route");
  await expect(page.getByRole("button", { name: "Show my location" })).toBeVisible();
  await expect(page.getByTestId("user-location-marker")).toHaveCount(0);
  await page.getByRole("button", { name: "Show my location" }).click();
  await expect(page.getByText("Finding you…")).toBeVisible();

  const emitPosition = (longitude: number, latitude: number, accuracy: number) =>
    page.evaluate(
      ([nextLongitude, nextLatitude, nextAccuracy]) => {
        const state = (
          window as typeof window & {
            __gapwiseGeolocationTest: { success: PositionCallback | null };
          }
        ).__gapwiseGeolocationTest;
        state.success?.({
          coords: {
            longitude: nextLongitude,
            latitude: nextLatitude,
            accuracy: nextAccuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        });
      },
      [longitude, latitude, accuracy] as const,
    );

  await emitPosition(-79.66475, 43.55105, 12);
  await expect(page.getByTestId("user-location-marker")).toBeVisible();
  await expect(page.getByText("Your on-campus location is shown")).toBeVisible();

  await emitPosition(-79.7, 43.57, 10);
  await expect(page.getByTestId("user-location-marker")).toHaveCount(0);
  await expect(page.getByText("You're outside the mapped UTM campus")).toBeVisible();

  await emitPosition(-79.66346, 43.54786, 8);
  await expect(page.getByTestId("user-location-marker")).toBeVisible();
  await page.getByRole("button", { name: "Hide my location" }).click();
  await expect(page.getByTestId("user-location-marker")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __gapwiseGeolocationTest: { cleared: number[] };
          }
        ).__gapwiseGeolocationTest.cleared,
    ),
  ).toEqual([17]);

  const persisted = await page.evaluate(() => ({
    local: JSON.stringify(window.localStorage),
    session: JSON.stringify(window.sessionStorage),
  }));
  expect(JSON.stringify(persisted)).not.toContain("-79.66346");
  expect(postBodies.join("\n")).not.toContain("-79.66346");
  guard.assertClean();
});

test("tapping recognized map geometry selects a building without a timetable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "pointer map coverage runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/route?building=MN");
  await expect(page.getByRole("button", { name: "Return to campus overview" })).toBeVisible();
  await page.getByRole("button", { name: "Close Maanjiwe nendamowinan details" }).click();
  await expect(page.locator(".map-entrance-marker")).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("building")).toBe(false);

  const canvas = page.locator(".maplibregl-canvas").first();
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Campus map canvas bounds are unavailable.");

  let recognizedPoint: { x: number; y: number } | null = null;
  const columns = 14;
  const rows = 12;
  for (let row = 2; row < rows - 1 && !recognizedPoint; row += 1) {
    for (let column = 2; column < columns - 1; column += 1) {
      const point = {
        x: bounds.x + (bounds.width * column) / columns,
        y: bounds.y + (bounds.height * row) / rows,
      };
      await page.mouse.move(point.x, point.y);
      const cursor = await canvas.evaluate((element) => element.style.cursor);
      if (cursor === "pointer") {
        recognizedPoint = point;
        break;
      }
    }
  }

  expect(
    recognizedPoint,
    "expected at least one visible canonical building footprint",
  ).not.toBeNull();
  if (!recognizedPoint)
    throw new Error("No recognized building geometry was found on the visible map.");
  await page.mouse.click(recognizedPoint.x, recognizedPoint.y);
  await expect(page.locator(".campus-building-card")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("building")).not.toBeNull();
  guard.assertClean();
});

test("the selected color theme persists across reloads", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "theme persistence gate runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  guard.assertClean();
});

test("synthetic ACORN import reaches a usable timetable", async ({ page }, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.locator("#ics-file").setInputFiles(fixturePath);

  if (isMobileProject(testInfo.project.name)) {
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await page.getByRole("link", { name: "Timetable" }).click();
    await expect(page.getByText("Day timetable")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Monday" })).toBeVisible();
    await expect(page.getByText("CSC108H5")).toBeVisible();
    await expect(page.getByText("MAT102H5")).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Your timetable" })).toBeVisible();
    await expect(page.getByText(/2 meetings in Fall/)).toBeVisible();
    const viewMode = page.getByRole("group", { name: "View mode" });
    await expect(viewMode.getByRole("button", { name: "Weekly timetable" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }

  guard.assertClean();
});

test("two-term ACORN import switches between Fall and Winter", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "term-switch gate runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.locator("#ics-file").setInputFiles(twoTermFixturePath);
  await expect(page.getByRole("heading", { name: "Your timetable" })).toBeVisible();

  const terms = page.getByRole("group", { name: "Term" });
  await expect(terms.getByRole("button", { name: "Fall" })).toBeVisible();
  await expect(terms.getByRole("button", { name: "Winter" })).toBeVisible();
  await terms.getByRole("button", { name: "Winter" }).click();
  await expect(terms.getByRole("button", { name: "Winter" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText(/2 meetings in Winter/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /View details for CSC148H5/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /View details for MAT136H5/ }).first(),
  ).toBeVisible();

  guard.assertClean();
});

test("mobile term switching selects a scheduled weekday", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile state regression runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);
  await page.locator("#ics-file").setInputFiles({
    name: "mobile-terms.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        "UID:fall-monday",
        "DTSTART:20260907T090000",
        "DTEND:20260907T100000",
        "SUMMARY:CSC108H5 LEC 0101",
        "DESCRIPTION:Introduction to Computer Programming",
        "LOCATION:MN 1210",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:winter-friday",
        "DTSTART:20270115T130000",
        "DTEND:20270115T140000",
        "SUMMARY:CSC148H5 LEC 0101",
        "DESCRIPTION:Introduction to Computer Science",
        "LOCATION:MN 1210",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
    ),
  });
  await page.getByRole("link", { name: "Timetable" }).click();
  await expect(page.getByRole("heading", { name: "Monday", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Winter" }).click();
  await expect(page.getByRole("heading", { name: "Friday" })).toBeVisible();
  await expect(page.getByText("CSC148H5")).toBeVisible();
  await page.getByRole("group", { name: "Weekday" }).getByRole("button", { name: /^Mon/ }).click();
  await expect(page.getByRole("heading", { name: "Monday", exact: true })).toBeVisible();
  await expect(page.getByText("Nothing scheduled in Winter")).toBeVisible();
  guard.assertClean();
});

test("mobile weekday buttons expose native keyboard selection state", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile keyboard regression runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);
  await page.getByRole("button", { name: "Try a demo" }).click();
  await page.getByRole("link", { name: "Timetable" }).click();

  const weekdays = page.getByRole("group", { name: "Weekday" });
  const monday = weekdays.getByRole("button", { name: /^Mon/ });
  const tuesday = weekdays.getByRole("button", { name: /^Tue/ });
  await monday.focus();
  await page.keyboard.press("Tab");
  await expect(tuesday).toBeFocused();
  await page.keyboard.press("Space");
  await expect(tuesday).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Tuesday" })).toBeVisible();
  guard.assertClean();
});

test("malformed calendar fails safely with a useful error", async ({ page }, testInfo) => {
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.locator("#ics-file").setInputFiles({
    name: "broken.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from("not an ics calendar"),
  });

  await expect(page.getByRole("alert")).toContainText("doesn't look like a calendar export");
  const landingHeading = isMobileProject(testInfo.project.name)
    ? "See gaps. Navigate UTM. Privately."
    : "Make every gap on campus count.";
  await expect(page.getByRole("heading", { name: landingHeading })).toBeVisible();
  guard.assertClean();
});

test("desktop demo moves between timetable, gaps, and route", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), "desktop view-mode coverage");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page.getByRole("heading", { name: "Demo timetable" })).toBeVisible();
  await expect(
    page.getByText("Classes stay solid; usable time between them glows in blue"),
  ).toBeVisible();
  const visibleGapWindows = page.getByTestId("gap-window");
  await expect(visibleGapWindows.first()).toBeVisible();
  expect(await visibleGapWindows.count()).toBeGreaterThan(0);

  const viewMode = page.getByRole("group", { name: "View mode" });
  await viewMode.getByRole("button", { name: "Gap plan" }).click();
  await expect(page.getByText("Tune gap recommendations")).toBeVisible();

  await viewMode.getByRole("button", { name: "Day route" }).click();
  await expect(page.getByRole("heading", { name: "Route preferences" })).toBeVisible();
  guard.assertClean();
});

test("mobile demo exposes the primary timetable and map navigation", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo.project.name), "mobile navigation coverage");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.getByRole("button", { name: "Try a demo" }).click();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Timetable" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Map" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "More" })).toBeVisible();

  await nav.getByRole("link", { name: "Timetable" }).click();
  await expect(page.getByText("Day timetable")).toBeVisible();

  await nav.getByRole("link", { name: "Map" }).click();
  await expect(page.getByText("Campus route")).toBeVisible();
  await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
  guard.assertClean();
});

test("mobile campus explorer keeps building details dismissible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile map explorer runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/route?building=MN");
  await expect(page.getByRole("heading", { name: "Explore campus" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Maanjiwe nendamowinan" })).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Interactive map of the University of Toronto Mississauga campus",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close Maanjiwe nendamowinan details" }).click();
  await expect(page.locator(".campus-building-card")).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Search UTM buildings" })).toBeVisible();
  guard.assertClean();
});

test("calendar source bytes stay out of network request bodies", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "privacy network gate runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  const postBodies: string[] = [];
  page.on("request", (request) => {
    const body = request.postData();
    if (body) postBodies.push(body);
  });

  await expectLanding(page);
  await page.locator("#ics-file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "Your timetable" })).toBeVisible();

  expect(postBodies.join("\n")).not.toContain("BEGIN:VCALENDAR");
  expect(postBodies.join("\n")).not.toContain("CSC108H5");
  expect(postBodies.join("\n")).not.toContain("MAT102H5");
  guard.assertClean();
});

test("guest import never writes plaintext timetable persistence", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for storage policy");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.locator("#ics-file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "Your timetable" })).toBeVisible();

  const stored = await page.evaluate(() => ({
    timetable: window.localStorage.getItem("gapwise:timetable"),
    remember: window.localStorage.getItem("gapwise:remember"),
  }));
  expect(stored).toEqual({ timetable: null, remember: null });

  await page.reload();
  await expect(page).toHaveURL(/\/timetable$/);
  await expect(page.getByRole("heading", { name: "Add your timetable" })).toBeVisible();
  guard.assertClean();
});

test("guest encrypted device restore survives reload and can be removed", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for secure persistence");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));
  await expectLanding(page);

  await page.getByLabel("Remember on this device").check();
  await expect(page.getByText("Encrypted device restore is on for this browser.")).toBeVisible();
  await page.locator("#ics-file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "Your timetable" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your timetable" })).toBeVisible();
  await expect(page.getByText("CSC108H5").first()).toBeVisible();

  expect(
    await page.evaluate(() => ({
      timetable: window.localStorage.getItem("gapwise:timetable"),
      remember: window.localStorage.getItem("gapwise:remember"),
    })),
  ).toEqual({ timetable: null, remember: null });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove timetable" }).click();
  await expect(page.getByRole("heading", { name: "Add your timetable" })).toBeVisible();
  await expect(page.locator("#product-ics-file")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Add your timetable" })).toBeVisible();
  await page.goto("/");
  await expectLanding(page);
  guard.assertClean();
});

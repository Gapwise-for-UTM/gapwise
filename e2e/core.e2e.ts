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
  await expect(page.getByText("Original .ics files never leave your device")).toBeVisible();
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
  guard.assertClean();
});

test("campus explorer supports public building deep links and local search", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "map explorer coverage runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/route?building=MN");
  await expect(page.getByRole("heading", { name: "Maanjiwe nendamowinan" })).toBeVisible();
  await expect(page.getByText("Verified mapped entrance data")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("building")).toBe("MN");

  await page.getByRole("button", { name: "Close Maanjiwe nendamowinan details" }).click();
  await expect(page.getByRole("heading", { name: "Maanjiwe nendamowinan" })).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("building")).toBe(false);

  const search = page.getByRole("searchbox", { name: "Search UTM buildings" });
  await search.fill("Deerfield");
  await expect(page.getByRole("button", { name: /DH Deerfield Hall/ })).toBeVisible();
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Deerfield Hall" })).toBeVisible();
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

test("tapping recognized map geometry selects a building without a timetable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "pointer map coverage runs once in Chromium");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/route?building=MN");
  await expect(page.getByRole("button", { name: "Return to campus overview" })).toBeVisible();
  await page.getByRole("button", { name: "Close Maanjiwe nendamowinan details" }).click();
  const map = page.getByRole("region", {
    name: "Interactive map of the University of Toronto Mississauga campus",
  });
  const bounds = await map.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Campus map bounds are unavailable.");
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.getByRole("heading", { name: "Maanjiwe nendamowinan" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("building")).toBe("MN");
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
  await expect(
    page.getByRole("heading", { name: "Make every gap on campus count." }),
  ).toBeVisible();
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

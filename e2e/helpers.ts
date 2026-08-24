import { expect, type Page } from "@playwright/test";

export function isMobileProject(projectName: string) {
  return projectName.startsWith("mobile-");
}

export function watchForAppFailures(page: Page, baseURL: string) {
  const failures: string[] = [];
  const appOrigin = new URL(baseURL).origin;
  const ignoredLocalInstrumentationPaths = ["/_vercel/insights/", "/_vercel/speed-insights/"];

  const isIgnoredLocalInstrumentationRequest = (url: URL) =>
    url.origin === appOrigin &&
    ignoredLocalInstrumentationPaths.some((path) => url.pathname.startsWith(path));

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;

    // Browsers emit a generic console error for failed resource loads without
    // including the URL. Response/request failure listeners below provide the
    // actionable first-party URL instead and avoid treating third-party assets
    // (or deliberately offline PWA requests) as app runtime exceptions.
    if (message.text().startsWith("Failed to load resource:")) return;

    const location = message.location().url;
    if (!location || location.startsWith(appOrigin)) {
      failures.push(`console.error: ${message.text()}`);
    }
  });

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (isIgnoredLocalInstrumentationRequest(url)) return;
    if (url.origin === appOrigin && response.status() >= 400) {
      failures.push(`HTTP ${response.status()}: ${url.pathname}`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (isIgnoredLocalInstrumentationRequest(url)) return;
    if (url.origin !== appOrigin) return;
    failures.push(`request failed: ${url.pathname} (${request.failure()?.errorText ?? "unknown"})`);
  });

  return {
    assertClean() {
      expect(failures, "unexpected first-party browser/runtime failures").toEqual([]);
    },
  };
}

export async function expectLanding(page: Page) {
  await page.goto("/");
  const mobile = (page.viewportSize()?.width ?? 1280) < 768;
  await expect(
    page.getByRole("heading", {
      name: mobile ? "See gaps. Navigate UTM. Privately." : "Make every gap on campus count.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try a demo" })).toBeVisible();
  await expect(page.locator("#ics-file")).toHaveCount(1);
}

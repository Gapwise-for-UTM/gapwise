import { expect, type Page } from "@playwright/test";

export function isMobileProject(projectName: string) {
  return projectName.startsWith("mobile-");
}

export function watchForAppFailures(page: Page, baseURL: string) {
  const failures: string[] = [];
  const appOrigin = new URL(baseURL).origin;

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    if (!location || location.startsWith(appOrigin)) {
      failures.push(`console.error: ${message.text()}`);
    }
  });

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === appOrigin && response.status() >= 500) {
      failures.push(`HTTP ${response.status()}: ${url.pathname}`);
    }
  });

  return {
    assertClean() {
      expect(failures, "unexpected first-party browser/runtime failures").toEqual([]);
    },
  };
}

export async function expectLanding(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Make every gap on campus count." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try a demo" })).toBeVisible();
  await expect(page.locator("#ics-file")).toHaveCount(1);
}

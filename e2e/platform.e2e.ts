import { expect, test } from "@playwright/test";
import { watchForAppFailures } from "./helpers";

test("developer entrypoint exposes the public platform contract and resources", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "developer entrypoint coverage runs once");
  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));

  await page.goto("/developers");

  await expect(page).toHaveTitle(/Gapwise Developers/);
  await expect(
    page.getByRole("heading", { name: "Build with the campus layer behind Gapwise." }),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Documentation" })).toHaveAttribute(
    "href",
    "https://docs.gapwise.ca",
  );
  await expect(page.getByRole("link", { name: "OpenAPI", exact: true })).toHaveAttribute(
    "href",
    "https://api.gapwise.ca/openapi.json",
  );
  await expect(page.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/Gapwise-for-UTM/gapwise",
  );

  const example = page.locator("pre").first();
  await expect(example).toContainText("https://api.gapwise.ca/v1/routes");
  await expect(example).toContainText("const { data, meta } = await response.json()");

  await expect(page.getByRole("heading", { name: "https://api.gapwise.ca/v1" })).toBeVisible();
  for (const endpoint of ["/v1/buildings", "/v1/places", "/v1/routes", "/v1/gaps/plan"]) {
    await expect(page.getByText(endpoint, { exact: true })).toBeVisible();
  }

  await expect(page.getByText(/Public v1 requires no API key/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Download JSON" })).toHaveAttribute(
    "href",
    "/data/utm-campus-v1.json",
  );

  guard.assertClean();
});

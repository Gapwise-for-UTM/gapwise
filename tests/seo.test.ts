import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { listCampusPlaces } from "../src/features/campus-state/snapshot";
import { listSeoWalkingRoutes } from "../src/data/seo-walking-routes";

const SITE_ORIGIN = "https://gapwise.ca";

function sitemapLocations(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

describe("Gapwise UTM searchability", () => {
  test("publishes a focused sitemap with substantive campus and walking-time pages", async () => {
    const sitemap = await readFile("public/sitemap.xml", "utf8");
    const locations = sitemapLocations(sitemap);
    const expected = [
      `${SITE_ORIGIN}/`,
      `${SITE_ORIGIN}/utm/walking-times`,
      `${SITE_ORIGIN}/places`,
      ...listCampusPlaces().map((place) => `${SITE_ORIGIN}/places/${place.id}`),
      `${SITE_ORIGIN}/developers`,
      `${SITE_ORIGIN}/trust`,
      `${SITE_ORIGIN}/privacy`,
      `${SITE_ORIGIN}/security`,
      `${SITE_ORIGIN}/accessibility`,
      ...listSeoWalkingRoutes().map(
        ({ route }) => `${SITE_ORIGIN}/utm/walking-time/${route}`,
      ),
    ];

    expect(locations).toEqual(expected);
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations).not.toContain(`${SITE_ORIGIN}/today`);
    expect(locations).not.toContain(`${SITE_ORIGIN}/timetable`);
    expect(locations).not.toContain(`${SITE_ORIGIN}/gaps`);
    expect(locations).not.toContain(`${SITE_ORIGIN}/oauth/consent`);
  });

  test("robots points at the canonical sitemap and keeps internal surfaces out of crawl", async () => {
    const robots = await readFile("public/robots.txt", "utf8");
    const directives = robots.split("\n").filter(Boolean);
    expect(directives).toContain("User-agent: *");
    expect(directives).toContain("Allow: /");
    expect(directives).toContain("Disallow: /_seo/");
    expect(directives).toContain("Disallow: /api/");
    expect(directives).toContain("Disallow: /v1");
    expect(directives).toContain("Disallow: /oauth/");
    expect(directives).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });

  test("the build emits real crawlable HTML with canonical, social, and WebApplication metadata", async () => {
    const [packageJson, builder, finalizer] = await Promise.all([
      readFile("package.json", "utf8").then((value) => JSON.parse(value)),
      readFile("scripts/build-seo-pages.ts", "utf8"),
      readFile("scripts/finalize-static-seo.ts", "utf8"),
    ]);

    expect(packageJson.scripts.build).toContain("bun scripts/build-seo-pages.ts");
    expect(packageJson.scripts.build).toContain("bun scripts/finalize-static-seo.ts");
    expect(builder).toContain('title: "Gapwise UTM — Timetable, Gap & Campus Route Planner"');
    expect(builder).toContain('name="description"');
    expect(builder).toContain('rel="canonical"');
    expect(builder).toContain('property="og:site_name" content="Gapwise UTM"');
    expect(builder).toContain('name="twitter:card" content="summary"');
    expect(builder).toContain('type="application/ld+json"');
    expect(builder).toContain('"@type": "WebApplication"');
    expect(builder).toContain('"@type": "BreadcrumbList"');
    expect(builder).toContain("routeBetweenPublicBuildings");
    expect(builder).toContain("data-gapwise-search-fallback");
    expect(finalizer).toContain('script[type="module"], link[rel="modulepreload"]');
    expect(finalizer).toContain("walking-route-links");
    expect(builder).toContain(
      "Gapwise is an independent student project for University of Toronto Mississauga.",
    );
    expect(builder).toContain("does not claim university approval, sponsorship, or endorsement");
  });

  test("Vercel serves generated public HTML while noindexing only private app-state surfaces", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      trailingSlash?: boolean;
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
      rewrites: Array<{ source: string; destination: string }>;
    };
    const rewrite = new Map(config.rewrites.map((entry) => [entry.source, entry.destination]));

    expect(config.trailingSlash).toBe(false);
    expect(rewrite.get("/utm/walking-times")).toBe("/_seo/utm--walking-times.html");
    expect(rewrite.get("/utm/walking-time/:route")).toBe(
      "/_seo/utm--walking-time--:route.html",
    );
    expect(rewrite.get("/places")).toBe("/_seo/places.html");
    for (const place of listCampusPlaces()) {
      expect(rewrite.get(`/places/${place.id}`)).toBe(`/_seo/places--${place.id}.html`);
    }
    for (const path of [
      "/developers",
      "/trust",
      "/privacy",
      "/security",
      "/accessibility",
      "/terms",
    ]) {
      expect(rewrite.get(path)).toBe(`/_seo/${path.slice(1)}.html`);
    }

    const noindexSources = config.headers
      .filter((entry) =>
        entry.headers.some(
          (header) => header.key === "X-Robots-Tag" && header.value === "noindex, nofollow",
        ),
      )
      .map((entry) => entry.source);
    for (const path of [
      "/today",
      "/timetable",
      "/gaps",
      "/route/(.*)",
      "/oauth/(.*)",
      "/api/(.*)",
      "/v1",
      "/v1/(.*)",
    ]) {
      expect(noindexSources).toContain(path);
    }

    // Vercel applies headers from an internal rewrite destination to the public URL.
    // Direct crawl of /_seo is blocked in robots.txt, but an X-Robots-Tag here would
    // silently deindex the canonical public pages that rewrite to those files.
    expect(noindexSources).not.toContain("/_seo/(.*)");
  });
});

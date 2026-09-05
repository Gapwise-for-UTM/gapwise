import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { listCampusPlaces } from "../src/features/campus-state/snapshot";

const SITE_ORIGIN = "https://gapwise.ca";
const FEATURE_PATHS = [
  "/about",
  "/utm-timetable",
  "/campus-map",
  "/gap-planner",
  "/campus-routing",
  "/acorn-import",
] as const;

function sitemapLocations(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("Gapwise searchability and entity metadata", () => {
  test("publishes a focused sitemap with substantive public feature and place pages", async () => {
    const sitemap = await readFile("public/sitemap.xml", "utf8");
    const locations = sitemapLocations(sitemap);
    const expected = [
      `${SITE_ORIGIN}/`,
      ...FEATURE_PATHS.map((path) => `${SITE_ORIGIN}${path}`),
      `${SITE_ORIGIN}/places`,
      ...listCampusPlaces().map((place) => `${SITE_ORIGIN}/places/${place.id}`),
      `${SITE_ORIGIN}/developers`,
      `${SITE_ORIGIN}/ai`,
      `${SITE_ORIGIN}/support`,
      `${SITE_ORIGIN}/trust`,
      `${SITE_ORIGIN}/privacy`,
      `${SITE_ORIGIN}/security`,
      `${SITE_ORIGIN}/accessibility`,
    ];

    expect(locations).toEqual(expected);
    for (const privatePath of ["/today", "/timetable", "/gaps", "/route", "/oauth/consent"]) {
      expect(locations).not.toContain(`${SITE_ORIGIN}${privatePath}`);
    }
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

  test("build contract makes Gapwise the canonical brand and publishes Website + Organization schema", async () => {
    const [packageJson, builder] = await Promise.all([
      readFile("package.json", "utf8").then((value) => JSON.parse(value)),
      readFile("scripts/build-seo-pages.ts", "utf8"),
    ]);

    expect(packageJson.scripts.build).toContain("bun scripts/check-seo-output.ts");
    expect(builder).toContain('title: "Gapwise — UTM Timetable, Gap Planner & Campus Routes"');
    expect(builder).toContain('name="application-name" content="Gapwise"');
    expect(builder).toContain('property="og:site_name" content="Gapwise"');
    expect(builder).toContain('name="twitter:card" content="summary_large_image"');
    expect(builder).toContain('property="og:image:width" content="1200"');
    expect(builder).toContain('property="og:image:height" content="630"');
    expect(builder).toContain('"@type": "WebSite"');
    expect(builder).toContain('"@type": "Organization"');
    expect(builder).toContain('name: "Gapwise"');
    expect(builder).toContain('alternateName: ["Gapwise UTM", "Gapwise for UTM"]');
    expect(builder).toContain("https://github.com/Gapwise-for-UTM");
    expect(builder).toContain("data-gapwise-search-fallback");
  });

  test("publishes a large favicon and a true 1200x630 social image", async () => {
    const [index, favicon, social] = await Promise.all([
      readFile("index.html", "utf8"),
      readFile("public/favicon-192x192.png"),
      readFile("public/og-gapwise.png"),
    ]);
    expect(index).toContain('href="/favicon-192x192.png" sizes="192x192"');
    expect(pngDimensions(favicon)).toEqual({ width: 192, height: 192 });
    expect(pngDimensions(social)).toEqual({ width: 1200, height: 630 });
  });

  test("Vercel serves generated public HTML while preserving noindex app-state boundaries", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      trailingSlash?: boolean;
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
      rewrites: Array<{ source: string; destination: string }>;
    };
    const rewrite = new Map(config.rewrites.map((entry) => [entry.source, entry.destination]));

    expect(config.trailingSlash).toBe(false);
    for (const path of FEATURE_PATHS) {
      expect(rewrite.get(path)).toBe(`/_seo/${path.slice(1)}.html`);
    }
    expect(rewrite.get("/places")).toBe("/_seo/places.html");
    for (const place of listCampusPlaces()) {
      expect(rewrite.get(`/places/${place.id}`)).toBe(`/_seo/places--${place.id}.html`);
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
      "/_seo/(.*)",
    ])
      expect(noindexSources).toContain(path);
  });
});

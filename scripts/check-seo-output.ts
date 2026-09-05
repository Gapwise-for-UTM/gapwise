import { readFile } from "node:fs/promises";

function requireText(haystack: string, needle: string, label: string) {
  if (!haystack.includes(needle)) throw new Error(`${label} is missing ${needle}`);
}

const [home, sitemap, robots] = await Promise.all([
  readFile("dist/index.html", "utf8"),
  readFile("dist/sitemap.xml", "utf8"),
  readFile("dist/robots.txt", "utf8"),
]);

for (const needle of [
  '<meta property="og:site_name" content="Gapwise"',
  '<meta property="og:image:width" content="1200"',
  '<meta property="og:image:height" content="630"',
  '<meta name="twitter:card" content="summary_large_image"',
  '"@type":"WebSite"',
  '"@type":"Organization"',
  '"name":"Gapwise"',
  '"alternateName":["Gapwise UTM","Gapwise for UTM"]',
  "https://github.com/Gapwise-for-UTM",
])
  requireText(home, needle, "homepage metadata");

for (const path of [
  "/about",
  "/utm-timetable",
  "/campus-map",
  "/gap-planner",
  "/campus-routing",
  "/acorn-import",
]) {
  requireText(sitemap, `<loc>https://gapwise.ca${path}</loc>`, "sitemap");
}

for (const privatePath of ["/today", "/timetable", "/gaps", "/oauth/"]) {
  if (sitemap.includes(`<loc>https://gapwise.ca${privatePath}`)) {
    throw new Error(`private/stateful path leaked into sitemap: ${privatePath}`);
  }
}
requireText(robots, "Disallow: /_seo/", "robots.txt");
requireText(robots, "Disallow: /api/", "robots.txt");
requireText(robots, "Disallow: /oauth/", "robots.txt");
requireText(robots, "Sitemap: https://gapwise.ca/sitemap.xml", "robots.txt");

console.log("Generated SEO output verified.");

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SEO_DIR = join("dist", "_seo");
const WALKING_HUB = "utm--walking-times.html";
const WALKING_ROUTE_PREFIX = "utm--walking-time--";

function stripClientRuntime(html: string) {
  return html
    .replace(/<script\b[^>]*\btype=["']module["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi, "");
}

function routeLabel(fileName: string) {
  return fileName
    .slice(WALKING_ROUTE_PREFIX.length, -".html".length)
    .split("-to-")
    .map((part) => part.replaceAll("-", " "))
    .join(" to ");
}

function routeHref(fileName: string) {
  const route = fileName.slice(WALKING_ROUTE_PREFIX.length, -".html".length);
  return `/utm/walking-time/${route}`;
}

function addHubRouteLinks(html: string, routeFiles: string[]) {
  if (routeFiles.length === 0 || !html.includes("</main>")) return html;

  const links = routeFiles
    .sort()
    .map(
      (fileName) =>
        `<li><a href="${routeHref(fileName)}">${routeLabel(fileName)}</a></li>`,
    )
    .join("\n");

  const section = `<section aria-labelledby="walking-route-links">
        <h2 id="walking-route-links">UTM building-to-building walking times</h2>
        <p>Browse canonical Gapwise estimates generated from the same deterministic campus-routing source of truth used by the application.</p>
        <ul>${links}</ul>
      </section>`;

  return html.replace("</main>", `${section}\n    </main>`);
}

const files = await readdir(SEO_DIR);
const routeFiles = files.filter(
  (fileName) => fileName.startsWith(WALKING_ROUTE_PREFIX) && fileName.endsWith(".html"),
);
const utmFiles = files.filter(
  (fileName) => fileName === WALKING_HUB || fileName.startsWith(WALKING_ROUTE_PREFIX),
);

for (const fileName of utmFiles) {
  const path = join(SEO_DIR, fileName);
  let html = stripClientRuntime(await readFile(path, "utf8"));

  if (fileName === WALKING_HUB) {
    html = addHubRouteLinks(html, routeFiles);
  }

  await writeFile(path, html);
}

console.log(
  `Finalized ${utmFiles.length} static UTM SEO pages; ${routeFiles.length} canonical walking routes linked from the hub.`,
);

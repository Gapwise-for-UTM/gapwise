import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Window } from "happy-dom";

const SEO_DIR = join("dist", "_seo");
const WALKING_HUB = "utm--walking-times.html";
const WALKING_ROUTE_PREFIX = "utm--walking-time--";

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

function finalizeDocument(html: string, fileName: string, routeFiles: string[]) {
  const window = new Window();
  const { document } = window;
  document.write(html);

  for (const element of document.querySelectorAll(
    'script[type="module"], link[rel="modulepreload"]',
  )) {
    element.remove();
  }

  if (fileName === WALKING_HUB && routeFiles.length > 0) {
    const main = document.querySelector("main[data-gapwise-search-fallback]");
    if (main) {
      const section = document.createElement("section");
      section.setAttribute("aria-labelledby", "walking-route-links");

      const heading = document.createElement("h2");
      heading.id = "walking-route-links";
      heading.textContent = "UTM building-to-building walking times";
      section.append(heading);

      const description = document.createElement("p");
      description.textContent =
        "Browse canonical Gapwise estimates generated from the same deterministic campus-routing source of truth used by the application.";
      section.append(description);

      const list = document.createElement("ul");
      for (const routeFile of [...routeFiles].sort()) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = routeHref(routeFile);
        link.textContent = routeLabel(routeFile);
        item.append(link);
        list.append(item);
      }
      section.append(list);
      main.append(section);
    }
  }

  const output = `<!doctype html>\n${document.documentElement.outerHTML}\n`;
  window.close();
  return output;
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
  const html = await readFile(path, "utf8");
  await writeFile(path, finalizeDocument(html, fileName, routeFiles));
}

console.log(
  `Finalized ${utmFiles.length} static UTM SEO pages; ${routeFiles.length} canonical walking routes linked from the hub.`,
);

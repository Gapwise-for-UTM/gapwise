import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type ManifestChunk = {
  file: string;
  imports?: string[];
  css?: string[];
};

const manifest = JSON.parse(readFileSync("dist/.vite/manifest.json", "utf8")) as Record<
  string,
  ManifestChunk
>;
const appEntry = "src/routes/_app.tsx?tsr-split=component";
if (!manifest[appEntry]) throw new Error(`Missing bundle manifest entry: ${appEntry}`);

const files = new Set<string>();
const visit = (key: string) => {
  const chunk = manifest[key];
  if (!chunk || files.has(chunk.file)) return;
  files.add(chunk.file);
  chunk.css?.forEach((file) => files.add(file));
  chunk.imports?.forEach(visit);
};
visit(appEntry);

const totals = [...files].reduce(
  (result, file) => {
    const contents = readFileSync(join("dist", file));
    const kind = file.endsWith(".css") ? "css" : "js";
    result[kind] += gzipSync(contents).byteLength;
    return result;
  },
  { js: 0, css: 0 },
);

// These leave modest headroom above the measured Phase 5 baseline while still
// catching the accidental eager loading of MapLibre, model-viewer, or parsing.
const budgets = { js: 430 * 1024, css: 45 * 1024 };
for (const kind of ["js", "css"] as const) {
  if (totals[kind] > budgets[kind]) {
    throw new Error(
      `Initial app ${kind.toUpperCase()} is ${totals[kind]} gzip bytes; budget is ${budgets[kind]}.`,
    );
  }
}

console.log(
  `Initial app route: ${(totals.js / 1024).toFixed(1)} KiB JS + ${(totals.css / 1024).toFixed(1)} KiB CSS (gzip).`,
);

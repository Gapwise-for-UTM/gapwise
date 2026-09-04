import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const API_DIRECTORY = fileURLToPath(new URL("../api/", import.meta.url));
const HOBBY_FUNCTION_LIMIT = 12;

async function collectFunctionFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith("_")) continue;

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFunctionFiles(path, root)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(relative(root, path).split(sep).join("/"));
    }
  }

  return files;
}

const functionFiles = (await collectFunctionFiles(API_DIRECTORY)).sort();

if (functionFiles.length > HOBBY_FUNCTION_LIMIT) {
  console.error(
    `Vercel Hobby function budget exceeded: ${functionFiles.length}/${HOBBY_FUNCTION_LIMIT} deployable api/*.ts functions.`,
  );
  for (const file of functionFiles) console.error(`- api/${file}`);
  console.error(
    "Consolidate handlers behind rewrites/shared functions before merging; do not require a paid plan merely to clear this check.",
  );
  process.exit(1);
}

console.log(
  `Vercel Hobby function budget OK: ${functionFiles.length}/${HOBBY_FUNCTION_LIMIT} deployable functions.`,
);

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, copyFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = resolve(repoRoot, "src/data/utm");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const write = args.includes("--write");
const sourceArg = args.find((arg) => arg.startsWith("--source="))?.slice("--source=".length);
const sourceRoot = resolve(repoRoot, sourceArg ?? "../gapwise-data/data/utm");
const ignoredSourceFiles = new Set(["SHA256SUMS"]);

if (checkOnly === write) {
  console.error("Choose exactly one mode: --check or --write.");
  process.exit(2);
}

if (!existsSync(sourceRoot)) {
  console.error(
    `Canonical campus data was not found at ${sourceRoot}. ` +
      "Check out andrewmuratov/gapwise-data next to gapwise, or pass --source=<path>.",
  );
  process.exit(2);
}

async function filesUnder(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        const path = relative(root, absolute).replaceAll("\\", "/");
        if (!ignoredSourceFiles.has(path)) files.push(path);
      }
    }
  }

  await visit(root);
  return files.sort();
}

const sourceFiles = await filesUnder(sourceRoot);
const targetFiles = existsSync(targetRoot) ? await filesUnder(targetRoot) : [];
const sourceSet = new Set(sourceFiles);
const targetSet = new Set(targetFiles);
const differences: string[] = [];

for (const path of sourceFiles) {
  const source = resolve(sourceRoot, path);
  const target = resolve(targetRoot, path);
  if (!targetSet.has(path)) {
    differences.push(`missing in gapwise: ${path}`);
    continue;
  }
  const [sourceBytes, targetBytes] = await Promise.all([readFile(source), readFile(target)]);
  if (!sourceBytes.equals(targetBytes)) differences.push(`content differs: ${path}`);
}

for (const path of targetFiles) {
  if (!sourceSet.has(path)) differences.push(`extra in gapwise mirror: ${path}`);
}

if (checkOnly) {
  if (differences.length > 0) {
    console.error("Campus data mirror differs from andrewmuratov/gapwise-data:");
    for (const difference of differences) console.error(`- ${difference}`);
    process.exit(1);
  }
  console.log(`Campus data mirror is in sync (${sourceFiles.length} files).`);
  process.exit(0);
}

for (const path of targetFiles) {
  if (!sourceSet.has(path)) await rm(resolve(targetRoot, path), { force: true });
}
for (const path of sourceFiles) {
  const source = resolve(sourceRoot, path);
  const target = resolve(targetRoot, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

console.log(`Synced ${sourceFiles.length} canonical campus data files into src/data/utm.`);

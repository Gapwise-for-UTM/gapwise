import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = resolve(repoRoot, "src/data/utm");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const write = args.includes("--write");
const publish = args.includes("--publish");
const sourceArg = args.find((arg) => arg.startsWith("--source="))?.slice("--source=".length);
const sourceRoot = resolve(repoRoot, sourceArg ?? "../data/data/utm");
const dataRepoRoot = resolve(sourceRoot, "../..");
const ignoredFiles = new Set(["SHA256SUMS"]);
const sourceSnapshot = resolve(dataRepoRoot, "public/data/utm-campus-v1.json");
const targetSnapshot = resolve(repoRoot, "public/data/utm-campus-v1.json");

if ([checkOnly, write, publish].filter(Boolean).length !== 1) {
  console.error("Choose exactly one mode: --check, --write, or --publish.");
  process.exit(2);
}

if (!existsSync(sourceRoot)) {
  console.error(
    `Canonical campus data was not found at ${sourceRoot}. ` +
      "Check out Gapwise-for-UTM/data next to gapwise, or pass --source=<path>.",
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
        if (!ignoredFiles.has(path)) files.push(path);
      }
    }
  }

  await visit(root);
  return files.sort();
}

async function mirror(fromRoot: string, toRoot: string, fromFiles: string[], toFiles: string[]) {
  const fromSet = new Set(fromFiles);
  for (const path of toFiles) {
    if (!fromSet.has(path)) await rm(resolve(toRoot, path), { force: true });
  }
  for (const path of fromFiles) {
    const source = resolve(fromRoot, path);
    const target = resolve(toRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}

async function writeCanonicalChecksums(files: string[]) {
  const lines: string[] = [];
  for (const path of files) {
    const digest = createHash("sha256")
      .update(await readFile(resolve(sourceRoot, path)))
      .digest("hex");
    lines.push(`${digest}  ${path}`);
  }
  await writeFile(resolve(sourceRoot, "SHA256SUMS"), `${lines.join("\n")}\n`, "utf8");
}

const sourceFiles = await filesUnder(sourceRoot);
const targetFiles = existsSync(targetRoot) ? await filesUnder(targetRoot) : [];

if (publish) {
  if (!existsSync(targetRoot)) {
    console.error(`Gapwise campus mirror was not found at ${targetRoot}.`);
    process.exit(2);
  }
  // Validate and read the required public snapshot before mutating the canonical tree.
  if (!existsSync(targetSnapshot)) {
    console.error(`Gapwise public snapshot was not found at ${targetSnapshot}.`);
    process.exit(2);
  }
  const snapshotBytes = await readFile(targetSnapshot);
  await mirror(targetRoot, sourceRoot, targetFiles, sourceFiles);
  const publishedFiles = await filesUnder(sourceRoot);
  await writeCanonicalChecksums(publishedFiles);

  await mkdir(dirname(sourceSnapshot), { recursive: true });
  await writeFile(sourceSnapshot, snapshotBytes);

  console.log(
    `Published ${publishedFiles.length} campus data files to ${sourceRoot} and refreshed checksums.`,
  );
  process.exit(0);
}

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

if (!existsSync(sourceSnapshot)) {
  differences.push("canonical public snapshot is missing");
} else if (!existsSync(targetSnapshot)) {
  differences.push("public snapshot is missing in gapwise");
} else {
  const [sourceSnapshotBytes, targetSnapshotBytes] = await Promise.all([
    readFile(sourceSnapshot),
    readFile(targetSnapshot),
  ]);
  if (!sourceSnapshotBytes.equals(targetSnapshotBytes)) {
    differences.push("content differs: public/data/utm-campus-v1.json");
  }
}

if (checkOnly) {
  if (differences.length > 0) {
    console.error("Campus data mirror differs from Gapwise-for-UTM/data:");
    for (const difference of differences) console.error(`- ${difference}`);
    process.exit(1);
  }
  console.log(`Campus data mirror is in sync (${sourceFiles.length} files).`);
  process.exit(0);
}

if (!existsSync(sourceSnapshot)) {
  console.error(`Canonical public snapshot was not found at ${sourceSnapshot}.`);
  process.exit(2);
}
const snapshotBytes = await readFile(sourceSnapshot);
await mirror(sourceRoot, targetRoot, sourceFiles, targetFiles);
await mkdir(dirname(targetSnapshot), { recursive: true });
await writeFile(targetSnapshot, snapshotBytes);
console.log(
  `Synced ${sourceFiles.length} canonical campus data files and public/data/utm-campus-v1.json.`,
);

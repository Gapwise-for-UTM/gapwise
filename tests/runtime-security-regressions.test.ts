import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const SERVER_RUNTIME_ROOTS = ["api", "src/server", "supabase/functions"] as const;
const APP_SOURCE_ROOTS = ["api", "src", "supabase/functions"] as const;

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (entry.isFile() && /\.(?:ts|tsx|js|jsx)$/u.test(entry.name)) files.push(path);
  }
  return files;
}

async function readSources(roots: readonly string[]) {
  const paths = (await Promise.all(roots.map(sourceFiles))).flat();
  return Promise.all(paths.map(async (path) => ({ path, source: await readFile(path, "utf8") })));
}

function expectNoMatch(
  files: Array<{ path: string; source: string }>,
  pattern: RegExp,
  description: string,
) {
  const offenders = files.filter(({ source }) => pattern.test(source)).map(({ path }) => path);
  expect(offenders, `${description}: ${offenders.join(", ")}`).toEqual([]);
}

describe("runtime security regressions", () => {
  test("server runtimes cannot gain shell or dynamic-code execution primitives silently", async () => {
    const files = await readSources(SERVER_RUNTIME_ROOTS);
    const forbidden: Array<[RegExp, string]> = [
      [/from\s+["'](?:node:)?child_process["']/u, "child_process import"],
      [/require\(\s*["'](?:node:)?child_process["']\s*\)/u, "child_process require"],
      [/\bBun\.(?:spawn|spawnSync)\b/u, "Bun process spawning"],
      [/\bDeno\.Command\b/u, "Deno process spawning"],
      [/from\s+["']node:vm["']/u, "Node VM dynamic execution"],
      [/\beval\s*\(/u, "eval"],
      [/\bnew\s+Function\s*\(/u, "Function constructor"],
    ];

    for (const [pattern, description] of forbidden) {
      expectNoMatch(files, pattern, description);
    }
  });

  test("server request bodies stay on bounded validation paths", async () => {
    const files = await readSources(SERVER_RUNTIME_ROOTS);
    expectNoMatch(files, /\brequest\.json\s*\(/u, "direct Request.json() body parsing");
  });

  test("application source has no raw React HTML injection sink", async () => {
    const files = await readSources(APP_SOURCE_ROOTS);
    expectNoMatch(files, /\bdangerouslySetInnerHTML\b/u, "dangerouslySetInnerHTML");
  });

  test("Vercel/server code cannot consume browser-exposed privileged credentials", async () => {
    const files = await readSources(["api", "src/server"]);
    expectNoMatch(files, /VITE_SUPABASE_SERVICE_ROLE_KEY/u, "browser-exposed Supabase service role");
    expectNoMatch(files, /VITE_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|KEK)/u, "browser-exposed privileged secret");
  });
});

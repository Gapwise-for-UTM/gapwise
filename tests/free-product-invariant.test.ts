import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ACTIVE_ROOTS = ["src", "api", "e2e"] as const;
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);
const RETIRED_PATTERNS = [
  /Gapwise Pro/u,
  /Gapwise Free/u,
  /Plan & billing/u,
  /features\/entitlements/u,
  /STRIPE_(?:SECRET|WEBHOOK|PRICE)/u,
  /VITE_STRIPE/u,
  /\bCanvas\b/u,
  /\bQuercus\b/u,
  /\bLTI\b/u,
] as const;

function extension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function activeTextFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...activeTextFiles(path));
    else if (TEXT_EXTENSIONS.has(extension(path))) files.push(path);
  }
  return files;
}

describe("fully free product invariant", () => {
  test("active application surfaces do not reintroduce retired paid-plan or institutional copy", () => {
    const findings: string[] = [];
    for (const root of ACTIVE_ROOTS) {
      for (const file of activeTextFiles(root)) {
        const source = readFileSync(file, "utf8");
        for (const pattern of RETIRED_PATTERNS) {
          if (pattern.test(source)) findings.push(`${file}: ${pattern.source}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });

  test("browser environment example does not require retired billing configuration", () => {
    const envExample = readFileSync(".env.example", "utf8");
    expect(envExample).not.toMatch(/STRIPE_/u);
    expect(envExample).not.toMatch(/VITE_STRIPE/u);
  });
});

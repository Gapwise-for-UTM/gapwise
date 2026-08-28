import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

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
  if (offenders.length) throw new Error(`${description}: ${offenders.join(", ")}`);
  expect(offenders).toEqual([]);
}

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (path.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function functionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function isRequestType(type: ts.TypeNode | undefined, file: ts.SourceFile): boolean {
  return type ? /\b(?:globalThis\.)?Request\b/u.test(type.getText(file)) : false;
}

function directRequestJsonCalls(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind(path));
  const offenders: string[] = [];

  function visit(node: ts.Node, inheritedAliases: Set<string>): void {
    const aliases = functionLike(node) ? new Set(inheritedAliases) : inheritedAliases;

    if (functionLike(node)) {
      for (const parameter of node.parameters) {
        if (ts.isIdentifier(parameter.name) && isRequestType(parameter.type, file)) {
          aliases.add(parameter.name.text);
        }
      }
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const aliasesRequest =
        isRequestType(node.type, file) ||
        (node.initializer !== undefined &&
          ts.isIdentifier(node.initializer) &&
          aliases.has(node.initializer.text));
      if (aliasesRequest) aliases.add(node.name.text);
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "json" &&
      ts.isIdentifier(node.expression.expression) &&
      aliases.has(node.expression.expression.text)
    ) {
      const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file));
      offenders.push(`${path}:${line + 1}:${character + 1}`);
    }

    ts.forEachChild(node, (child) => visit(child, aliases));
  }

  visit(file, new Set());
  return offenders;
}

describe("runtime security regressions", () => {
  test("server runtimes cannot gain shell or dynamic-code execution primitives silently", async () => {
    const files = await readSources(SERVER_RUNTIME_ROOTS);
    const forbidden: Array<[RegExp, string]> = [
      [/from\s+["'](?:node:)?child_process["']/u, "child_process import"],
      [/\bimport\s*["'](?:node:)?child_process["']/u, "child_process side-effect import"],
      [/require\(\s*["'](?:node:)?child_process["']\s*\)/u, "child_process require"],
      [/\bimport\s*\(\s*["'](?:node:)?child_process["']\s*\)/u, "child_process dynamic import"],
      [/\bBun\.(?:spawn|spawnSync)\b/u, "Bun process spawning"],
      [/\bDeno\.Command\b/u, "Deno process spawning"],
      [/from\s+["'](?:node:)?vm["']/u, "Node VM import"],
      [/\bimport\s*["'](?:node:)?vm["']/u, "Node VM side-effect import"],
      [/require\(\s*["'](?:node:)?vm["']\s*\)/u, "Node VM require"],
      [/\bimport\s*\(\s*["'](?:node:)?vm["']\s*\)/u, "Node VM dynamic import"],
      [/\beval\s*\(/u, "eval"],
      [/\bnew\s+Function\s*\(/u, "Function constructor"],
    ];

    for (const [pattern, description] of forbidden) {
      expectNoMatch(files, pattern, description);
    }
  });

  test("server request bodies stay on bounded validation paths", async () => {
    const files = await readSources(SERVER_RUNTIME_ROOTS);
    const offenders = files.flatMap(({ path, source }) => directRequestJsonCalls(path, source));
    if (offenders.length) {
      throw new Error(`direct Request.json() body parsing: ${offenders.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  test("request body guard follows typed Request aliases", () => {
    const source = `
      async function handler(req: Request) {
        const alias = req;
        await alias.json();
      }
    `;
    expect(directRequestJsonCalls("synthetic.ts", source)).toHaveLength(1);
  });

  test("application source has no raw React HTML injection sink", async () => {
    const files = await readSources(APP_SOURCE_ROOTS);
    expectNoMatch(files, /\bdangerouslySetInnerHTML\b/u, "dangerouslySetInnerHTML");
  });

  test("Vercel/server code cannot consume browser-exposed privileged credentials", async () => {
    const files = await readSources(["api", "src/server"]);
    expectNoMatch(
      files,
      /VITE_SUPABASE_SERVICE_ROLE_KEY/u,
      "browser-exposed Supabase service role",
    );
    expectNoMatch(
      files,
      /VITE_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|KEK)/u,
      "browser-exposed privileged secret",
    );
  });
});

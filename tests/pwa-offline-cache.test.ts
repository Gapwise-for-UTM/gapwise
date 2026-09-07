import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";

describe("PWA offline cache policy", () => {
  test("has no obsolete model runtime cache", async () => {
    const source = await readFile("vite.config.ts", "utf8");
    expect(source).not.toContain("models-assets");
    expect(source).not.toContain("/models/");
    expect(source).not.toContain(".glb");
  });

  test("does not start retaining third-party map tiles", async () => {
    const source = await readFile("vite.config.ts", "utf8");
    expect(source).toContain('cacheName: "openfreemap-tiles"');
    expect(source).toContain('handler: "NetworkOnly"');
  });
});

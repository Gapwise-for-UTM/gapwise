import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";

describe("PWA offline cache policy", () => {
  test("keeps optional model assets usable offline while refreshing them after reconnect", async () => {
    const source = await readFile("vite.config.ts", "utf8");
    expect(source).toContain('handler: "StaleWhileRevalidate"');
    expect(source).toContain('cacheName: "models-assets"');
    expect(source).toContain("cacheableResponse: { statuses: [0, 200] }");
  });

  test("bounds the runtime model cache instead of allowing unbounded growth", async () => {
    const source = await readFile("vite.config.ts", "utf8");
    expect(source).toContain("expiration: { maxEntries: 6 }");
  });

  test("does not start retaining third-party map tiles", async () => {
    const source = await readFile("vite.config.ts", "utf8");
    expect(source).toContain('cacheName: "openfreemap-tiles"');
    expect(source).toContain('handler: "NetworkOnly"');
  });
});

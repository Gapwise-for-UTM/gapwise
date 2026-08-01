import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const icons = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
] as const;

describe("generated brand icons", () => {
  test("generates valid, byte-identical PNGs without modifying checked-in assets", async () => {
    const firstDirectory = await mkdtemp(join(tmpdir(), "gapwise-icons-first-"));
    const secondDirectory = await mkdtemp(join(tmpdir(), "gapwise-icons-second-"));
    try {
      await $`bun scripts/generate-icons.ts --output-dir=${firstDirectory}`.quiet();
      await $`bun scripts/generate-icons.ts --output-dir=${secondDirectory}`.quiet();
      for (const [name, size] of icons) {
        const first = new Uint8Array(await readFile(join(firstDirectory, name)));
        const second = new Uint8Array(await readFile(join(secondDirectory, name)));
        expect(Buffer.from(first.slice(0, 8)).toString("hex")).toBe("89504e470d0a1a0a");
        expect(new DataView(first.buffer, first.byteOffset).getUint32(16)).toBe(size);
        expect(new DataView(first.buffer, first.byteOffset).getUint32(20)).toBe(size);
        expect(first.length).toBeGreaterThan(100);
        expect(first).toEqual(second);
      }
    } finally {
      await Promise.all([
        rm(firstDirectory, { recursive: true, force: true }),
        rm(secondDirectory, { recursive: true, force: true }),
      ]);
    }
  });
});

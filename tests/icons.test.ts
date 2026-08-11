import { $ } from "bun";
import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const icons = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
] as const;

type DecodedPng = {
  width: number;
  height: number;
  pixels: Uint8Array;
};

function decodeGeneratedPng(data: Uint8Array, label: string): DecodedPng {
  assert.equal(
    Buffer.from(data.subarray(0, 8)).toString("hex"),
    "89504e470d0a1a0a",
    `${label} has a PNG signature`,
  );

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const imageChunks: Uint8Array[] = [];

  let offset = 8;
  let width = 0;
  let height = 0;

  while (offset < data.length) {
    const length = view.getUint32(offset);
    const type = Buffer.from(data.subarray(offset + 4, offset + 8)).toString("ascii");
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + length;
    const chunk = data.subarray(chunkStart, chunkEnd);

    if (type === "IHDR") {
      const header = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

      width = header.getUint32(0);
      height = header.getUint32(4);

      assert.equal(chunk[8], 8, `${label} uses 8-bit channels`);
      assert.equal(chunk[9], 6, `${label} uses RGBA pixels`);
    }

    if (type === "IDAT") {
      imageChunks.push(chunk);
    }

    offset = chunkEnd + 4;

    if (type === "IEND") {
      break;
    }
  }

  assert.ok(width > 0 && height > 0, `${label} has dimensions`);
  assert.ok(imageChunks.length > 0, `${label} has image data`);

  const inflated = inflateSync(Buffer.concat(imageChunks.map((chunk) => Buffer.from(chunk))));

  const stride = width * 4;
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const sourceOffset = y * (stride + 1);

    assert.equal(inflated[sourceOffset], 0, `${label} row ${y} uses the expected PNG filter`);

    pixels.set(inflated.subarray(sourceOffset + 1, sourceOffset + 1 + stride), y * stride);
  }

  return { width, height, pixels };
}

function hasPixel(
  pixels: Uint8Array,
  predicate: (red: number, green: number, blue: number, alpha: number) => boolean,
) {
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (predicate(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!, pixels[offset + 3]!)) {
      return true;
    }
  }

  return false;
}

function assertCanonicalMark(name: string, expectedSize: number, image: DecodedPng) {
  assert.equal(image.width, expectedSize, `${name} width`);
  assert.equal(image.height, expectedSize, `${name} height`);

  assert.deepEqual(
    Array.from(image.pixels.subarray(0, 4)),
    [0, 0, 0, 0],
    `${name} has a transparent outer corner`,
  );

  assert.ok(
    hasPixel(
      image.pixels,
      (red, green, blue, alpha) =>
        alpha >= 128 &&
        red >= 20 &&
        red <= 45 &&
        green >= 40 &&
        green <= 80 &&
        blue >= 75 &&
        blue <= 120,
    ),
    `${name} contains the navy G`,
  );

  assert.ok(
    hasPixel(
      image.pixels,
      (red, green, blue, alpha) => alpha >= 96 && red >= 50 && green >= 90 && blue >= 140,
    ),
    `${name} contains the blue route details`,
  );

  assert.ok(
    hasPixel(image.pixels, (_red, _green, _blue, alpha) => alpha === 0),
    `${name} preserves transparency`,
  );
}

describe("generated brand icons", () => {
  test("matches logo-mark-derived committed assets deterministically", async () => {
    const firstDirectory = await mkdtemp(join(tmpdir(), "gapwise-icons-first-"));
    const secondDirectory = await mkdtemp(join(tmpdir(), "gapwise-icons-second-"));

    try {
      await $`bun scripts/generate-icons.ts --output-dir=${firstDirectory}`.quiet();
      await $`bun scripts/generate-icons.ts --output-dir=${secondDirectory}`.quiet();

      for (const [name, size] of icons) {
        const [committed, first, second] = await Promise.all([
          readFile(join("public", name)),
          readFile(join(firstDirectory, name)),
          readFile(join(secondDirectory, name)),
        ]);

        assert.equal(
          Buffer.compare(committed, first),
          0,
          `${name} matches the canonical generator`,
        );

        assert.equal(Buffer.compare(first, second), 0, `${name} generation is deterministic`);

        assertCanonicalMark(name, size, decodeGeneratedPng(committed, `public/${name}`));
      }
    } finally {
      await Promise.all([
        rm(firstDirectory, { recursive: true, force: true }),
        rm(secondDirectory, { recursive: true, force: true }),
      ]);
    }
  }, 10_000);
});

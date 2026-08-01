import { $ } from "bun";
import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const pngSignature = "89504e470d0a1a0a";
const icons = [
  ["favicon-16x16.png", 16, "favicon"],
  ["favicon-32x32.png", 32, "favicon"],
  ["apple-touch-icon.png", 180, "app"],
  ["icon-192.png", 192, "app"],
  ["icon-512.png", 512, "app"],
] as const;

type DecodedPng = {
  width: number;
  height: number;
  pixels: Uint8Array;
};

const crcTable = new Uint32Array(256).map((_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left: number, above: number, upperLeft: number) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodeRgbaPng(data: Uint8Array, label: string): DecodedPng {
  assert.equal(
    Buffer.from(data.subarray(0, 8)).toString("hex"),
    pngSignature,
    `${label} signature`,
  );

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const idatChunks: Uint8Array[] = [];
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawEnd = false;

  while (!sawEnd) {
    assert.ok(offset + 12 <= data.length, `${label} has a complete PNG chunk`);
    const length = view.getUint32(offset);
    const typeStart = offset + 4;
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + length;
    assert.ok(chunkEnd + 4 <= data.length, `${label} chunk is not truncated`);

    const type = Buffer.from(data.subarray(typeStart, chunkStart)).toString("ascii");
    const chunkData = data.subarray(chunkStart, chunkEnd);
    assert.equal(
      crc32(data.subarray(typeStart, chunkEnd)),
      view.getUint32(chunkEnd),
      `${label} ${type} CRC`,
    );

    if (type === "IHDR") {
      assert.equal(offset, 8, `${label} begins with IHDR`);
      assert.equal(sawHeader, false, `${label} has one IHDR`);
      assert.equal(length, 13, `${label} has a valid IHDR length`);
      const header = new DataView(chunkData.buffer, chunkData.byteOffset, chunkData.byteLength);
      width = header.getUint32(0);
      height = header.getUint32(4);
      assert.equal(chunkData[8], 8, `${label} uses 8-bit channels`);
      assert.equal(chunkData[9], 6, `${label} uses RGBA pixels`);
      assert.equal(chunkData[10], 0, `${label} uses standard PNG compression`);
      assert.equal(chunkData[11], 0, `${label} uses standard PNG filtering`);
      assert.equal(chunkData[12], 0, `${label} is not interlaced`);
      sawHeader = true;
    } else if (type === "IDAT") {
      assert.ok(sawHeader, `${label} has IHDR before IDAT`);
      idatChunks.push(chunkData);
    } else if (type === "IEND") {
      assert.equal(length, 0, `${label} has a valid IEND`);
      sawEnd = true;
    }

    offset = chunkEnd + 4;
  }

  assert.ok(sawHeader, `${label} has IHDR`);
  assert.ok(idatChunks.length > 0, `${label} has image data`);
  assert.equal(offset, data.length, `${label} has no trailing bytes`);

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const filtered = inflateSync(Buffer.concat(idatChunks.map((chunk) => Buffer.from(chunk))));
  assert.equal(filtered.length, height * (stride + 1), `${label} has complete RGBA scanlines`);

  const pixels = new Uint8Array(width * height * bytesPerPixel);
  let filteredOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = filtered[filteredOffset++]!;
    assert.ok(filter <= 4, `${label} uses a supported PNG filter`);
    const rowOffset = y * stride;
    const previousRowOffset = rowOffset - stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel]! : 0;
      const above = y > 0 ? pixels[previousRowOffset + x]! : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel ? pixels[previousRowOffset + x - bytesPerPixel]! : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : paeth(left, above, upperLeft);
      pixels[rowOffset + x] = (filtered[filteredOffset++]! + predictor) & 255;
    }
  }

  return { width, height, pixels };
}

function hasPixel(
  pixels: Uint8Array,
  predicate: (red: number, green: number, blue: number, alpha: number) => boolean,
) {
  for (let offset = 0; offset < pixels.length; offset += 4)
    if (predicate(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!, pixels[offset + 3]!))
      return true;
  return false;
}

function assertIconConditions(
  name: string,
  kind: "app" | "favicon",
  expectedSize: number,
  image: DecodedPng,
) {
  assert.equal(image.width, expectedSize, `${name} width`);
  assert.equal(image.height, expectedSize, `${name} height`);
  assert.ok(
    hasPixel(
      image.pixels,
      (red, green, blue, alpha) => red === 32 && green === 59 && blue === 98 && alpha === 255,
    ),
    `${name} contains the navy background`,
  );
  assert.ok(
    hasPixel(
      image.pixels,
      (red, green, blue, alpha) => red === 247 && green === 244 && blue === 235 && alpha === 255,
    ),
    `${name} contains a readable warm off-white G`,
  );
  assert.ok(
    hasPixel(
      image.pixels,
      (red, green, blue, alpha) =>
        alpha === 255 && red >= 80 && red <= 150 && green >= 130 && blue >= 180,
    ),
    `${name} contains a visible blue route stop`,
  );

  if (kind === "app") {
    assert.ok(
      !hasPixel(image.pixels, (_red, _green, _blue, alpha) => alpha !== 255),
      `${name} has an opaque app-icon background`,
    );
    assert.deepEqual(
      Array.from(image.pixels.subarray(0, 4)),
      [247, 244, 235, 255],
      `${name} uses the warm off-white outer background`,
    );
  } else {
    assert.deepEqual(
      Array.from(image.pixels.subarray(0, 4)),
      [0, 0, 0, 0],
      `${name} preserves transparent favicon corners`,
    );
  }
}

function assertSamePixels(
  expected: DecodedPng,
  actual: DecodedPng,
  expectedLabel: string,
  actualLabel: string,
) {
  assert.equal(actual.width, expected.width, `${actualLabel} width matches ${expectedLabel}`);
  assert.equal(actual.height, expected.height, `${actualLabel} height matches ${expectedLabel}`);
  assert.equal(
    actual.pixels.length,
    expected.pixels.length,
    `${actualLabel} RGBA length matches ${expectedLabel}`,
  );
  for (let offset = 0; offset < expected.pixels.length; offset += 4) {
    if (
      expected.pixels[offset] !== actual.pixels[offset] ||
      expected.pixels[offset + 1] !== actual.pixels[offset + 1] ||
      expected.pixels[offset + 2] !== actual.pixels[offset + 2] ||
      expected.pixels[offset + 3] !== actual.pixels[offset + 3]
    ) {
      const pixel = offset / 4;
      const x = pixel % expected.width;
      const y = Math.floor(pixel / expected.width);
      assert.fail(
        `${actualLabel} differs from ${expectedLabel} at (${x}, ${y}): ` +
          `${Array.from(actual.pixels.subarray(offset, offset + 4)).join(",")} !== ` +
          Array.from(expected.pixels.subarray(offset, offset + 4)).join(","),
      );
    }
  }
}

describe("generated brand icons", () => {
  test("matches committed RGBA pixels and is deterministic within one environment", async () => {
    const committedDirectory = await mkdtemp(join(tmpdir(), "gapwise-icons-committed-"));
    const firstDirectory = await mkdtemp(join(tmpdir(), "gapwise-icons-first-"));
    const secondDirectory = await mkdtemp(join(tmpdir(), "gapwise-icons-second-"));
    try {
      await Promise.all(
        icons.map(([name]) => copyFile(join("public", name), join(committedDirectory, name))),
      );
      await $`bun scripts/generate-icons.ts --output-dir=${firstDirectory}`.quiet();
      await $`bun scripts/generate-icons.ts --output-dir=${secondDirectory}`.quiet();

      for (const [name, size, kind] of icons) {
        const [committed, first, second] = await Promise.all(
          [committedDirectory, firstDirectory, secondDirectory].map(async (directory) =>
            decodeRgbaPng(
              new Uint8Array(await readFile(join(directory, name))),
              `${directory}/${name}`,
            ),
          ),
        );

        assertIconConditions(name, kind, size, committed);
        assertIconConditions(name, kind, size, first);
        assertIconConditions(name, kind, size, second);
        assertSamePixels(committed, first, `committed ${name}`, `first generated ${name}`);
        assertSamePixels(first, second, `first generated ${name}`, `second generated ${name}`);
      }
    } finally {
      await Promise.all(
        [committedDirectory, firstDirectory, secondDirectory].map((directory) =>
          rm(directory, { recursive: true, force: true }),
        ),
      );
    }
  });
});

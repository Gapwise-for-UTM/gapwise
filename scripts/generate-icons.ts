import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

type Rgba = [number, number, number, number];

const logo = await readFile(new URL("../public/logo-mark.svg", import.meta.url), "utf8");

for (const token of ['stroke="#203b62"', 'stroke="#67a9e4"', 'fill="#67a9e4"']) {
  if (!logo.includes(token)) {
    throw new Error(`logo-mark.svg is missing expected token: ${token}`);
  }
}

const outputArgument = process.argv.find((argument) => argument.startsWith("--output-dir="));

const outputDirectory = outputArgument
  ? resolve(outputArgument.slice("--output-dir=".length))
  : fileURLToPath(new URL("../public/", import.meta.url));

await mkdir(outputDirectory, { recursive: true });

const crcTable = new Uint32Array(256).map((_, value) => {
  let crc = value;

  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const name = Buffer.from(type);
  const output = Buffer.alloc(data.length + 12);

  output.writeUInt32BE(data.length);
  name.copy(output, 4);
  Buffer.from(data).copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, Buffer.from(data)])), data.length + 8);

  return output;
}

function distanceToSegment(
  x: number,
  y: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(x - startX, y - startY);
  }

  const projection = ((x - startX) * dx + (y - startY) * dy) / lengthSquared;
  const position = Math.max(0, Math.min(1, projection));
  const nearestX = startX + position * dx;
  const nearestY = startY + position * dy;

  return Math.hypot(x - nearestX, y - nearestY);
}

function pixel(x: number, y: number): Rgba {
  const transparent: Rgba = [0, 0, 0, 0];
  const navy: Rgba = [32, 59, 98, 255];
  const blue: Rgba = [103, 169, 228, 255];

  let color = transparent;

  const circleDistance = Math.hypot(x - 32, y - 32);
  const angle = Math.atan2(y - 32, x - 32);

  const navyArc = Math.abs(circleDistance - 20) <= 2.75 && (angle <= -0.82 || angle >= 0.82);

  const navyVertical = distanceToSegment(x, y, 45, 46.5, 45, 33) <= 2.75;

  const navyHorizontal = distanceToSegment(x, y, 45, 33, 34, 33) <= 2.75;

  if (navyArc || navyVertical || navyHorizontal) {
    color = navy;
  }

  const upperBlueLine = distanceToSegment(x, y, 45, 17.5, 45, 25) <= 1.25;

  const lowerBlueLine = distanceToSegment(x, y, 45, 39, 45, 46.5) <= 1.25;

  const upperStop = Math.hypot(x - 45, y - 17.5) <= 3;
  const lowerStop = Math.hypot(x - 45, y - 46.5) <= 3;

  if (upperBlueLine || lowerBlueLine || upperStop || lowerStop) {
    color = blue;
  }

  return color;
}

async function render(name: string, size: number) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  const samples = size <= 32 ? 6 : 3;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (stride + 1);
    raw[rowOffset] = 0;

    for (let x = 0; x < size; x++) {
      const sums = [0, 0, 0, 0];

      for (let sampleY = 0; sampleY < samples; sampleY++) {
        for (let sampleX = 0; sampleX < samples; sampleX++) {
          const sample = pixel(
            ((x + (sampleX + 0.5) / samples) * 64) / size,
            ((y + (sampleY + 0.5) / samples) * 64) / size,
          );

          for (let channel = 0; channel < 4; channel++) {
            sums[channel]! += sample[channel]!;
          }
        }
      }

      const pixelOffset = rowOffset + 1 + x * 4;
      const divisor = samples * samples;

      for (let channel = 0; channel < 4; channel++) {
        raw[pixelOffset + channel] = Math.round(sums[channel]! / divisor);
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);

  await writeFile(
    resolve(outputDirectory, name),
    Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", new Uint8Array()),
    ]),
  );
}

await Promise.all([
  render("favicon-16x16.png", 16),
  render("favicon-32x32.png", 32),
  render("apple-touch-icon.png", 180),
  render("icon-192.png", 192),
  render("icon-512.png", 512),
]);

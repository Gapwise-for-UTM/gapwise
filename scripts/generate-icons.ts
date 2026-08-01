import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

// These deliberately simple canonical SVGs use only paths, circles and rounded
// rectangles. The deterministic renderer below evaluates that fixed geometry at
// sub-pixel samples and emits stable RGBA PNGs without browser screenshots.
for (const source of ["favicon.svg", "app-icon.svg"]) {
  const svg = await readFile(new URL(`../public/${source}`, import.meta.url), "utf8");
  for (const token of ['fill="#203b62"', 'stroke="#f7f4eb"', 'fill="#67a9e4"'])
    if (!svg.includes(token)) throw new Error(`${source} geometry changed; update the rasterizer.`);
}

const outputArgument = process.argv.find((argument) => argument.startsWith("--output-dir="));
const outputDirectory = outputArgument
  ? resolve(outputArgument.slice("--output-dir=".length))
  : new URL("../public/", import.meta.url).pathname;
await mkdir(outputDirectory, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type: string, data: Uint8Array) {
  const name = Buffer.from(type),
    out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  name.copy(out, 4);
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return out;
}
function roundedRect(x: number, y: number, inset: number, radius: number) {
  const qx = Math.max(inset + radius - x, 0, x - (64 - inset - radius));
  const qy = Math.max(inset + radius - y, 0, y - (64 - inset - radius));
  return (
    x >= inset &&
    x <= 64 - inset &&
    y >= inset &&
    y <= 64 - inset &&
    qx * qx + qy * qy <= radius * radius
  );
}
function pixel(x: number, y: number, app: boolean): [number, number, number, number] {
  const cream: [number, number, number, number] = [247, 244, 235, 255];
  let color: [number, number, number, number] = app ? cream : [0, 0, 0, 0];
  const inset = app ? 5 : 0;
  if (roundedRect(x, y, inset, app ? 13 : 14)) color = [32, 59, 98, 255];
  const cx = app ? 31 : 32,
    cy = 32,
    radius = app ? 19 : 20;
  const angle = Math.atan2(y - cy, x - cx),
    distance = Math.hypot(x - cx, y - cy);
  const arc = Math.abs(distance - radius) <= 2.75 && (angle >= 0.82 || angle <= -0.82);
  const endpointX = app ? 44 : 45,
    top = app ? 18.5 : 17.5,
    bottom = app ? 45.5 : 46.5;
  const bar = y >= 30.25 && y <= 35.75 && x >= 34 && x <= endpointX + 2.75;
  const stem = x >= endpointX - 2.75 && x <= endpointX + 2.75 && y >= 33 && y <= bottom;
  if (arc || bar || stem) color = cream;
  if (Math.hypot(x - endpointX, y - top) <= 3 || Math.hypot(x - endpointX, y - bottom) <= 3)
    color = [103, 169, 228, 255];
  return color;
}
async function render(name: string, size: number, app: boolean) {
  const raw = Buffer.alloc((size * 4 + 1) * size),
    samples = size <= 32 ? 6 : 3;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < samples; sy++)
        for (let sx = 0; sx < samples; sx++)
          pixel(
            ((x + (sx + 0.5) / samples) * 64) / size,
            ((y + (sy + 0.5) / samples) * 64) / size,
            app,
          ).forEach((value, i) => (sums[i]! += value));
      const row = y * (size * 4 + 1);
      raw[row] = 0;
      sums.forEach(
        (value, i) => (raw[row + 1 + x * 4 + i] = Math.round(value / (samples * samples))),
      );
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  await writeFile(
    resolve(outputDirectory, name),
    Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", new Uint8Array()),
    ]),
  );
}
await Promise.all([
  render("favicon-16x16.png", 16, false),
  render("favicon-32x32.png", 32, false),
  render("apple-touch-icon.png", 180, true),
  render("icon-192.png", 192, true),
  render("icon-512.png", 512, true),
]);

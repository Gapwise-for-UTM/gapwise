import { readFile, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

// The SVG is canonical. This deliberately tiny renderer reproduces its fixed geometric
// primitives without adding a native image dependency to the application toolchain.
const svg = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");
for (const token of ['fill="#203b62"', 'stroke="#f7f4eb"', 'fill="#67a9e4"']) {
  if (!svg.includes(token))
    throw new Error(`Canonical logo changed (${token}); update this renderer.`);
}
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  name.copy(out, 4);
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return out;
}
function insideRoundRect(x: number, y: number) {
  const qx = Math.max(4 - x, 0, x - 60),
    qy = Math.max(4 - y, 0, y - 60);
  return qx * qx + qy * qy <= 14 * 14;
}
function rgbaAt(x: number, y: number): [number, number, number, number] {
  if (!insideRoundRect(x, y)) return [0, 0, 0, 0];
  let color: [number, number, number, number] = [32, 59, 98, 255];
  const angle = Math.atan2(y - 32, x - 32),
    radius = Math.hypot(x - 32, y - 32);
  const onArc = Math.abs(radius - 18) <= 3.5 && angle >= Math.PI / 3 && angle <= (Math.PI * 5) / 3;
  const onStem = x >= 40.5 && x <= 47.5 && y >= 33 && y <= 44;
  const onBar = y >= 29.5 && y <= 36.5 && x >= 32 && x <= 44;
  if (onArc || onStem || onBar) color = [247, 244, 235, 255];
  if (Math.hypot(x - 44, y - 20) <= 4 || Math.hypot(x - 44, y - 44) <= 4)
    color = [103, 169, 228, 255];
  return color;
}
async function render(name: string, size: number) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const samples = size < 64 ? 4 : 2;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < samples; sy++)
        for (let sx = 0; sx < samples; sx++) {
          const c = rgbaAt(
            ((x + (sx + 0.5) / samples) * 64) / size,
            ((y + (sy + 0.5) / samples) * 64) / size,
          );
          c.forEach((v, i) => (sums[i]! += v));
        }
      const offset = row + 1 + x * 4,
        divisor = samples * samples;
      sums.forEach((v, i) => (raw[offset + i] = Math.round(v / divisor)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const png = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ]);
  await writeFile(new URL(`../public/${name}`, import.meta.url), png);
}
await Promise.all(
  [
    ["favicon-16x16.png", 16],
    ["favicon-32x32.png", 32],
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ].map(([name, size]) => render(name as string, size as number)),
);

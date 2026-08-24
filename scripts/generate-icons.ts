import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

type Rgba = [number, number, number, number];
type Point = [number, number];

const logo = await readFile(new URL("../public/logo-mark.svg", import.meta.url), "utf8");

for (const token of ['fill="#4EA7FE"', 'transform="translate(1254 0) scale(-1 1)"']) {
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

const LOGO_SCALE = 64 / 1254;
const point = (x: number, y: number): Point => [x * LOGO_SCALE, y * LOGO_SCALE];

function addCubic(
  target: Point[],
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  steps = 14,
) {
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const u = 1 - t;
    target.push([
      (u ** 3 * start[0] +
        3 * u ** 2 * t * control1[0] +
        3 * u * t ** 2 * control2[0] +
        t ** 3 * end[0]) *
        LOGO_SCALE,
      (u ** 3 * start[1] +
        3 * u ** 2 * t * control1[1] +
        3 * u * t ** 2 * control2[1] +
        t ** 3 * end[1]) *
        LOGO_SCALE,
    ]);
  }
}

function upperLeftPath() {
  const points: Point[] = [point(627, 638), point(540, 534)];
  let start: Point = [540, 534];
  let end: Point = [465, 485];
  addCubic(points, start, [519, 515], [493, 502], end);
  start = end;
  end = [397, 353];
  addCubic(points, start, [418, 456], [397, 408], end);
  points.push(point(428, 353));
  start = [428, 353];
  end = [462, 440];
  addCubic(points, start, [430, 385], [441, 416], end);
  start = end;
  end = [482, 458];
  addCubic(points, start, [468, 446], [474, 452], end);
  start = end;
  end = [481, 419];
  addCubic(points, start, [479, 444], [479, 431], end);
  start = end;
  end = [493, 386];
  addCubic(points, start, [483, 406], [487, 395], end);
  points.push(point(518, 399));
  start = [518, 399];
  end = [510, 441];
  addCubic(points, start, [511, 414], [508, 429], end);
  start = end;
  end = [525, 478];
  addCubic(points, start, [511, 458], [517, 470], end);
  start = end;
  end = [544, 493];
  addCubic(points, start, [532, 486], [538, 490], end);
  points.push(point(627, 530));
  return points;
}

function lowerLeftPath() {
  const points: Point[] = [point(627, 692), point(522, 558)];
  let start: Point = [522, 558];
  let end: Point = [463, 519];
  addCubic(points, start, [504, 539], [482, 525], end);
  start = end;
  end = [415, 518];
  addCubic(points, start, [448, 518], [432, 518], end);
  start = end;
  end = [451, 594];
  addCubic(points, start, [415, 548], [426, 574], end);
  start = end;
  end = [525, 610];
  addCubic(points, start, [468, 606], [486, 610], end);
  points.push(point(525, 730));
  start = [525, 730];
  end = [533, 750];
  addCubic(points, start, [525, 738], [528, 744], end);
  points.push(point(605, 850));
  start = [605, 850];
  end = [627, 860];
  addCubic(points, start, [610, 857], [617, 860], end);
  return points;
}

function mirror(points: Point[]): Point[] {
  return points.map(([x, y]) => [64 - x, y]);
}

const upperLeft = upperLeftPath();
const lowerLeft = lowerLeftPath();
const deerPolygons = [upperLeft, mirror(upperLeft), lowerLeft, mirror(lowerLeft)];

function pointInPolygon(x: number, y: number, polygon: Point[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [currentX, currentY] = polygon[index]!;
    const [previousX, previousY] = polygon[previous]!;
    const intersects =
      currentY > y !== previousY > y &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pixel(x: number, y: number): Rgba {
  const filled = deerPolygons.some((polygon) => pointInPolygon(x, y, polygon));
  return filled ? [78, 167, 254, 255] : [0, 0, 0, 0];
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

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OSM_MAP_ENDPOINT = "https://api.openstreetmap.org/api/0.6/map";
const CAMPUS_BOUNDS = "-79.6715,43.5450,-79.6600,43.5524";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(repositoryRoot, "artifacts/utm-building-relations.json");

type Tags = Record<string, string | undefined>;
type Relation = {
  type: "relation";
  id: number;
  members: Array<{ type: string; ref: number; role: string }>;
  tags?: Tags;
};
type Payload = { elements: Array<Relation | { type: string; id?: number }> };

const url = new URL(OSM_MAP_ENDPOINT);
url.searchParams.set("bbox", CAMPUS_BOUNDS);
const response = await fetch(url, {
  headers: { Accept: "application/json", "User-Agent": "Gapwise-UTM relation inspector" },
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok) throw new Error(`OpenStreetMap map API returned HTTP ${response.status}.`);
const payload = (await response.json()) as Payload;
const relations = payload.elements
  .filter((element): element is Relation => element.type === "relation" && "members" in element)
  .filter((relation) => {
    const tags = relation.tags ?? {};
    return Boolean(
      tags["type"] === "multipolygon" ||
        (tags["building"] && tags["building"] !== "no") ||
        (tags["building:part"] && tags["building:part"] !== "no"),
    );
  })
  .map((relation) => ({
    id: relation.id,
    tags: relation.tags ?? {},
    members: relation.members,
  }));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), bbox: CAMPUS_BOUNDS, relations }, null, 2)}\n`,
  "utf8",
);
console.log(`Found ${relations.length} campus building/multipolygon relations.`);

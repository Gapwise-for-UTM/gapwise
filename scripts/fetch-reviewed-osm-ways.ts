import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const wayIds = [32875237, 1499474208, 762688681, 32875252, 1507394554, 1500300991, 1127939664];
const snapshots = [];
for (const wayId of wayIds) {
  const response = await fetch(`https://api.openstreetmap.org/api/0.6/way/${wayId}/full.json`, {
    headers: { Accept: "application/json", "User-Agent": "Gapwise-UTM reviewed geometry fetcher" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap way ${wayId} returned HTTP ${response.status}.`);
  snapshots.push({ wayId, payload: await response.json() });
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "artifacts/utm-reviewed-osm-ways.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), snapshots }, null, 2)}\n`, "utf8");
console.log(`Fetched ${snapshots.length} reviewed UTM OSM ways.`);

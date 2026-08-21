import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { UTM_BUILDINGS } from "../src/data/utm/building-registry";

const root = resolve(import.meta.dir, "..");
const entrances = JSON.parse(
  await readFile(resolve(root, "src/data/utm/entrances.geojson"), "utf8"),
);
const nodes = JSON.parse(
  await readFile(resolve(root, "src/data/utm/outdoor-nodes.geojson"), "utf8"),
);
const edges = JSON.parse(
  await readFile(resolve(root, "src/data/utm/outdoor-edges.json"), "utf8"),
).edges;
const nodeIds = new Set<string>(nodes.features.map((feature: { id: string }) => feature.id));
const adjacency = new Map<string, string[]>();
for (const edge of edges) {
  adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  if (edge.bidirectional) adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge.from]);
}
const connected = (id: string) => nodeIds.has(id) && (adjacency.get(id)?.length ?? 0) > 0;

const records = UTM_BUILDINGS.map((building) => {
  const accessPoints = entrances.features.filter(
    (feature: any) => feature.properties.buildingCode === building.code,
  );
  const verified = accessPoints.filter(
    (feature: any) => feature.properties.verificationStatus === "verified",
  );
  const inferred = accessPoints.filter(
    (feature: any) => feature.properties.verificationStatus === "inferred",
  );
  const routable = accessPoints.filter((feature: any) =>
    connected(`osm-node-${feature.properties.osmNodeId}`),
  );
  const unresolved: string[] = [];
  if (accessPoints.length === 0)
    unresolved.push("No publishable exterior access point is recorded.");
  if (accessPoints.some((feature: any) => (feature.properties.access ?? "unknown") === "unknown"))
    unresolved.push("Ordinary public access status is not affirmatively published.");
  if (accessPoints.some((feature: any) => feature.properties.accessibility === "unknown"))
    unresolved.push("Step-free status requires an authoritative source or field survey.");
  if (inferred.length > 0)
    unresolved.push("One or more approach points are topology inferences, not verified doors.");
  return {
    code: building.code,
    name: building.name,
    canonicalGeometry: "present",
    verifiedExteriorEntrances: verified.length,
    inferredApproaches: inferred.length,
    graphConnectedAccessPoints: routable.length,
    verifiedAccessibleEntrances: verified.filter(
      (feature: any) => feature.properties.accessibility === "accessible",
    ).length,
    provenance: [
      ...new Set(accessPoints.map((feature: any) => feature.properties.sourceUrl)),
    ].sort(),
    unresolved,
  };
});
const report = { generatedAt: "2026-08-21", failClosed: true, buildings: records };
await writeFile(
  resolve(root, "src/data/utm/generated/campus-access-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
const rows = records.map(
  (record) =>
    `| ${record.code} | ${record.verifiedExteriorEntrances} | ${record.inferredApproaches} | ${record.graphConnectedAccessPoints} | ${record.verifiedAccessibleEntrances} | ${record.unresolved.join(" ") || "None recorded"} |`,
);
await writeFile(
  resolve(root, "docs/CAMPUS_ACCESS_AUDIT.md"),
  `# UTM campus access audit\n\nGenerated deterministically by \`bun run routing:audit\`. “Verified” establishes a published door and building association; it does **not** imply public or step-free access unless those fields are affirmative. Unknown remains unknown and step-free routing fails closed.\n\n| Building | Verified doors | Inferred approaches | Graph-connected points | Verified step-free doors | Unresolved |\n| --- | ---: | ---: | ---: | ---: | --- |\n${rows.join("\n")}\n`,
);
console.log(`Audited ${records.length} buildings and ${entrances.features.length} access points.`);

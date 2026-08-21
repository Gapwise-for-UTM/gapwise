import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { UTM_BUILDINGS } from "../src/data/utm/building-registry";
import { officialEntranceCandidatesForBuilding } from "../src/data/utm/official-entrance-candidates";

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
    unresolved.push("No routable exterior access point with publishable geometry is recorded.");
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

const officialRows = UTM_BUILDINGS.flatMap((building) => {
  const candidates = officialEntranceCandidatesForBuilding(building.code);
  if (candidates.length === 0) return [];
  const physicalInstances = candidates.reduce((total, candidate) => total + candidate.instances, 0);
  const labels = candidates
    .map((candidate) => `${candidate.label}${candidate.instances > 1 ? ` ×${candidate.instances}` : ""}`)
    .join("; ");
  return [
    `| ${building.code} | ${candidates.length} | ${physicalInstances} | ${labels} | Identity/barrier-free status verified; exact route coordinate unresolved |`,
  ];
});

await writeFile(
  resolve(root, "docs/CAMPUS_ACCESS_AUDIT.md"),
  `# UTM campus access audit\n\nGenerated deterministically by \`bun run routing:audit\`. “Verified” in the routing table establishes a published door coordinate and building association; it does **not** imply public or step-free access unless those fields are affirmative. Unknown remains unknown and step-free routing fails closed.\n\n| Building | Routable verified doors | Routable inferred approaches | Graph-connected points | Verified step-free doors | Unresolved |\n| --- | ---: | ---: | ---: | ---: | --- |\n${rows.join("\n")}\n\n## Official UTM barrier-free entrance reconciliation\n\nUTM Facilities separately publishes named **barrier-free building entrances** in its snow and ice removal strategy: https://www.utm.utoronto.ca/facilities/utm-strategy-snow-and-ice-removal. These records establish the entrance identity and barrier-free designation, but the page does not publish exact door coordinates. Gapwise therefore keeps them as non-routable evidence candidates until a candidate can be matched to publishable geometry or a field survey.\n\nThe official University of Toronto interactive map (https://map.utoronto.ca/?id=1809) is used as a visual QA reference only. Gapwise does not scrape, copy, reverse-engineer, or transpose proprietary marker positions into routing coordinates.\n\n| Building | Official named identities | Physical instances | Official labels | Routing status |\n| --- | ---: | ---: | --- | --- |\n${officialRows.join("\n")}\n\nThe same official Facilities source also names **Early Learning Centre: Main**. Early Learning Centre is not currently in the Gapwise UTM building registry, so it is recorded here as an upstream coverage gap rather than silently assigned to another building. Absence from the barrier-free list does not prove that a building is inaccessible.\n`,
);
console.log(`Audited ${records.length} buildings and ${entrances.features.length} routable access points.`);

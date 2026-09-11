import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidatePath = resolve(root, "artifacts/utm-osm-entrance-candidates.json");
const entrancePath = resolve(root, "src/data/utm/entrances.geojson");
const outputPath = resolve(root, "artifacts/entrances.with-osm-discoveries.geojson");
const verifiedAt = "2026-09-10";

type Tags = Record<string, string | undefined>;
type Candidate = {
  osmNodeId: number;
  coordinates: [number, number];
  entrance: string;
  tags: Tags;
  existingGapwiseRecord: boolean;
  recommendedBuildingCode: string | null;
  reviewStatus: "unique_boundary_match" | "ambiguous" | "unmatched";
};

type EntranceFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown> & { osmNodeId?: number };
};

type Collection = {
  type: "FeatureCollection";
  metadata: Record<string, unknown>;
  features: EntranceFeature[];
};

function accessibility(tags: Tags): "accessible" | "not_accessible" | "unknown" {
  if (tags["wheelchair"] === "yes") return "accessible";
  if (tags["wheelchair"] === "no") return "not_accessible";
  return "unknown";
}

function access(candidate: Candidate): "restricted" | "emergency_only" | "unknown" {
  if (candidate.entrance === "emergency") return "emergency_only";
  if (["private", "no"].includes(candidate.tags["access"] ?? "")) return "restricted";
  return "unknown";
}

function label(candidate: Candidate): string {
  if (candidate.entrance === "emergency") return "Emergency entrance";
  if (candidate.entrance === "main") return "Mapped main entrance";
  return "Mapped entrance";
}

const discovery = JSON.parse(await readFile(candidatePath, "utf8")) as { candidates: Candidate[] };
const collection = JSON.parse(await readFile(entrancePath, "utf8")) as Collection;
const existing = new Set(collection.features.flatMap((feature) =>
  feature.properties.osmNodeId === undefined ? [] : [Number(feature.properties.osmNodeId)],
));

const additions = discovery.candidates
  .filter((candidate) =>
    !candidate.existingGapwiseRecord &&
    !existing.has(candidate.osmNodeId) &&
    candidate.reviewStatus === "unique_boundary_match" &&
    candidate.recommendedBuildingCode,
  )
  .map((candidate): EntranceFeature => ({
    type: "Feature",
    id: `${candidate.recommendedBuildingCode!.toLowerCase()}-${candidate.osmNodeId}`,
    geometry: { type: "Point", coordinates: candidate.coordinates },
    properties: {
      buildingCode: candidate.recommendedBuildingCode,
      label: label(candidate),
      kind: "entrance",
      osmNodeId: candidate.osmNodeId,
      accessibility: accessibility(candidate.tags),
      access: access(candidate),
      direction: "unknown",
      notes:
        candidate.entrance === "emergency"
          ? "Current OSM explicitly tags this physical door as an emergency entrance; it must not be used as a normal routing endpoint."
          : "Current OSM entrance-tagged node lies on exactly one canonical Gapwise building boundary; ordinary student/public access is not independently established.",
      source: "OpenStreetMap",
      sourceUrl: `https://www.openstreetmap.org/node/${candidate.osmNodeId}`,
      lastVerified: verifiedAt,
      verificationStatus: "verified",
    },
  }));

collection.features.push(...additions);
collection.metadata["lastVerified"] = verifiedAt;
collection.metadata["verificationStatus"] = "verified";
collection.metadata["description"] =
  "UTM building entrances and explicitly flagged pedestrian approach points. Physical door points come from reviewed OpenStreetMap entrance nodes; inferred approaches remain explicitly non-door topology fallbacks.";

await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`);
console.log(
  JSON.stringify({
    added: additions.map((feature) => ({
      id: feature.id,
      buildingCode: feature.properties["buildingCode"],
      osmNodeId: feature.properties.osmNodeId,
      access: feature.properties["access"],
    })),
    totalFeatures: collection.features.length,
  }),
);

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPUS_BUILDING_FOOTPRINTS } from "../src/data/utm/building-footprints";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidatePath = resolve(root, "artifacts/utm-osm-entrance-candidates.json");
const entrancePath = resolve(root, "src/data/utm/entrances.geojson");
const outputPath = resolve(root, "artifacts/entrances.with-osm-discoveries.geojson");
const REJECTED_OSM_ENTRANCE_NODE_IDS = new Set([13751172451]);

type Tags = Record<string, string | undefined>;
type MemberWay = { osmWayId: number; tags: Tags };
type Candidate = {
  osmNodeId: number;
  coordinates: [number, number];
  entrance: string;
  tags: Tags;
  existingGapwiseRecord: boolean;
  memberWays: MemberWay[];
  matches: Array<{
    buildingCode: string;
    buildingName: string;
    inside: boolean;
    boundaryDistanceMeters: number;
  }>;
  recommendedBuildingCode: string | null;
  reviewStatus: "unique_boundary_match" | "ambiguous" | "unmatched";
};

type ResolutionEvidence =
  "canonical_boundary" | "named_osm_building_way" | "canonical_containment_with_footway";

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

const REVIEWED_EXISTING_LABELS = new Map<number, string>([
  // UTM Facilities confirms OPH has one Main and one Rear barrier-free entrance,
  // but no reviewed source establishes which of these two current OSM doors is
  // which. Keep the physical doors distinct without inventing either identity.
  [13738728068, "Mapped entrance A"],
  [1728224590, "Mapped entrance B"],
]);

function normalizedIdentity(value: string) {
  return value.trim().toLocaleLowerCase("en-CA").replace(/\s+/g, " ");
}

function topologyBuildingCode(candidate: Candidate): string | null {
  const namedMemberWays = new Set(
    candidate.memberWays.flatMap((way) =>
      way.tags["building"] && way.tags["name"] ? [normalizedIdentity(way.tags["name"])] : [],
    ),
  );
  if (namedMemberWays.size === 0) return null;

  const matches = CAMPUS_BUILDING_FOOTPRINTS.features.filter((feature) =>
    namedMemberWays.has(normalizedIdentity(feature.properties.name)),
  );
  return matches.length === 1 ? matches[0]!.properties.buildingCode : null;
}

function containmentBuildingCode(candidate: Candidate): string | null {
  if (candidate.entrance !== "main" || candidate.matches.length !== 1) return null;
  const [match] = candidate.matches;
  if (!match?.inside) return null;
  const hasFootwayMembership = candidate.memberWays.some(
    (way) => way.tags["highway"] === "footway",
  );
  return hasFootwayMembership ? match.buildingCode : null;
}

function resolvedBuildingCode(candidate: Candidate): {
  buildingCode: string;
  evidence: ResolutionEvidence;
} | null {
  if (candidate.reviewStatus === "unique_boundary_match" && candidate.recommendedBuildingCode) {
    return {
      buildingCode: candidate.recommendedBuildingCode,
      evidence: "canonical_boundary",
    };
  }

  const topologyMatch = topologyBuildingCode(candidate);
  if (topologyMatch) {
    return { buildingCode: topologyMatch, evidence: "named_osm_building_way" };
  }

  const containmentMatch = containmentBuildingCode(candidate);
  if (containmentMatch) {
    return {
      buildingCode: containmentMatch,
      evidence: "canonical_containment_with_footway",
    };
  }

  return null;
}

function notes(candidate: Candidate, evidence: ResolutionEvidence): string {
  if (candidate.entrance === "emergency") {
    return "Current OSM explicitly tags this physical door as an emergency entrance; it must not be used as a normal routing endpoint.";
  }
  if (evidence === "named_osm_building_way") {
    return "Current OSM entrance-tagged node is an exact member of a named OSM building way whose name uniquely matches the canonical Gapwise building; ordinary student/public access is not independently established.";
  }
  if (evidence === "canonical_containment_with_footway") {
    return "Current OSM tags this node as a main entrance and exact member of a pedestrian footway; the node lies inside exactly one canonical Gapwise building footprint, supporting the building assignment despite a recessed/coarse canonical boundary. Ordinary student/public access is not independently established.";
  }
  return "Current OSM entrance-tagged node lies on exactly one canonical Gapwise building boundary; ordinary student/public access is not independently established.";
}

const discovery = JSON.parse(await readFile(candidatePath, "utf8")) as {
  generatedAt: string;
  candidates: Candidate[];
};
const verifiedAt = discovery.generatedAt.slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) {
  throw new Error(`Invalid discovery generatedAt date: ${discovery.generatedAt}`);
}

const collection = JSON.parse(await readFile(entrancePath, "utf8")) as Collection;
const existing = new Set(
  collection.features.flatMap((feature) =>
    feature.properties.osmNodeId === undefined ? [] : [Number(feature.properties.osmNodeId)],
  ),
);
const existingByOsmNodeId = new Map(
  collection.features.flatMap((feature) =>
    feature.properties.osmNodeId === undefined
      ? []
      : [[Number(feature.properties.osmNodeId), feature] as const],
  ),
);

// A fresh discovery run re-verifies every already-known OSM entrance node that
// it actually saw, so per-door freshness must move with the dataset-level
// freshness instead of leaving old dates behind. Access remains fail-closed:
// only explicit current OSM restrictions (access=private/no or
// entrance=emergency) are promoted. Missing access tags never erase a
// previously reviewed restriction and never imply public access. Reviewed
// identity-safe labels may also replace older labels that overstate which named
// official entrance a mapped door represents.
const existingOsmRefreshes = discovery.candidates.flatMap((candidate) => {
  const feature = existingByOsmNodeId.get(candidate.osmNodeId);
  if (!feature || feature.properties["source"] !== "OpenStreetMap") return [];

  const previousLastVerified = feature.properties["lastVerified"];
  const previousAccess = feature.properties["access"];
  const previousLabel = feature.properties["label"];
  const nextAccess = access(candidate);
  const reviewedLabel = REVIEWED_EXISTING_LABELS.get(candidate.osmNodeId);

  feature.properties["lastVerified"] = verifiedAt;
  if (nextAccess !== "unknown") feature.properties["access"] = nextAccess;
  if (reviewedLabel) feature.properties["label"] = reviewedLabel;

  const accessChanged = nextAccess !== "unknown" && previousAccess !== nextAccess;
  const labelChanged = reviewedLabel !== undefined && previousLabel !== reviewedLabel;
  if (previousLastVerified === verifiedAt && !accessChanged && !labelChanged) return [];

  return [
    {
      id: feature.id,
      buildingCode: feature.properties["buildingCode"],
      osmNodeId: candidate.osmNodeId,
      previousLastVerified: previousLastVerified ?? null,
      lastVerified: verifiedAt,
      previousAccess: previousAccess ?? "unknown",
      access: feature.properties["access"] ?? "unknown",
      previousLabel: previousLabel ?? null,
      label: feature.properties["label"] ?? null,
    },
  ];
});

const additions = discovery.candidates.flatMap((candidate): EntranceFeature[] => {
  if (REJECTED_OSM_ENTRANCE_NODE_IDS.has(candidate.osmNodeId)) return [];
  if (candidate.existingGapwiseRecord || existing.has(candidate.osmNodeId)) return [];
  const resolution = resolvedBuildingCode(candidate);
  if (!resolution) return [];

  return [
    {
      type: "Feature",
      id: `${resolution.buildingCode.toLowerCase()}-${candidate.osmNodeId}`,
      geometry: { type: "Point", coordinates: candidate.coordinates },
      properties: {
        buildingCode: resolution.buildingCode,
        label: label(candidate),
        kind: "entrance",
        osmNodeId: candidate.osmNodeId,
        accessibility: accessibility(candidate.tags),
        access: access(candidate),
        direction: "unknown",
        notes: notes(candidate, resolution.evidence),
        source: "OpenStreetMap",
        sourceUrl: `https://www.openstreetmap.org/node/${candidate.osmNodeId}`,
        lastVerified: verifiedAt,
        verificationStatus: "verified",
      },
    },
  ];
});

collection.features.push(...additions);
collection.metadata["lastVerified"] = verifiedAt;
collection.metadata["verificationStatus"] = "verified";
collection.metadata["description"] =
  "UTM building entrances and explicitly flagged pedestrian approach points. Physical door points come from reviewed OpenStreetMap entrance nodes; inferred approaches remain explicitly non-door topology fallbacks.";

await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`);
console.log(
  JSON.stringify({
    existingOsmRefreshes,
    added: additions.map((feature) => ({
      id: feature.id,
      buildingCode: feature.properties["buildingCode"],
      osmNodeId: feature.properties.osmNodeId,
      access: feature.properties["access"],
    })),
    totalFeatures: collection.features.length,
  }),
);

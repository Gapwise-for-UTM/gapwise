import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UTM_BUILDINGS } from "../src/data/utm/building-registry";
import { officialEntranceCandidatesForBuilding } from "../src/data/utm/official-entrance-candidates";
import type { AccessibilityStatus } from "../src/features/routing/types";

const root = fileURLToPath(new URL("../", import.meta.url));

type EntranceKind = "entrance" | "approach";
type VerificationStatus = "verified" | "inferred";
type EntranceAccess = "public" | "restricted" | "emergency_only" | "unknown";
type EntranceDirection = "entry" | "exit" | "both" | "unknown";

type AuditedEntrance = {
  id: string;
  buildingCode: string;
  kind: EntranceKind;
  routingNodeId: string;
  accessibility: AccessibilityStatus;
  access: EntranceAccess;
  direction: EntranceDirection;
  sourceUrl: string;
  verificationStatus: VerificationStatus;
};

type AuditedEdge = {
  id: string;
  from: string;
  to: string;
  bidirectional: boolean;
};

const ACCESSIBILITY = new Set<AccessibilityStatus>(["accessible", "not_accessible", "unknown"]);
const ACCESS = new Set<EntranceAccess>(["public", "restricted", "emergency_only", "unknown"]);
const DIRECTIONS = new Set<EntranceDirection>(["entry", "exit", "both", "unknown"]);
const VERIFICATION = new Set<VerificationStatus>(["verified", "inferred"]);
const ENTRANCE_KINDS = new Set<EntranceKind>(["entrance", "approach"]);
const EDGE_ENVIRONMENTS = new Set(["indoor", "outdoor", "covered"]);

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${context} must be a non-empty string.`);
  }
  return value;
}

function booleanValue(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${context} must be a boolean.`);
  return value;
}

function finiteNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number.`);
  }
  return value;
}

function featureCollection(value: unknown, context: string): unknown[] {
  const collection = record(value, context);
  const features = collection["features"];
  if (collection["type"] !== "FeatureCollection" || !Array.isArray(features)) {
    throw new Error(`${context} must be a GeoJSON FeatureCollection.`);
  }
  return features;
}

function validatePointGeometry(value: unknown, context: string): void {
  const geometry = record(value, `${context}.geometry`);
  const coordinates = geometry["coordinates"];
  if (geometry["type"] !== "Point" || !Array.isArray(coordinates)) {
    throw new Error(`${context}.geometry must be a GeoJSON Point.`);
  }
  if (coordinates.length !== 2) {
    throw new Error(`${context}.geometry.coordinates must contain longitude and latitude.`);
  }
  const longitude = finiteNumber(coordinates[0], `${context}.longitude`);
  const latitude = finiteNumber(coordinates[1], `${context}.latitude`);
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error(`${context}.geometry contains an out-of-range WGS84 coordinate.`);
  }
}

function parseEntrances(value: unknown): AuditedEntrance[] {
  return featureCollection(value, "entrances.geojson").map((rawFeature, index) => {
    const context = `entrances.geojson feature ${index}`;
    const feature = record(rawFeature, context);
    const id = stringValue(feature["id"], `${context}.id`);
    validatePointGeometry(feature["geometry"], context);
    const properties = record(feature["properties"], `${context}.properties`);
    const buildingCode = stringValue(properties["buildingCode"], `${context}.buildingCode`);
    stringValue(properties["label"], `${context}.label`);
    stringValue(properties["source"], `${context}.source`);
    const sourceUrl = stringValue(properties["sourceUrl"], `${context}.sourceUrl`);
    if (!sourceUrl.startsWith("https://")) throw new Error(`${context}.sourceUrl must use HTTPS.`);
    const lastVerified = stringValue(properties["lastVerified"], `${context}.lastVerified`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastVerified)) {
      throw new Error(`${context}.lastVerified must use YYYY-MM-DD.`);
    }

    const kind = properties["kind"];
    if (!ENTRANCE_KINDS.has(kind as EntranceKind)) {
      throw new Error(`${context}.kind is invalid.`);
    }
    const accessibility = properties["accessibility"];
    if (!ACCESSIBILITY.has(accessibility as AccessibilityStatus)) {
      throw new Error(`${context}.accessibility is invalid.`);
    }
    const verificationStatus = properties["verificationStatus"];
    if (!VERIFICATION.has(verificationStatus as VerificationStatus)) {
      throw new Error(`${context}.verificationStatus is invalid.`);
    }
    const access = properties["access"] ?? "unknown";
    if (!ACCESS.has(access as EntranceAccess)) throw new Error(`${context}.access is invalid.`);
    const direction = properties["direction"] ?? "unknown";
    if (!DIRECTIONS.has(direction as EntranceDirection)) {
      throw new Error(`${context}.direction is invalid.`);
    }

    const routingNodeIdValue = properties["routingNodeId"];
    const explicitRoutingNodeId =
      routingNodeIdValue === undefined
        ? null
        : stringValue(routingNodeIdValue, `${context}.routingNodeId`);
    let osmNodeId: number | null = null;
    const osmNodeIdValue = properties["osmNodeId"];
    if (osmNodeIdValue !== undefined) {
      const candidate = finiteNumber(osmNodeIdValue, `${context}.osmNodeId`);
      if (!Number.isSafeInteger(candidate) || candidate <= 0) {
        throw new Error(`${context}.osmNodeId must be a positive safe integer.`);
      }
      osmNodeId = candidate;
    }
    const routingNodeId = explicitRoutingNodeId ?? (osmNodeId ? `osm-node-${osmNodeId}` : null);
    if (!routingNodeId) {
      throw new Error(`${context} must provide routingNodeId or osmNodeId.`);
    }

    return {
      id,
      buildingCode,
      kind: kind as EntranceKind,
      routingNodeId,
      accessibility: accessibility as AccessibilityStatus,
      access: access as EntranceAccess,
      direction: direction as EntranceDirection,
      sourceUrl,
      verificationStatus: verificationStatus as VerificationStatus,
    };
  });
}

function parseOutdoorNodeIds(value: unknown): Set<string> {
  const ids = new Set<string>();
  for (const [index, rawFeature] of featureCollection(value, "outdoor-nodes.geojson").entries()) {
    const context = `outdoor-nodes.geojson feature ${index}`;
    const feature = record(rawFeature, context);
    const id = stringValue(feature["id"], `${context}.id`);
    if (ids.has(id)) throw new Error(`Duplicate outdoor node id “${id}”.`);
    validatePointGeometry(feature["geometry"], context);
    record(feature["properties"], `${context}.properties`);
    ids.add(id);
  }
  return ids;
}

function parseEdges(value: unknown, nodeIds: ReadonlySet<string>): AuditedEdge[] {
  const payload = record(value, "outdoor-edges.json");
  const rawEdges = payload["edges"];
  if (!Array.isArray(rawEdges)) throw new Error("outdoor-edges.json.edges must be an array.");
  const edgeIds = new Set<string>();
  return rawEdges.map((rawEdge, index) => {
    const context = `outdoor-edges.json edge ${index}`;
    const edge = record(rawEdge, context);
    const id = stringValue(edge["id"], `${context}.id`);
    if (edgeIds.has(id)) throw new Error(`Duplicate outdoor edge id “${id}”.`);
    edgeIds.add(id);
    const from = stringValue(edge["from"], `${context}.from`);
    const to = stringValue(edge["to"], `${context}.to`);
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      throw new Error(`${context} references a missing node.`);
    }
    const distance = finiteNumber(edge["distanceMeters"], `${context}.distanceMeters`);
    if (distance <= 0) throw new Error(`${context}.distanceMeters must be positive.`);
    const environment = stringValue(edge["environment"], `${context}.environment`);
    if (!EDGE_ENVIRONMENTS.has(environment)) throw new Error(`${context}.environment is invalid.`);
    booleanValue(edge["stairs"], `${context}.stairs`);
    const bidirectional = booleanValue(edge["bidirectional"], `${context}.bidirectional`);
    const accessibility = edge["accessibility"];
    if (!ACCESSIBILITY.has(accessibility as AccessibilityStatus)) {
      throw new Error(`${context}.accessibility is invalid.`);
    }
    record(edge["metadata"], `${context}.metadata`);
    return { id, from, to, bidirectional };
  });
}

const entrances = parseEntrances(
  JSON.parse(await readFile(resolve(root, "src/data/utm/entrances.geojson"), "utf8")) as unknown,
);
const nodeIds = parseOutdoorNodeIds(
  JSON.parse(
    await readFile(resolve(root, "src/data/utm/outdoor-nodes.geojson"), "utf8"),
  ) as unknown,
);
const edges = parseEdges(
  JSON.parse(await readFile(resolve(root, "src/data/utm/outdoor-edges.json"), "utf8")) as unknown,
  nodeIds,
);

const adjacency = new Map<string, string[]>();
for (const edge of edges) {
  adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  if (edge.bidirectional) adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge.from]);
}
const connected = (id: string) => nodeIds.has(id) && (adjacency.get(id)?.length ?? 0) > 0;

const records = UTM_BUILDINGS.map((building) => {
  const accessPoints = entrances.filter((feature) => feature.buildingCode === building.code);
  const verified = accessPoints.filter((feature) => feature.verificationStatus === "verified");
  const inferred = accessPoints.filter((feature) => feature.verificationStatus === "inferred");
  const graphConnected = accessPoints.filter((feature) => connected(feature.routingNodeId));
  const unresolved: string[] = [];
  if (accessPoints.length === 0) {
    unresolved.push("No publishable exterior access point is recorded.");
  }
  if (accessPoints.some((feature) => feature.access === "unknown")) {
    unresolved.push("Ordinary public access status is not affirmatively published.");
  }
  if (accessPoints.some((feature) => feature.accessibility === "unknown")) {
    unresolved.push("Step-free status requires an authoritative source or field survey.");
  }
  if (inferred.length > 0) {
    unresolved.push("One or more approach points are topology inferences, not verified doors.");
  }
  return {
    code: building.code,
    name: building.name,
    canonicalGeometry: "present",
    verifiedExteriorEntrances: verified.length,
    inferredApproaches: inferred.length,
    graphConnectedAccessPoints: graphConnected.length,
    verifiedAccessibleEntrances: verified.filter(
      (feature) => feature.accessibility === "accessible",
    ).length,
    provenance: [...new Set(accessPoints.map((feature) => feature.sourceUrl))].sort(),
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
  const record = records.find((item) => item.code === building.code)!;
  const physicalInstances = candidates.reduce((total, candidate) => total + candidate.instances, 0);
  const labels = candidates
    .map(
      (candidate) =>
        `${candidate.label}${candidate.instances > 1 ? ` ×${candidate.instances}` : ""}`,
    )
    .join("; ");
  const minimumAccessibleGeometryGap = Math.max(
    0,
    physicalInstances - record.verifiedAccessibleEntrances,
  );
  return [
    `| ${building.code} | ${candidates.length} | ${physicalInstances} | ${record.verifiedExteriorEntrances} | ${record.verifiedAccessibleEntrances} | ${minimumAccessibleGeometryGap} | ${labels} |`,
  ];
});

await writeFile(
  resolve(root, "docs/CAMPUS_ACCESS_AUDIT.md"),
  `# UTM campus access audit\n\nGenerated deterministically by \`bun run routing:audit\`. “Verified” in the first table means the cited source establishes a geocoded door and building association; it does **not** imply public or step-free access unless those fields are affirmative. “Graph-connected” means only that the point is attached to the bundled pedestrian graph; it does not by itself establish endpoint eligibility. Unknown remains unknown and step-free routing fails closed. Official identity-only evidence is reconciled separately below.\n\n| Building | Verified geocoded doors | Inferred geocoded approaches | Graph-connected access points | Explicitly accessible geocoded doors | Unresolved |\n| --- | ---: | ---: | ---: | ---: | --- |\n${rows.join("\n")}\n\n## Official UTM barrier-free entrance reconciliation\n\nUTM Facilities separately publishes named **barrier-free building entrances** in its snow and ice removal strategy: https://www.utm.utoronto.ca/facilities/utm-strategy-snow-and-ice-removal. These records establish the entrance identity and barrier-free designation, but the page does not publish exact door coordinates. Gapwise therefore keeps them as non-routable evidence candidates until a candidate can be matched to publishable geometry or a field survey.\n\nThe official University of Toronto interactive map (https://map.utoronto.ca/?id=1809) was visually reviewed on 2026-08-21 as a corroborating QA reference. Its accessibility markers reinforce that several academic-core buildings have multiple exterior access points, including clusters around MN/DH/IB/HM/CCT/DV/KN/XR/EH/OPH. Gapwise does **not** scrape, copy, reverse-engineer, or transpose proprietary marker positions into routing coordinates.\n\nThe “minimum unresolved accessible coordinates” column is a conservative lower bound: official barrier-free physical instances minus currently geocoded entrances that are independently marked accessible. A value of zero does **not** prove identity-level reconciliation; the geocoded coordinates still need an explicit source match to the named official entrance.\n\n| Building | Official named identities | Physical instances | Verified geocoded doors | Explicitly accessible coordinates | Minimum unresolved accessible coordinates | Official labels |\n| --- | ---: | ---: | ---: | ---: | ---: | --- |\n${officialRows.join("\n")}\n\nThe same official Facilities source also names **Early Learning Centre: Main**. Early Learning Centre is not currently in the Gapwise UTM building registry, so it is recorded here as an upstream coverage gap rather than silently assigned to another building. Absence from the barrier-free list does not prove that a building is inaccessible.\n`,
);
console.log(`Audited ${records.length} buildings and ${entrances.length} geocoded access points.`);

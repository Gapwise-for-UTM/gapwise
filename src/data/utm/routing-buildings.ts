import type {
  AccessibilityStatus,
  SourceMetadata,
  VerificationStatus,
} from "@/features/routing/types";
import { UTM_BUILDINGS } from "./building-registry";
import entranceDataRaw from "./entrances.geojson?raw";

export type EntranceKind = "entrance" | "approach";

export type BuildingEntrance = {
  id: string;
  label: string;
  kind: EntranceKind;
  coordinates: [number, number];
  /**
   * Internal graph identity. This may point at an OSM-backed node today or a
   * field-survey/custom node in the future.
   */
  routingNodeId: string;
  /**
   * Compatibility field for current callers. It is optional by design and
   * must not be used as the entrance's canonical identity.
   */
  osmNodeId?: number;
  externalIds?: {
    osmNodeId?: number;
  };
  accessibility: AccessibilityStatus;
  notes?: string;
  metadata: SourceMetadata;
};

export type CampusBuilding = {
  code: string;
  name: string;
  category: "academic" | "residence" | "facility";
  entrances: BuildingEntrance[];
  navigationPoint: [number, number];
  entranceNodeId: string;
  indoorMapped: boolean;
};

/**
 * Validate that every entrance exposed as routable actually anchors to a node
 * in the assembled campus graph. Keep this separate from entrance parsing so
 * routing-buildings does not depend on campus.ts and create an import cycle.
 */
export function campusBuildingRoutingIssues(
  buildings: readonly CampusBuilding[],
  graphNodeIds: ReadonlySet<string>,
): string[] {
  const issues: string[] = [];

  for (const building of buildings) {
    const entranceNodeIds = new Set(building.entrances.map((entrance) => entrance.routingNodeId));
    if (!entranceNodeIds.has(building.entranceNodeId)) {
      issues.push(
        `Building “${building.code}” primary entrance node “${building.entranceNodeId}” is not one of its entrance routing nodes.`,
      );
    }

    for (const entrance of building.entrances) {
      if (!graphNodeIds.has(entrance.routingNodeId)) {
        issues.push(
          `Building “${building.code}” entrance “${entrance.id}” references missing routing node “${entrance.routingNodeId}”.`,
        );
      }
    }
  }

  return issues;
}

export function assertCampusBuildingRoutingIntegrity(
  buildings: readonly CampusBuilding[],
  graphNodeIds: ReadonlySet<string>,
): void {
  const issues = campusBuildingRoutingIssues(buildings, graphNodeIds);
  if (issues.length > 0) {
    throw new Error(`Campus building routing validation failed:\n- ${issues.join("\n- ")}`);
  }
}

type EntranceFeature = {
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    buildingCode: string;
    label: string;
    kind: EntranceKind;
    /**
     * Legacy/current OSM linkage. New entrance identities are not required to
     * have one; an explicit routingNodeId may be used instead.
     */
    osmNodeId?: number;
    routingNodeId?: string;
    accessibility: AccessibilityStatus;
    notes?: string;
    source: string;
    sourceUrl: string;
    lastVerified: string;
    verificationStatus: VerificationStatus;
  };
};

const entranceFeatures = (JSON.parse(entranceDataRaw) as { features: EntranceFeature[] }).features;

function resolveRoutingNodeId(feature: EntranceFeature): string | null {
  if (feature.properties.routingNodeId) return feature.properties.routingNodeId;
  if (feature.properties.osmNodeId !== undefined) {
    return `osm-node-${feature.properties.osmNodeId}`;
  }
  return null;
}

function toEntrance(feature: EntranceFeature): BuildingEntrance | null {
  const routingNodeId = resolveRoutingNodeId(feature);
  if (!routingNodeId) return null;

  const entrance: BuildingEntrance = {
    id: feature.id,
    label: feature.properties.label,
    kind: feature.properties.kind,
    coordinates: feature.geometry.coordinates,
    routingNodeId,
    accessibility: feature.properties.accessibility,
    metadata: {
      source: feature.properties.source,
      sourceUrl: feature.properties.sourceUrl,
      lastVerified: feature.properties.lastVerified,
      verificationStatus: feature.properties.verificationStatus,
    },
  };
  if (feature.properties.osmNodeId !== undefined) {
    entrance.osmNodeId = feature.properties.osmNodeId;
    entrance.externalIds = { osmNodeId: feature.properties.osmNodeId };
  }
  if (feature.properties.notes) entrance.notes = feature.properties.notes;
  return entrance;
}

/** One source of truth for every routable academic and residence building. */
export const CAMPUS_BUILDINGS: CampusBuilding[] = UTM_BUILDINGS.flatMap(
  (building): CampusBuilding[] => {
    const entrances = entranceFeatures
      .filter((feature) => feature.properties.buildingCode === building.code)
      .map(toEntrance)
      .filter((entrance): entrance is BuildingEntrance => entrance !== null);
    if (entrances.length === 0) return [];
    const primary = entrances[0]!;
    return [
      {
        code: building.code,
        name: building.name,
        category: building.category,
        entrances,
        navigationPoint: primary.coordinates,
        entranceNodeId: primary.routingNodeId,
        indoorMapped: false,
      } satisfies CampusBuilding,
    ];
  },
);

export const RESIDENCE_BUILDINGS = CAMPUS_BUILDINGS.filter(
  (building) => building.category === "residence",
);

export function getCampusBuilding(code: string | null): CampusBuilding | null {
  return CAMPUS_BUILDINGS.find((building) => building.code === code?.toUpperCase()) ?? null;
}

export function getResidenceBuilding(code: string | null): CampusBuilding | null {
  const building = getCampusBuilding(code);
  return building?.category === "residence" ? building : null;
}

export function hasVerifiedRoutingData(code: string): boolean {
  return (
    getCampusBuilding(code)?.entrances.some(
      (entrance) => entrance.metadata.verificationStatus === "verified",
    ) ?? false
  );
}

export function hasMappedRoutingData(code: string): boolean {
  return getCampusBuilding(code) !== null;
}

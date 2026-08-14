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
  osmNodeId: number;
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

type EntranceFeature = {
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    buildingCode: string;
    label: string;
    kind: EntranceKind;
    osmNodeId: number;
    accessibility: AccessibilityStatus;
    notes?: string;
    source: string;
    sourceUrl: string;
    lastVerified: string;
    verificationStatus: VerificationStatus;
  };
};

const entranceFeatures = (JSON.parse(entranceDataRaw) as { features: EntranceFeature[] }).features;

function toEntrance(feature: EntranceFeature): BuildingEntrance {
  const entrance: BuildingEntrance = {
    id: feature.id,
    label: feature.properties.label,
    kind: feature.properties.kind,
    coordinates: feature.geometry.coordinates,
    osmNodeId: feature.properties.osmNodeId,
    accessibility: feature.properties.accessibility,
    metadata: {
      source: feature.properties.source,
      sourceUrl: feature.properties.sourceUrl,
      lastVerified: feature.properties.lastVerified,
      verificationStatus: feature.properties.verificationStatus,
    },
  };
  if (feature.properties.notes) entrance.notes = feature.properties.notes;
  return entrance;
}

/** One source of truth for every routable academic and residence building. */
export const CAMPUS_BUILDINGS: CampusBuilding[] = UTM_BUILDINGS.flatMap(
  (building): CampusBuilding[] => {
    const entrances = entranceFeatures
      .filter((feature) => feature.properties.buildingCode === building.code)
      .map(toEntrance);
    if (entrances.length === 0) return [];
    const primary = entrances[0]!;
    return [
      {
        code: building.code,
        name: building.name,
        category: building.category,
        entrances,
        navigationPoint: primary.coordinates,
        entranceNodeId: `osm-node-${primary.osmNodeId}`,
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

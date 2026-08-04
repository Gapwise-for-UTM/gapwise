import type { SourceMetadata } from "@/features/routing/types";

export type CampusBuilding = {
  code: "MN" | "DH" | "IB";
  name: string;
  navigationPoint: [number, number];
  entranceNodeId: string;
  indoorMapped: boolean;
  metadata: SourceMetadata;
};

const OSM_META = {
  source: "OpenStreetMap",
  lastVerified: "2026-08-01",
  verificationStatus: "verified",
} as const;

/** Buildings with verified navigation points. This is intentionally not the recognition registry. */
export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    code: "MN",
    name: "Maanjiwe nendamowinan",
    navigationPoint: [-79.6654141, 43.5513221],
    entranceNodeId: "entrance-mn-13738201127",
    indoorMapped: false,
    metadata: {
      ...OSM_META,
      sourceUrl: "https://www.openstreetmap.org/node/13738201127",
    },
  },
  {
    code: "DH",
    name: "Deerfield Hall",
    navigationPoint: [-79.6659651, 43.5503162],
    entranceNodeId: "entrance-dh-13568164836",
    indoorMapped: false,
    metadata: {
      ...OSM_META,
      sourceUrl: "https://www.openstreetmap.org/node/13568164836",
    },
  },
  {
    code: "IB",
    name: "Instructional Centre",
    navigationPoint: [-79.6636318, 43.5516425],
    entranceNodeId: "entrance-ib-2383650599",
    indoorMapped: false,
    metadata: {
      ...OSM_META,
      sourceUrl: "https://www.openstreetmap.org/node/2383650599",
    },
  },
];

export function getCampusBuilding(code: string | null): CampusBuilding | null {
  return CAMPUS_BUILDINGS.find((building) => building.code === code?.toUpperCase()) ?? null;
}

export function hasVerifiedRoutingData(code: string): boolean {
  return getCampusBuilding(code) !== null;
}

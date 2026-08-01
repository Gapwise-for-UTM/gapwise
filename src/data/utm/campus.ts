import type { RoutingGraph, RoutingNode, SourceMetadata } from "@/features/routing/types";

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

const ENTRANCE_NODES: RoutingNode[] = CAMPUS_BUILDINGS.map((building) => ({
  id: building.entranceNodeId,
  kind: "building-entrance",
  buildingCode: building.code,
  floor: null,
  longitude: building.navigationPoint[0],
  latitude: building.navigationPoint[1],
  label: `${building.code} mapped entrance`,
  metadata: building.metadata,
}));

/**
 * Only verified records are loaded. Outdoor paths and indoor geometry remain empty
 * until contributors can connect OSM ways/official floor data to these entrances.
 */
export const UTM_ROUTING_GRAPH: RoutingGraph = {
  nodes: ENTRANCE_NODES,
  edges: [],
};

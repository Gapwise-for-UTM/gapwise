import { factEvidence, type FactEvidence } from "./provenance";

export type OfficialEntranceCandidate = {
  id: string;
  buildingCode: string;
  label: string;
  /** Multiple physical entrances may share one published identity (for example Rear x 2). */
  instances: number;
  kind: "exterior_entrance" | "building_connection";
  reconciliationStatus:
    | "matched"
    | "geometry_unknown"
    | "access_unknown"
    | "requires_field_verification"
    | "intentionally_non_routable";
  routingStatus: "candidate" | "non_routable";
  coordinates: null;
  routingNodeId: null;
  evidence: {
    existence: FactEvidence;
    barrierFree: FactEvidence;
    geometry: FactEvidence;
    publicAccess: FactEvidence;
  };
};

const BARRIER_FREE_EXISTENCE = factEvidence(
  ["utm-facilities-snow-ice"],
  "verified",
  "UTM Facilities explicitly names this barrier-free entrance identity.",
);

const BARRIER_FREE_ACCESSIBILITY = factEvidence(
  ["utm-facilities-snow-ice"],
  "verified",
  "The source identifies the entrance as barrier-free; this does not establish the accessibility of every connecting route edge.",
);

const UNKNOWN_GEOMETRY = factEvidence(
  ["utm-facilities-snow-ice"],
  "unknown",
  "The official source does not publish an exact coordinate for this named entrance.",
);

const UNKNOWN_PUBLIC_ACCESS = factEvidence(
  ["utm-facilities-snow-ice"],
  "unknown",
  "Priority snow-clearing status does not, by itself, establish unrestricted public access.",
);

type CandidateIdentity = readonly [
  stableId: string,
  buildingCode: string,
  label: string,
  instances?: number,
  kind?: OfficialEntranceCandidate["kind"],
];

/**
 * Official UTM Facilities barrier-free entrance identities for buildings in the
 * current Gapwise registry. The same source also names Early Learning Centre:
 * Main, but that building is not currently part of UTM_BUILDINGS.
 */
const BARRIER_FREE_IDENTITIES: readonly CandidateIdentity[] = [
  ["ax:main", "AX", "Main"],
  ["wc:rear", "WC", "Rear"],
  ["cct:main", "CCT", "Main"],
  ["cct:link", "CCT", "Link"],
  ["cct:connection-with-dv", "CCT", "Connection with DV", 1, "building_connection"],
  ["dh:main", "DH", "Main"],
  ["dh:field-side", "DH", "Field side"],
  ["dw:main", "DW", "Main"],
  ["hm:main", "HM", "Main"],
  ["hb:main", "HB", "Main"],
  ["hb:rear", "HB", "Rear"],
  ["ib:main", "IB", "Main"],
  ["ib:north", "IB", "North"],
  ["ib:south", "IB", "South"],
  ["mn:main", "MN", "Main"],
  ["mn:field-side", "MN", "Field side"],
  ["mn:lot-1", "MN", "Lot #1"],
  ["nsb:main", "NSB", "Main"],
  ["nsb:rear", "NSB", "Rear"],
  ["rawc:main", "RAWC", "Main"],
  ["bg:main", "BG", "Main"],
  ["xr:five-minute-walk-side", "XR", "5 Minute Walk side"],
  ["xr:academic-annex-side", "XR", "Academic Annex side"],
  ["dv:main", "DV", "Main"],
  ["dv:end-of-five-minute-walk", "DV", "End of 5 Minute Walk"],
  ["dv:connection-with-cct", "DV", "Connection with CCT", 1, "building_connection"],
  ["eh:main", "EH", "Main"],
  ["eh:rear", "EH", "Rear", 2],
  ["oph:main", "OPH", "Main"],
  ["oph:rear", "OPH", "Rear"],
  ["rih:main", "RIH", "Main"],
];

export const OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES: readonly OfficialEntranceCandidate[] =
  BARRIER_FREE_IDENTITIES.map(
    ([stableId, buildingCode, label, instances = 1, kind = "exterior_entrance"]) => ({
      id: `utm:entrance-candidate:${stableId}`,
      buildingCode,
      label,
      instances,
      kind,
      reconciliationStatus:
        kind === "building_connection" ? "intentionally_non_routable" : "geometry_unknown",
      routingStatus: kind === "building_connection" ? "non_routable" : "candidate",
      coordinates: null,
      routingNodeId: null,
      evidence: {
        existence: BARRIER_FREE_EXISTENCE,
        barrierFree: BARRIER_FREE_ACCESSIBILITY,
        geometry: UNKNOWN_GEOMETRY,
        publicAccess: UNKNOWN_PUBLIC_ACCESS,
      },
    }),
  );

export function officialEntranceCandidatesForBuilding(
  buildingCode: string,
): readonly OfficialEntranceCandidate[] {
  const normalized = buildingCode.trim().toUpperCase();
  return OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.filter(
    (candidate) => candidate.buildingCode === normalized,
  );
}

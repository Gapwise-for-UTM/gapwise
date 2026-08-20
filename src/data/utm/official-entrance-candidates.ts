import { factEvidence, type FactEvidence } from "./provenance";

export type OfficialEntranceCandidate = {
  id: string;
  buildingCode: string;
  label: string;
  /**
   * Some official records identify more than one entrance without publishing
   * separate names/geometry (for example "Rear x 2"). Keep multiplicity
   * without inventing door identities.
   */
  instances: number;
  routingStatus: "non_routable_candidate";
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
];

/**
 * The official source names 31 distinct entrance identities across buildings
 * in the current Gapwise registry. Erindale Hall's "Rear x 2" is one named
 * identity with multiplicity two; the source does not distinguish Rear 1/2.
 */
const BARRIER_FREE_IDENTITIES: readonly CandidateIdentity[] = [
  ["ax:main", "AX", "Main"],
  ["wc:rear", "WC", "Rear"],
  ["cct:main", "CCT", "Main"],
  ["cct:link", "CCT", "Link"],
  ["cct:connection-with-dv", "CCT", "Connection with DV"],
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
  ["dv:connection-with-cct", "DV", "Connection with CCT"],
  ["eh:main", "EH", "Main"],
  ["eh:rear", "EH", "Rear", 2],
  ["oph:main", "OPH", "Main"],
  ["oph:rear", "OPH", "Rear"],
  ["rih:main", "RIH", "Main"],
];

export const OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES: readonly OfficialEntranceCandidate[] =
  BARRIER_FREE_IDENTITIES.map(([stableId, buildingCode, label, instances = 1]) => ({
    id: `utm:entrance-candidate:${stableId}`,
    buildingCode,
    label,
    instances,
    routingStatus: "non_routable_candidate",
    coordinates: null,
    routingNodeId: null,
    evidence: {
      existence: BARRIER_FREE_EXISTENCE,
      barrierFree: BARRIER_FREE_ACCESSIBILITY,
      geometry: UNKNOWN_GEOMETRY,
      publicAccess: UNKNOWN_PUBLIC_ACCESS,
    },
  }));

export function officialEntranceCandidatesForBuilding(
  buildingCode: string,
): readonly OfficialEntranceCandidate[] {
  const normalized = buildingCode.trim().toUpperCase();
  return OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.filter(
    (candidate) => candidate.buildingCode === normalized,
  );
}

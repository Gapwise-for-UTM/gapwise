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

/**
 * Authoritative entrance identities that are deliberately not part of the
 * routing graph. Matching one to a door coordinate or routing node requires a
 * separate geometry/field-verification step.
 *
 * The source lists "Erindale Hall: Main, Rear x 2". This is represented as one
 * named Rear candidate with instances=2 rather than fabricating Rear 1/Rear 2
 * identities that the source does not distinguish.
 */
export const OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES: readonly OfficialEntranceCandidate[] = [
  { id: "utm:entrance-candidate:ax:main", buildingCode: "AX", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:wc:rear", buildingCode: "WC", label: "Rear", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:cct:main", buildingCode: "CCT", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:cct:link", buildingCode: "CCT", label: "Link", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:cct:connection-with-dv", buildingCode: "CCT", label: "Connection with DV", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:dh:main", buildingCode: "DH", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:dh:field-side", buildingCode: "DH", label: "Field side", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:dw:main", buildingCode: "DW", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:hm:main", buildingCode: "HM", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:hb:main", buildingCode: "HB", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:hb:rear", buildingCode: "HB", label: "Rear", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:ib:main", buildingCode: "IB", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:ib:north", buildingCode: "IB", label: "North", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:ib:south", buildingCode: "IB", label: "South", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:mn:main", buildingCode: "MN", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:mn:field-side", buildingCode: "MN", label: "Field side", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:mn:lot-1", buildingCode: "MN", label: "Lot #1", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:nsb:main", buildingCode: "NSB", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:nsb:rear", buildingCode: "NSB", label: "Rear", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:rawc:main", buildingCode: "RAWC", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:bg:main", buildingCode: "BG", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:xr:five-minute-walk-side", buildingCode: "XR", label: "5 Minute Walk side", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:xr:academic-annex-side", buildingCode: "XR", label: "Academic Annex side", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:dv:main", buildingCode: "DV", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:dv:end-of-five-minute-walk", buildingCode: "DV", label: "End of 5 Minute Walk", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:dv:connection-with-cct", buildingCode: "DV", label: "Connection with CCT", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:eh:main", buildingCode: "EH", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:eh:rear", buildingCode: "EH", label: "Rear", instances: 2, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:oph:main", buildingCode: "OPH", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:oph:rear", buildingCode: "OPH", label: "Rear", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
  { id: "utm:entrance-candidate:rih:main", buildingCode: "RIH", label: "Main", instances: 1, routingStatus: "non_routable_candidate", coordinates: null, routingNodeId: null, evidence: { existence: BARRIER_FREE_EXISTENCE, barrierFree: BARRIER_FREE_ACCESSIBILITY, geometry: UNKNOWN_GEOMETRY, publicAccess: UNKNOWN_PUBLIC_ACCESS } },
];

export function officialEntranceCandidatesForBuilding(
  buildingCode: string,
): readonly OfficialEntranceCandidate[] {
  const normalized = buildingCode.trim().toUpperCase();
  return OFFICIAL_BARRIER_FREE_ENTRANCE_CANDIDATES.filter(
    (candidate) => candidate.buildingCode === normalized,
  );
}

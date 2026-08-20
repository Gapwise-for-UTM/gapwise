export type CampusSourceId =
  | "utm-facilities-buildings"
  | "utm-facilities-snow-ice"
  | "utm-housing-welcome-home";

export type CampusSourceRecord = {
  id: CampusSourceId;
  organization: string;
  title: string;
  url: string;
  sourceType: "official_web";
  retrievedAt: string;
  notes?: string;
};

export type EvidenceConfidence = "verified" | "corroborated" | "approximate" | "unknown";

export type FactEvidence = {
  sourceIds: readonly CampusSourceId[];
  confidence: EvidenceConfidence;
  lastVerified: string;
  notes?: string;
};

export const CAMPUS_SOURCE_RECORDS = {
  "utm-facilities-buildings": {
    id: "utm-facilities-buildings",
    organization: "University of Toronto Mississauga Facilities Management & Planning",
    title: "Buildings",
    url: "https://www.utm.utoronto.ca/facilities/buildings",
    sourceType: "official_web",
    retrievedAt: "2026-08-20",
  },
  "utm-facilities-snow-ice": {
    id: "utm-facilities-snow-ice",
    organization: "University of Toronto Mississauga Facilities Management & Planning",
    title: "UTM Strategy for Snow and Ice Removal",
    url: "https://www.utm.utoronto.ca/facilities/utm-strategy-snow-and-ice-removal",
    sourceType: "official_web",
    retrievedAt: "2026-08-20",
    notes:
      "Priority 1 names barrier-free building entrance identities. It does not, by itself, establish exact door geometry or a complete step-free route.",
  },
  "utm-housing-welcome-home": {
    id: "utm-housing-welcome-home",
    organization: "University of Toronto Mississauga Student Housing & Residence Life",
    title: "Welcome Home!",
    url: "https://www.utm.utoronto.ca/housing/welcome-home",
    sourceType: "official_web",
    retrievedAt: "2026-08-20",
    notes: "Public community-area identifiers support residence room-prefix metadata only.",
  },
} as const satisfies Record<CampusSourceId, CampusSourceRecord>;

export function factEvidence(
  sourceIds: readonly CampusSourceId[],
  confidence: EvidenceConfidence,
  notes?: string,
): FactEvidence {
  const evidence: FactEvidence = {
    sourceIds,
    confidence,
    lastVerified: "2026-08-20",
  };
  if (notes) evidence.notes = notes;
  return evidence;
}

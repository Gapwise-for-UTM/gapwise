import type { SourceMetadata } from "@/features/routing/types";
import { factEvidence, type FactEvidence } from "./provenance.js";

export type EvidenceBackedStringList = {
  values: readonly string[];
  evidence: FactEvidence;
};

export type SharedComplexMetadata = {
  id: string;
  evidence: FactEvidence;
};

export type BuildingConfiguration = {
  code: string;
  name: string;
  category: "academic" | "residence" | "facility";
  aliases?: string[];
  /** Official UTM alpha codes are evidence metadata and do not silently change parser behavior. */
  officialCodes?: EvidenceBackedStringList;
  /** Multiple Gapwise identities may legitimately share one official building code/complex. */
  sharedComplex?: SharedComplexMetadata;
  metadata?: SourceMetadata;
  verifiedRoomFloors?: Record<
    string,
    {
      floor: string;
      metadata: SourceMetadata;
    }
  >;
  roomFloorRule?: {
    kind: "first-digit";
    minimumLength: number;
    metadata: SourceMetadata;
  };
};

const OFFICIAL_ROOM_EXAMPLE_SOURCE = {
  source: "University of Toronto Mississauga public room listings",
  sourceUrl:
    "https://www.utm.utoronto.ca/rgasc/faculty-instructors/programming-instructors/upcoming-events-instructors",
  lastVerified: "2026-08-01",
  verificationStatus: "verified",
} as const satisfies SourceMetadata;

const OFFICIAL_FACILITIES_SOURCE = {
  source: "University of Toronto Mississauga Facilities Management & Planning building list",
  sourceUrl: "https://www.utm.utoronto.ca/facilities/buildings",
  lastVerified: "2026-08-21",
  verificationStatus: "verified",
} as const satisfies SourceMetadata;

const OFFICIAL_CODE_EVIDENCE = factEvidence(
  ["utm-facilities-buildings"],
  "verified",
  "UTM Facilities publishes this alpha building code.",
);

const SHARED_KANEFF_INNOVATION_EVIDENCE = factEvidence(
  ["utm-facilities-buildings"],
  "verified",
  "UTM Facilities assigns both Kaneff Centre and Innovation Complex the KN code and 1833 Inner Circle.",
);

function officialCodes(...values: string[]): EvidenceBackedStringList {
  return { values, evidence: OFFICIAL_CODE_EVIDENCE };
}

function sharedComplex(id: string): SharedComplexMetadata {
  return { id, evidence: SHARED_KANEFF_INNOVATION_EVIDENCE };
}

/**
 * Canonical recognition data for UTM buildings. Presence here establishes
 * identity/search coverage, not surveyed routing, entrance, floor, or
 * accessibility coverage. Official codes are evidence metadata; Gapwise keeps
 * stable internal codes where historical parser/API compatibility requires it.
 */
export const UTM_BUILDINGS: BuildingConfiguration[] = [
  {
    code: "MN",
    name: "Maanjiwe nendamowinan",
    category: "academic",
    aliases: ["MAANJIWE NENDAMOWINAN", "MAANJIWE NENDAMOWINAN BUILDING"],
    officialCodes: officialCodes("MN"),
    roomFloorRule: {
      kind: "first-digit",
      minimumLength: 4,
      metadata: OFFICIAL_ROOM_EXAMPLE_SOURCE,
    },
  },
  {
    code: "DH",
    name: "Deerfield Hall",
    category: "academic",
    aliases: ["DEERFIELD HALL"],
    officialCodes: officialCodes("DH"),
    roomFloorRule: {
      kind: "first-digit",
      minimumLength: 4,
      metadata: {
        ...OFFICIAL_ROOM_EXAMPLE_SOURCE,
        sourceUrl: "https://cs.utm.utoronto.ca/~zingarod/hsws/index.shtml",
      },
    },
  },
  {
    code: "IB",
    name: "Instructional Centre",
    category: "academic",
    aliases: ["INSTRUCTIONAL CENTRE", "INSTRUCTIONAL CENTER", "INSTRUCTIONAL BUILDING"],
    officialCodes: officialCodes("IB"),
    roomFloorRule: {
      kind: "first-digit",
      minimumLength: 3,
      metadata: {
        ...OFFICIAL_ROOM_EXAMPLE_SOURCE,
        sourceUrl: "https://www.utm.utoronto.ca/language-studies/events-2022-2023",
      },
    },
  },
  {
    code: "DV",
    name: "William G. Davis Building",
    category: "academic",
    aliases: ["DAVIS", "DAVIS BUILDING"],
    officialCodes: officialCodes("DV"),
  },
  {
    code: "CCT",
    name: "Communication, Culture and Technology Building",
    category: "academic",
    aliases: ["CC", "CC/CCT", "COMMUNICATION CULTURE AND TECHNOLOGY", "CCT BUILDING"],
    officialCodes: officialCodes("CC"),
  },
  {
    code: "HM",
    name: "Hazel McCallion Academic Learning Centre",
    category: "academic",
    aliases: ["HAZEL MCCALLION", "HAZEL MCCALLION ACADEMIC LEARNING CENTRE"],
    officialCodes: officialCodes("HM"),
  },
  {
    code: "KN",
    name: "Kaneff Centre",
    category: "academic",
    aliases: ["KANEFF", "KANEFF CENTRE"],
    officialCodes: officialCodes("KN"),
    sharedComplex: sharedComplex("kaneff-innovation"),
  },
  {
    code: "IC",
    name: "Innovation Complex",
    category: "academic",
    aliases: ["INNOVATION COMPLEX"],
    officialCodes: officialCodes("KN"),
    sharedComplex: sharedComplex("kaneff-innovation"),
    metadata: OFFICIAL_FACILITIES_SOURCE,
  },
  {
    code: "RAWC",
    name: "Recreation, Athletics and Wellness Centre",
    category: "academic",
    aliases: ["RA", "RA/RAWC", "RECREATION ATHLETICS AND WELLNESS CENTRE"],
    officialCodes: officialCodes("RA"),
  },
  {
    code: "XR",
    name: "Student Centre",
    category: "academic",
    aliases: ["STUDENT CENTRE", "STUDENT CENTER"],
    officialCodes: officialCodes("XR"),
  },
  {
    code: "HB",
    name: "Terrence Donnelly Health Sciences Complex",
    category: "academic",
    aliases: ["HEALTH SCIENCES COMPLEX", "TERRENCE DONNELLY HEALTH SCIENCES COMPLEX"],
    officialCodes: officialCodes("HB"),
  },
  {
    code: "AX",
    name: "Academic Annex",
    category: "academic",
    aliases: ["ACADEMIC ANNEX"],
    officialCodes: officialCodes("AX"),
  },
  {
    code: "WC",
    name: "Alumni House",
    category: "facility",
    aliases: ["ALUMNI HOUSE"],
    officialCodes: officialCodes("WC"),
    metadata: OFFICIAL_FACILITIES_SOURCE,
  },
  {
    code: "CUP",
    name: "Central Utilities Plant",
    category: "facility",
    aliases: ["CENTRAL UTILITIES PLANT"],
    metadata: OFFICIAL_FACILITIES_SOURCE,
  },
  {
    code: "DW",
    name: "Erindale Studio Theatre",
    category: "academic",
    aliases: ["ERINDALE STUDIO THEATRE"],
    officialCodes: officialCodes("DW"),
  },
  {
    code: "FCSH",
    name: "Forensic Crime Scene House",
    category: "academic",
    aliases: ["FORENSIC CRIME SCENE HOUSE", "FORENSIC ANTHROPOLOGY FIELD SCHOOL", "CSI HOUSE"],
    metadata: OFFICIAL_FACILITIES_SOURCE,
  },
  {
    code: "GF",
    name: "Grounds Building",
    category: "facility",
    aliases: ["GROUNDS BUILDING"],
    officialCodes: officialCodes("GF"),
    metadata: OFFICIAL_FACILITIES_SOURCE,
  },
  {
    code: "NSB",
    name: "New Science Building",
    category: "academic",
    aliases: ["NEW SCIENCE BUILDING", "NEW SCIENCE BUILDING UTM", "SCIENCE BUILDING", "SB"],
    metadata: OFFICIAL_FACILITIES_SOURCE,
  },
  {
    code: "PL",
    name: "Paleomagnetism Lab",
    category: "academic",
    aliases: ["PALEOMAGNETISM LAB", "PALEOMAGNETISM LABORATORY"],
    metadata: OFFICIAL_FACILITIES_SOURCE,
  },
  {
    code: "BG",
    name: "Research Greenhouse",
    category: "academic",
    aliases: ["RESEARCH GREENHOUSE"],
    officialCodes: officialCodes("BG"),
    metadata: OFFICIAL_FACILITIES_SOURCE,
  },
  {
    code: "LH",
    name: "The Principal's Residence: Lislehurst",
    category: "facility",
    aliases: ["LISLEHURST", "PRINCIPAL'S RESIDENCE", "THE PRINCIPALS RESIDENCE LISLEHURST"],
    metadata: OFFICIAL_FACILITIES_SOURCE,
  },
  {
    code: "EH",
    name: "Erindale Hall",
    category: "residence",
    aliases: ["ERINDALE HALL", "ERINDALE HALL RESIDENCE"],
  },
  {
    code: "LL",
    name: "Leacock Lane",
    category: "residence",
    aliases: ["R", "LEACOCK LANE", "LEACOCK LANE RESIDENCE"],
    officialCodes: officialCodes("R"),
  },
  {
    code: "MV",
    name: "MaGrath Valley",
    category: "residence",
    aliases: ["MAGRATH VALLEY", "MAGRATH VALLEY RESIDENCE"],
  },
  {
    code: "MC",
    name: "McLuhan Court",
    category: "residence",
    aliases: ["MCLUHAN COURT", "MCLUHAN COURT RESIDENCE"],
  },
  {
    code: "OPH",
    name: "Oscar Peterson Hall",
    category: "residence",
    aliases: ["OSCAR PETERSON HALL"],
  },
  {
    code: "PP",
    name: "Putnam Place",
    category: "residence",
    aliases: ["PUTNAM PLACE", "PUTNAM PLACE RESIDENCE"],
  },
  {
    code: "RIH",
    name: "Roy Ivor Hall",
    category: "residence",
    aliases: ["ROY IVOR HALL", "ROY IVOR HALL RESIDENCE"],
  },
  {
    code: "SW",
    name: "Schreiberwood",
    category: "residence",
    aliases: ["SCHREIBERWOOD", "SCHREIBERWOOD RESIDENCE"],
  },
  {
    code: "NRB",
    name: "New Residence Building",
    category: "residence",
    aliases: ["NEW RESIDENCE BUILDING"],
    metadata: {
      source: "UTM Student Housing & Residence Life",
      sourceUrl: "https://www.utm.utoronto.ca/housing/new-residence-building",
      lastVerified: "2026-08-10",
      verificationStatus: "verified",
    },
  },
];

export const UTM_RESIDENCES = UTM_BUILDINGS.filter((building) => building.category === "residence");

export function getRecognizedBuilding(code: string): BuildingConfiguration | null {
  const normalized = code.trim().toUpperCase();
  return UTM_BUILDINGS.find((building) => building.code === normalized) ?? null;
}

const PUBLIC_BUILDING_CODE_ALIASES: Record<string, string> = {
  CC: "CCT",
  RA: "RAWC",
  R: "LL",
  SB: "NSB",
};

export function normalizePublicBuildingCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return (
    getRecognizedBuilding(normalized)?.code ?? PUBLIC_BUILDING_CODE_ALIASES[normalized] ?? null
  );
}

import type { SourceMetadata } from "@/features/routing/types";

export type BuildingConfiguration = {
  code: string;
  name: string;
  category: "academic" | "residence";
  aliases?: string[];
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

/**
 * Recognition data only. Presence here does not imply that coordinates, paths,
 * entrances, floors, or accessibility have been surveyed for routing.
 */
export const UTM_BUILDINGS: BuildingConfiguration[] = [
  {
    code: "MN",
    name: "Maanjiwe nendamowinan",
    category: "academic",
    aliases: ["MAANJIWE NENDAMOWINAN", "MAANJIWE NENDAMOWINAN BUILDING"],
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
  },
  {
    code: "CCT",
    name: "Communication, Culture and Technology Building",
    category: "academic",
    aliases: ["CC", "CC/CCT", "COMMUNICATION CULTURE AND TECHNOLOGY", "CCT BUILDING"],
  },
  {
    code: "HM",
    name: "Hazel McCallion Academic Learning Centre",
    category: "academic",
    aliases: ["HAZEL MCCALLION", "HAZEL MCCALLION ACADEMIC LEARNING CENTRE"],
  },
  {
    code: "KN",
    name: "Kaneff Centre",
    category: "academic",
    aliases: ["KANEFF", "KANEFF CENTRE"],
  },
  {
    code: "RAWC",
    name: "Recreation, Athletics and Wellness Centre",
    category: "academic",
    aliases: ["RA", "RA/RAWC", "RECREATION ATHLETICS AND WELLNESS CENTRE"],
  },
  {
    code: "XR",
    name: "Student Centre",
    category: "academic",
    aliases: ["STUDENT CENTRE", "STUDENT CENTER"],
  },
  {
    code: "HB",
    name: "Terrence Donnelly Health Sciences Complex",
    category: "academic",
    aliases: ["HEALTH SCIENCES COMPLEX", "TERRENCE DONNELLY HEALTH SCIENCES COMPLEX"],
  },
  {
    code: "AX",
    name: "Academic Annex",
    category: "academic",
    aliases: ["ACADEMIC ANNEX"],
  },
  {
    code: "DW",
    name: "Erindale Studio Theatre",
    category: "academic",
    aliases: ["ERINDALE STUDIO THEATRE"],
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
    aliases: ["LEACOCK LANE", "LEACOCK LANE RESIDENCE"],
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

export function normalizePublicBuildingCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return getRecognizedBuilding(value)?.code ?? null;
}

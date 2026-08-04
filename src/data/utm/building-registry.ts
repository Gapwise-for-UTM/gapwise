import type { SourceMetadata } from "@/features/routing/types";

export type BuildingConfiguration = {
  code: string;
  name: string;
  aliases?: string[];
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
  { code: "DV", name: "William G. Davis Building", aliases: ["DAVIS", "DAVIS BUILDING"] },
  {
    code: "CCT",
    name: "Communication, Culture and Technology Building",
    aliases: ["CC", "CC/CCT", "COMMUNICATION CULTURE AND TECHNOLOGY", "CCT BUILDING"],
  },
  {
    code: "HM",
    name: "Hazel McCallion Academic Learning Centre",
    aliases: ["HAZEL MCCALLION", "HAZEL MCCALLION ACADEMIC LEARNING CENTRE"],
  },
  { code: "KN", name: "Kaneff Centre", aliases: ["KANEFF", "KANEFF CENTRE"] },
  {
    code: "RAWC",
    name: "Recreation, Athletics and Wellness Centre",
    aliases: ["RA", "RA/RAWC", "RECREATION ATHLETICS AND WELLNESS CENTRE"],
  },
  { code: "XR", name: "UTM location XR" },
  { code: "HB", name: "UTM location HB" },
  { code: "AX", name: "UTM location AX" },
  { code: "DW", name: "UTM location DW" },
];

export function getRecognizedBuilding(code: string): BuildingConfiguration | null {
  const normalized = code.trim().toUpperCase();
  return UTM_BUILDINGS.find((building) => building.code === normalized) ?? null;
}

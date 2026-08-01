import type { SourceMetadata, VerificationStatus } from "./types";

export type LocationStatus = "known" | "tba" | "online" | "unknown";

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

export type LocationResolution = {
  raw: string;
  buildingCode: string | null;
  buildingName: string | null;
  room: string | null;
  status: LocationStatus;
  buildingVerification: VerificationStatus;
  floor: string | null;
  floorVerification: VerificationStatus;
  warning: string | null;
};

const OFFICIAL_ROOM_EXAMPLE_SOURCE = {
  source: "University of Toronto Mississauga public room listings",
  sourceUrl:
    "https://www.utm.utoronto.ca/rgasc/faculty-instructors/programming-instructors/upcoming-events-instructors",
  lastVerified: "2026-08-01",
  verificationStatus: "verified",
} as const satisfies SourceMetadata;

export const UTM_BUILDINGS: BuildingConfiguration[] = [
  {
    code: "MN",
    name: "Maanjiwe nendamowinan",
    roomFloorRule: {
      kind: "first-digit",
      minimumLength: 4,
      metadata: OFFICIAL_ROOM_EXAMPLE_SOURCE,
    },
  },
  {
    code: "DH",
    name: "Deerfield Hall",
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
    aliases: ["INSTRUCTIONAL BUILDING"],
    roomFloorRule: {
      kind: "first-digit",
      minimumLength: 3,
      metadata: {
        ...OFFICIAL_ROOM_EXAMPLE_SOURCE,
        sourceUrl: "https://www.utm.utoronto.ca/language-studies/events-2022-2023",
      },
    },
  },
];

function cleanLocation(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

function findBuilding(
  codeOrAlias: string,
  buildings: BuildingConfiguration[],
): BuildingConfiguration | null {
  const needle = codeOrAlias.toUpperCase();
  return (
    buildings.find(
      (building) => building.code === needle || building.aliases?.some((alias) => alias === needle),
    ) ?? null
  );
}

export function resolveAcornLocation(
  raw: string | null | undefined,
  buildings: BuildingConfiguration[] = UTM_BUILDINGS,
): LocationResolution {
  const value = cleanLocation(raw);
  if (!value) {
    return {
      raw: value,
      buildingCode: null,
      buildingName: null,
      room: null,
      status: "unknown",
      buildingVerification: "unknown",
      floor: null,
      floorVerification: "unknown",
      warning: "No location was provided.",
    };
  }
  if (/\bonline\b|\bremote\b|\bvirtual\b/i.test(value)) {
    return {
      raw: value,
      buildingCode: null,
      buildingName: null,
      room: null,
      status: "online",
      buildingVerification: "unknown",
      floor: null,
      floorVerification: "unknown",
      warning: "This meeting is online; no physical route is needed.",
    };
  }
  if (/^ZZ(?:\s|$)|\bTBA\b|\bN\/?A\b/i.test(value)) {
    return {
      raw: value,
      buildingCode: null,
      buildingName: null,
      room: null,
      status: "tba",
      buildingVerification: "unknown",
      floor: null,
      floorVerification: "unknown",
      warning: "The physical location is still TBA.",
    };
  }

  const match = value.match(/^([A-Z]{2,6})(?:[-\s]+(.+))?$/i);
  if (!match) {
    return {
      raw: value,
      buildingCode: null,
      buildingName: null,
      room: null,
      status: "unknown",
      buildingVerification: "unknown",
      floor: null,
      floorVerification: "unknown",
      warning: `“${value}” could not be matched to a campus building.`,
    };
  }

  const parsedCode = match[1]!.toUpperCase();
  const room = match[2]?.trim() || null;
  const building = findBuilding(parsedCode, buildings);
  let floor: string | null = null;
  let floorVerification: VerificationStatus = "unknown";
  const verifiedFloor = room ? building?.verifiedRoomFloors?.[room.toUpperCase()] : undefined;
  if (verifiedFloor) {
    floor = verifiedFloor.floor;
    floorVerification = "verified";
  } else if (building?.roomFloorRule && room) {
    const compactRoom = room.replace(/[^A-Z0-9]/gi, "");
    if (
      building.roomFloorRule.kind === "first-digit" &&
      compactRoom.length >= building.roomFloorRule.minimumLength &&
      /^\d/.test(compactRoom)
    ) {
      floor = compactRoom[0]!;
      // A numbering convention supports an inference, not a verified room position.
      floorVerification = "inferred";
    }
  }

  return {
    raw: value,
    buildingCode: building?.code ?? parsedCode,
    buildingName: building?.name ?? null,
    room,
    status: "known",
    buildingVerification: building ? "verified" : "unknown",
    floor,
    floorVerification,
    warning: building
      ? floorVerification === "inferred"
        ? `Floor ${floor} is inferred from ${building.code}'s room-numbering convention.`
        : null
      : `Building code “${parsedCode}” is not in the verified campus dataset.`,
  };
}

export function resolveMeetingLocation(meeting: {
  buildingCode: string | null;
  room: string | null;
  locationUnknown: boolean;
}): LocationResolution {
  if (meeting.locationUnknown && !meeting.buildingCode && !meeting.room) {
    return resolveAcornLocation("");
  }
  return resolveAcornLocation([meeting.buildingCode, meeting.room].filter(Boolean).join(" "));
}

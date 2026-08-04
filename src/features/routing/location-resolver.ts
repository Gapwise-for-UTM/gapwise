import { UTM_BUILDINGS, type BuildingConfiguration } from "@/data/utm/building-registry";
import surveyRoutingData from "@/data/utm/generated/survey-routing.json";
import { hasVerifiedRoutingData } from "@/data/utm/routing-buildings";
import type { RoutingNode, VerificationStatus } from "./types";

export type { BuildingConfiguration } from "@/data/utm/building-registry";

export type LocationStatus = "known" | "tba" | "online" | "unknown";

export type LocationResolution = {
  raw: string;
  buildingCode: string | null;
  buildingName: string | null;
  room: string | null;
  status: LocationStatus;
  buildingRecognition: "recognized" | "unrecognized";
  routingDataStatus: "verified" | "unverified";
  floor: string | null;
  floorVerification: VerificationStatus;
  warning: string | null;
};

const SURVEY_ROUTING_BUILDINGS = new Set(
  (surveyRoutingData.nodes as RoutingNode[])
    .filter((node) => node.metadata?.verificationStatus === "verified")
    .map((node) => node.buildingCode)
    .filter((code): code is string => Boolean(code)),
);

function routingDataIsVerified(buildingCode: string): boolean {
  return hasVerifiedRoutingData(buildingCode) || SURVEY_ROUTING_BUILDINGS.has(buildingCode);
}

function cleanLocation(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

function findBuildingAtStart(
  location: string,
  buildings: BuildingConfiguration[],
): { building: BuildingConfiguration; room: string | null } | null {
  const normalized = location
    .toUpperCase()
    .replace(/[,._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const candidates = buildings
    .flatMap((building) =>
      [building.code, ...(building.aliases ?? [])].map((key) => ({ building, key })),
    )
    .sort((a, b) => b.key.length - a.key.length);
  for (const candidate of candidates) {
    const key = candidate.key
      .toUpperCase()
      .replace(/[,._]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (normalized === key) return { building: candidate.building, room: null };
    if (normalized.startsWith(`${key} `) || normalized.startsWith(`${key}-`)) {
      return {
        building: candidate.building,
        room: normalized.slice(key.length).replace(/^[\s-]+/, "") || null,
      };
    }
  }
  return null;
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
      buildingRecognition: "unrecognized",
      routingDataStatus: "unverified",
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
      buildingRecognition: "unrecognized",
      routingDataStatus: "unverified",
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
      buildingRecognition: "unrecognized",
      routingDataStatus: "unverified",
      floor: null,
      floorVerification: "unknown",
      warning: "The physical location is still TBA.",
    };
  }

  const recognized = findBuildingAtStart(value, buildings);
  const match = recognized ? null : value.match(/^([A-Z]{2,6})(?:[-\s]+(.+))?$/i);
  if (!recognized && !match) {
    return {
      raw: value,
      buildingCode: null,
      buildingName: null,
      room: null,
      status: "unknown",
      buildingRecognition: "unrecognized",
      routingDataStatus: "unverified",
      floor: null,
      floorVerification: "unknown",
      warning: `“${value}” could not be matched to a campus building.`,
    };
  }

  const parsedCode = recognized?.building.code ?? match![1]!.toUpperCase();
  const room = recognized?.room ?? match![2]?.trim() ?? null;
  const building = recognized?.building ?? null;
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
    status: building ? "known" : "unknown",
    buildingRecognition: building ? "recognized" : "unrecognized",
    routingDataStatus: building && routingDataIsVerified(building.code) ? "verified" : "unverified",
    floor,
    floorVerification,
    warning: building
      ? !routingDataIsVerified(building.code)
        ? `${building.code} is recognized as a UTM building, but verified routing data is unavailable.`
        : floorVerification === "inferred"
          ? `Floor ${floor} is inferred from ${building.code}'s room-numbering convention.`
          : null
      : `Building code “${parsedCode}” is not in the recognized UTM building registry.`,
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

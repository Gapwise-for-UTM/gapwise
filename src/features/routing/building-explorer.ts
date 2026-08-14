import {
  UTM_BUILDINGS,
  getRecognizedBuilding,
  type BuildingConfiguration,
} from "@/data/utm/building-registry";
import {
  getCampusBuilding,
  type BuildingEntrance,
  type CampusBuilding,
} from "@/data/utm/routing-buildings";
import { getCampusBuildingFootprint } from "@/data/utm/building-footprints";
import { resolveAcornLocation } from "./location-resolver";
import type { VerificationStatus } from "./types";

export type BuildingSearchResult = {
  building: BuildingConfiguration;
  campus: CampusBuilding | null;
  room: string | null;
  floor: string | null;
  floorVerification: VerificationStatus;
};

export type BuildingExplorerDetails = {
  building: BuildingConfiguration;
  campus: CampusBuilding | null;
  verifiedEntrances: number;
  inferredApproaches: number;
  accessibleEntrances: number;
  accessibilityUnknown: number;
  latestVerificationDate: string | null;
};

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function compact(value: string) {
  return normalizeSearchText(value).replace(/\s/g, "");
}

function searchScore(building: BuildingConfiguration, query: string): number | null {
  const normalized = normalizeSearchText(query);
  const compactQuery = compact(query);
  if (!normalized) return null;

  const labels = [building.code, building.name, ...(building.aliases ?? [])];
  let best = Number.POSITIVE_INFINITY;
  for (const [index, label] of labels.entries()) {
    const normalizedLabel = normalizeSearchText(label);
    const compactLabel = compact(label);
    if (compactLabel === compactQuery) best = Math.min(best, index === 0 ? 0 : 1);
    else if (compactLabel.startsWith(compactQuery)) best = Math.min(best, index === 0 ? 2 : 3);
    else if (normalizedLabel.includes(normalized)) best = Math.min(best, 4);
    else {
      const queryWords = normalized.split(" ");
      const labelWords = normalizedLabel.split(" ");
      if (queryWords.every((word) => labelWords.some((candidate) => candidate.startsWith(word)))) {
        best = Math.min(best, 5);
      }
    }
  }
  return Number.isFinite(best) ? best : null;
}

function resultFor(
  building: BuildingConfiguration,
  room: string | null = null,
  floor: string | null = null,
  floorVerification: VerificationStatus = "unknown",
): BuildingSearchResult | null {
  if (!getCampusBuildingFootprint(building.code)) return null;
  const campus = getCampusBuilding(building.code);
  return { building, campus, room, floor, floorVerification };
}

/** Local-only UTM building search. Room-like queries resolve to a building, never a room pin. */
export function searchCampusBuildings(query: string, limit = 6): BuildingSearchResult[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const location = resolveAcornLocation(query);
  if (location.status === "known" && location.buildingCode) {
    const building = getRecognizedBuilding(location.buildingCode);
    const direct = building
      ? resultFor(building, location.room, location.floor, location.floorVerification)
      : null;
    if (direct) return [direct];
  }

  return UTM_BUILDINGS.map((building) => ({ building, score: searchScore(building, query) }))
    .filter(
      (candidate): candidate is { building: BuildingConfiguration; score: number } =>
        candidate.score !== null,
    )
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.building.code.localeCompare(b.building.code, "en", { sensitivity: "base" }),
    )
    .flatMap(({ building }) => {
      const result = resultFor(building);
      return result ? [result] : [];
    })
    .slice(0, Math.max(0, limit));
}

function latestDate(entrances: BuildingEntrance[]): string | null {
  const dates = entrances
    .map((entrance) => entrance.metadata.lastVerified)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  return dates.at(-1) ?? null;
}

export function getBuildingExplorerDetails(code: string | null): BuildingExplorerDetails | null {
  if (!code) return null;
  const building = getRecognizedBuilding(code);
  const campus = getCampusBuilding(code);
  if (!building || !getCampusBuildingFootprint(code)) return null;
  const entrances = campus?.entrances ?? [];
  return {
    building,
    campus,
    verifiedEntrances: entrances.filter(
      (entrance) => entrance.metadata.verificationStatus === "verified",
    ).length,
    inferredApproaches: entrances.filter(
      (entrance) => entrance.metadata.verificationStatus === "inferred",
    ).length,
    accessibleEntrances: entrances.filter((entrance) => entrance.accessibility === "accessible")
      .length,
    accessibilityUnknown: entrances.filter((entrance) => entrance.accessibility === "unknown")
      .length,
    latestVerificationDate: latestDate(entrances),
  };
}

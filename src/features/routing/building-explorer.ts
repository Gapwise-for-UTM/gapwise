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
import {
  campusBuildingConfigurations,
  getBuildingFootprintForCampus,
  resolveCampusBuildingLocation,
  type GapwiseCampusId,
} from "@/data/campuses";
import { officialEntranceCandidatesForBuilding } from "@/data/utm/official-entrance-candidates";
import { resolveAcornLocation } from "./location-resolver";
import type { VerificationStatus } from "./types";

export type BuildingSearchResult = {
  building: BuildingConfiguration;
  campus: CampusBuilding | null;
  room: string | null;
  floor: string | null;
  floorVerification: VerificationStatus;
};

export type EntranceCoverageStatus = "unmapped" | "partial" | "complete";

export type BuildingExplorerDetails = {
  building: BuildingConfiguration;
  campus: CampusBuilding | null;
  mappedEntrances: number;
  verifiedEntrances: number;
  inferredApproaches: number;
  accessibleEntrances: number;
  accessibilityUnknown: number;
  officialBarrierFreeEntranceInstances: number;
  coverageStatus: EntranceCoverageStatus;
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
  campusId: GapwiseCampusId = "utm",
): BuildingSearchResult | null {
  if (!getBuildingFootprintForCampus(campusId, building.code)) return null;
  const campus = campusId === "utm" ? getCampusBuilding(building.code) : null;
  return { building, campus, room, floor, floorVerification };
}

/** Campus-scoped building search. Room-like queries resolve to a building, never a room pin. */
export function searchCampusBuildings(
  query: string,
  limit = 6,
  campusId: GapwiseCampusId = "utm",
): BuildingSearchResult[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  if (campusId === "utm") {
    const location = resolveAcornLocation(query);
    if (location.status === "known" && location.buildingCode) {
      const building = getRecognizedBuilding(location.buildingCode);
      const direct = building
        ? resultFor(building, location.room, location.floor, location.floorVerification, campusId)
        : null;
      if (direct) return [direct];
    }
  } else {
    const location = resolveCampusBuildingLocation(campusId, query);
    if (location) {
      const compactRoom = location.room?.replace(/[^A-Z0-9]/gi, "").toUpperCase() ?? "";
      const floor =
        compactRoom.match(/^(LL|L|G)/)?.[1] ??
        compactRoom.match(/^(\d)\d{2,3}[A-Z]?$/)?.[1] ??
        null;
      const direct = resultFor(
        location.building,
        location.room,
        floor,
        floor ? "inferred" : "unknown",
        campusId,
      );
      if (direct) return [direct];
    }
  }

  const buildings = campusId === "utm" ? UTM_BUILDINGS : campusBuildingConfigurations(campusId);
  return buildings
    .map((building) => ({ building, score: searchScore(building, query) }))
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
      const result = resultFor(building, null, null, "unknown", campusId);
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

function currentCoverageStatus(mappedEntrances: number): EntranceCoverageStatus {
  // Fail closed. "complete" is reserved for a future explicit completeness record; the current
  // dataset only proves individual mapped points, never that every building entrance is inventoried.
  return mappedEntrances === 0 ? "unmapped" : "partial";
}

export function getBuildingExplorerDetails(
  code: string | null,
  campusId: GapwiseCampusId = "utm",
): BuildingExplorerDetails | null {
  if (!code) return null;
  const building =
    campusId === "utm"
      ? getRecognizedBuilding(code)
      : campusBuildingConfigurations(campusId).find(
          (candidate) => candidate.code.toUpperCase() === code.toUpperCase(),
        ) ?? null;
  if (!building || !getBuildingFootprintForCampus(campusId, code)) return null;

  if (campusId !== "utm") {
    return {
      building,
      campus: null,
      mappedEntrances: 0,
      verifiedEntrances: 0,
      inferredApproaches: 0,
      accessibleEntrances: 0,
      accessibilityUnknown: 0,
      officialBarrierFreeEntranceInstances: 0,
      coverageStatus: "unmapped",
      latestVerificationDate: null,
    };
  }

  const campus = getCampusBuilding(code);
  const entrances = campus?.entrances ?? [];
  const mappedEntrances = entrances.filter((entrance) => entrance.kind === "entrance").length;
  const officialBarrierFreeEntranceInstances = officialEntranceCandidatesForBuilding(code)
    .filter((candidate) => candidate.kind === "exterior_entrance")
    .reduce((count, candidate) => count + candidate.instances, 0);

  return {
    building,
    campus,
    mappedEntrances,
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
    officialBarrierFreeEntranceInstances,
    coverageStatus: currentCoverageStatus(mappedEntrances),
    latestVerificationDate: latestDate(entrances),
  };
}

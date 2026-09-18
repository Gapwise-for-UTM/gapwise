import type { BuildingConfiguration } from "@/data/utm/building-registry";
import { UTM_BUILDINGS } from "@/data/utm/building-registry";
import {
  CAMPUS_BUILDING_FOOTPRINTS as UTM_FOOTPRINTS,
  buildingCodeAtCoordinate as utmBuildingCodeAtCoordinate,
  getCampusBuildingFootprint as getUtmBuildingFootprint,
  representativePointForFootprint as representativeUtmPoint,
  type FootprintCoordinate,
} from "@/data/utm/building-footprints";
import type { Campus } from "@/lib/timetable-types";
import utsgBuildingsRaw from "./utsg/buildings.json?raw";
import utsgFootprintsRaw from "./utsg/buildings.geojson?raw";
import utscBuildingsRaw from "./utsc/buildings.json?raw";
import utscFootprintsRaw from "./utsc/buildings.geojson?raw";

export type GapwiseCampusId = "utm" | "utsg" | "utsc";

type ExternalBuildingRecord = {
  id: string;
  campus: "utsg" | "utsc";
  code: string;
  name: string;
  category: "academic" | "residence" | "facility";
  aliases?: string[];
  timetableCodes?: string[];
  facilityCodes?: string[];
  status?: string;
};

type ExternalRegistry = {
  campus: "utsg" | "utsc";
  generatedAt: string;
  buildings: ExternalBuildingRecord[];
};

export type CampusFootprintGeometry =
  | { type: "Polygon"; coordinates: FootprintCoordinate[][] }
  | { type: "MultiPolygon"; coordinates: FootprintCoordinate[][][] };

export type CampusFootprintFeature = {
  type: "Feature";
  id?: string;
  properties: {
    campus?: GapwiseCampusId;
    buildingId?: string;
    buildingCode: string;
    name: string;
    timetableCodes?: string[];
    facilityCodes?: string[];
    verificationStatus?: string;
    [key: string]: unknown;
  };
  geometry: CampusFootprintGeometry;
};

export type CampusFootprintCollection = {
  type: "FeatureCollection";
  features: CampusFootprintFeature[];
  [key: string]: unknown;
};

const utsgRegistry = JSON.parse(utsgBuildingsRaw) as ExternalRegistry;
const utscRegistry = JSON.parse(utscBuildingsRaw) as ExternalRegistry;
const utsgFootprints = JSON.parse(utsgFootprintsRaw) as CampusFootprintCollection;
const utscFootprints = JSON.parse(utscFootprintsRaw) as CampusFootprintCollection;

const EXTERNAL_REGISTRIES = {
  utsg: utsgRegistry,
  utsc: utscRegistry,
} as const;

const EXTERNAL_FOOTPRINTS = {
  utsg: utsgFootprints,
  utsc: utscFootprints,
} as const;

const CAMPUS_FALLBACK_BOUNDS: Record<GapwiseCampusId, [[number, number], [number, number]]> = {
  utm: [
    [-79.6765, 43.5415],
    [-79.6535, 43.5585],
  ],
  utsg: [
    [-79.4215, 43.645],
    [-79.365, 43.6825],
  ],
  utsc: [
    [-79.205, 43.772],
    [-79.165, 43.7995],
  ],
};

export const CAMPUS_LABELS: Record<GapwiseCampusId, string> = {
  utm: "University of Toronto Mississauga",
  utsg: "University of Toronto St. George",
  utsc: "University of Toronto Scarborough",
};

export const CAMPUS_SHORT_LABELS: Record<GapwiseCampusId, string> = {
  utm: "UTM",
  utsg: "UTSG",
  utsc: "UTSC",
};

export function gapwiseCampusIdForCampus(campus: Campus | undefined): GapwiseCampusId | null {
  if (campus === "UTM") return "utm";
  if (campus === "UTSG") return "utsg";
  if (campus === "UTSC") return "utsc";
  return null;
}

function normalizeText(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[,._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function externalConfigurations(campusId: "utsg" | "utsc"): BuildingConfiguration[] {
  return EXTERNAL_REGISTRIES[campusId].buildings
    .filter((building) => building.status !== "inactive")
    .map((building) => ({
      code: building.code.toUpperCase(),
      name: building.name,
      category: building.category,
      aliases: unique([
        ...(building.aliases ?? []),
        ...(building.timetableCodes ?? []),
        ...(building.facilityCodes ?? []),
      ]),
    }));
}

const CONFIGURATIONS: Record<GapwiseCampusId, BuildingConfiguration[]> = {
  utm: UTM_BUILDINGS,
  utsg: externalConfigurations("utsg"),
  utsc: externalConfigurations("utsc"),
};

// U of T Student Life's current St. George residence map groups these canonical
// buildings as student residences. Some are mixed-use college buildings, so residence
// membership is intentionally kept separate from the single building category field.
// Source: https://studentlife.utoronto.ca/wp-content/uploads/Housing-Map.pdf
const UTSG_RESIDENCE_CODES = new Set([
  "013", // Whitney Hall
  "029", // Sir Daniel Wilson Residence
  "064", // Graduate House
  "101", // Morrison Hall
  "131", // New College III / 45 Willcocks
  "133", // Innis College Student Residence
  "158", // Chestnut Residence
  "505", // Burwash Residence (Lower Houses)
  "505A", // Burwash Residence (Upper Houses)
  "506", // Annesley Hall
  "508", // Margaret Addison Hall
  "518", // Rowell Jackman Hall
  "575", // Knox College
  "608", // St. Hilda's College
  "790", // University Family Housing, 30 Charles
  "791", // University Family Housing, 35 Charles
  "BR", // Brennan Hall, St. Michael's College
  "TC", // Trinity College
  "WE", // Wetmore Hall
  "WI", // Wilson Hall
  "WO", // Woodsworth College Residence
]);

export function campusResidenceBuildings(campusId: GapwiseCampusId): BuildingConfiguration[] {
  if (campusId === "utsg") {
    return CONFIGURATIONS.utsg.filter((building) => UTSG_RESIDENCE_CODES.has(building.code));
  }
  return CONFIGURATIONS[campusId].filter((building) => building.category === "residence");
}

export function getResidenceBuildingForCampus(
  campusId: GapwiseCampusId,
  code: string | null | undefined,
): BuildingConfiguration | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return (
    campusResidenceBuildings(campusId).find(
      (building) => building.code.toUpperCase() === normalized,
    ) ?? null
  );
}

export function campusBuildingConfigurations(campusId: GapwiseCampusId) {
  return CONFIGURATIONS[campusId];
}

export function getCampusBuildingIdentity(campusId: GapwiseCampusId, value: string | null) {
  if (!value) return null;
  const normalized = normalizeText(value);
  return (
    CONFIGURATIONS[campusId].find((building) =>
      [building.code, ...(building.aliases ?? [])].some(
        (candidate) => normalizeText(candidate) === normalized,
      ),
    ) ?? null
  );
}

export function resolveCampusBuildingLocation(
  campusId: GapwiseCampusId,
  raw: string | null | undefined,
): { building: BuildingConfiguration; room: string | null } | null {
  const normalized = normalizeText(raw ?? "");
  if (!normalized) return null;
  const candidates = CONFIGURATIONS[campusId]
    .flatMap((building) =>
      [building.code, ...(building.aliases ?? []), building.name].map((key) => ({
        building,
        key: normalizeText(key),
      })),
    )
    .filter((candidate) => candidate.key)
    .sort((a, b) => b.key.length - a.key.length);

  for (const candidate of candidates) {
    if (normalized === candidate.key) return { building: candidate.building, room: null };
    if (normalized.startsWith(`${candidate.key} `) || normalized.startsWith(`${candidate.key}-`)) {
      return {
        building: candidate.building,
        room: normalized.slice(candidate.key.length).replace(/^[\s-]+/, "") || null,
      };
    }
  }
  return null;
}

function externalFootprints(campusId: "utsg" | "utsc") {
  return EXTERNAL_FOOTPRINTS[campusId].features;
}

export function campusFootprintCollection(campusId: GapwiseCampusId): CampusFootprintCollection {
  if (campusId === "utm") {
    return UTM_FOOTPRINTS as unknown as CampusFootprintCollection;
  }
  return EXTERNAL_FOOTPRINTS[campusId];
}

export function getBuildingFootprintForCampus(
  campusId: GapwiseCampusId,
  code: string | null,
): CampusFootprintFeature | null {
  if (!code) return null;
  if (campusId === "utm") {
    return getUtmBuildingFootprint(code) as unknown as CampusFootprintFeature | null;
  }
  const identity = getCampusBuildingIdentity(campusId, code);
  if (!identity) return null;
  return (
    externalFootprints(campusId).find(
      (feature) => feature.properties.buildingCode.toUpperCase() === identity.code.toUpperCase(),
    ) ?? null
  );
}

function geometryPolygons(geometry: CampusFootprintGeometry): FootprintCoordinate[][][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

export function campusFootprintGeometryPoints(geometry: CampusFootprintGeometry) {
  return geometryPolygons(geometry).flat(2) as FootprintCoordinate[];
}

function pointOnSegment(
  point: FootprintCoordinate,
  start: FootprintCoordinate,
  end: FootprintCoordinate,
) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const squaredLength = dx * dx + dy * dy;
  if (squaredLength <= 1e-24) {
    const pointDx = point[0] - start[0];
    const pointDy = point[1] - start[1];
    return pointDx * pointDx + pointDy * pointDy <= 1e-24;
  }
  const cross = (point[1] - start[1]) * dx - (point[0] - start[0]) * dy;
  if (Math.abs(cross) > 1e-11) return false;
  const dot = (point[0] - start[0]) * dx + (point[1] - start[1]) * dy;
  if (dot < 0) return false;
  return dot <= squaredLength;
}

function pointInRing(point: FootprintCoordinate, ring: FootprintCoordinate[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index]!;
    const previousPoint = ring[previous]!;
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const [x, y] = point;
    const [xi, yi] = currentPoint;
    const [xj, yj] = previousPoint;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point: FootprintCoordinate, geometry: CampusFootprintGeometry) {
  return geometryPolygons(geometry).some((polygon) => {
    const outer = polygon[0];
    if (!outer || !pointInRing(point, outer)) return false;
    return !polygon.slice(1).some((hole) => pointInRing(point, hole));
  });
}

export function buildingCodeAtCampusCoordinate(
  campusId: GapwiseCampusId,
  point: FootprintCoordinate,
) {
  if (campusId === "utm") return utmBuildingCodeAtCoordinate(point);
  const matches = externalFootprints(campusId).filter((feature) =>
    pointInGeometry(point, feature.geometry),
  );
  return matches.length === 1 ? matches[0]!.properties.buildingCode : null;
}

function featureBounds(feature: CampusFootprintFeature) {
  const points = campusFootprintGeometryPoints(feature.geometry);
  if (!points.length) return null;
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  }
  return [
    [west, south],
    [east, north],
  ] as [[number, number], [number, number]];
}

export function representativePointForCampusFootprint(
  campusId: GapwiseCampusId,
  feature: CampusFootprintFeature,
): FootprintCoordinate | null {
  if (campusId === "utm") {
    return representativeUtmPoint(feature as never);
  }
  const bounds = featureBounds(feature);
  if (!bounds) return null;
  const [[west, south], [east, north]] = bounds;
  const center: FootprintCoordinate = [(west + east) / 2, (south + north) / 2];
  if (pointInGeometry(center, feature.geometry)) return center;
  for (let row = 1; row < 30; row += 1) {
    for (let column = 1; column < 30; column += 1) {
      const point: FootprintCoordinate = [
        west + ((east - west) * column) / 30,
        south + ((north - south) * row) / 30,
      ];
      if (pointInGeometry(point, feature.geometry)) return point;
    }
  }
  return campusFootprintGeometryPoints(feature.geometry)[0] ?? null;
}

export function campusCameraBounds(
  campusId: GapwiseCampusId,
): [[number, number], [number, number]] {
  const features = campusFootprintCollection(campusId).features;
  const points = features.flatMap((feature) => campusFootprintGeometryPoints(feature.geometry));
  if (!points.length) return CAMPUS_FALLBACK_BOUNDS[campusId];
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  }
  const longitudePadding = Math.max((east - west) * 0.08, 0.001);
  const latitudePadding = Math.max((north - south) * 0.08, 0.001);
  return [
    [west - longitudePadding, south - latitudePadding],
    [east + longitudePadding, north + latitudePadding],
  ];
}

export function campusCenter(campusId: GapwiseCampusId): [number, number] {
  const [[west, south], [east, north]] = campusCameraBounds(campusId);
  return [(west + east) / 2, (south + north) / 2];
}

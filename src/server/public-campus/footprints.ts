import { readFileSync } from "node:fs";
import { UTM_BUILDINGS } from "../../data/utm/building-registry.js";
import type {
  CampusBuildingFootprint,
  FootprintCoordinate,
} from "../../data/utm/building-footprints.js";

const footprintUrls = [
  new URL("../../data/utm/footprints/MN.geojson", import.meta.url),
  new URL("../../data/utm/footprints/DH.geojson", import.meta.url),
  new URL("../../data/utm/footprints/IB.geojson", import.meta.url),
  new URL("../../data/utm/footprints/r4.geojson", import.meta.url),
  new URL("../../data/utm/footprints/CCT.geojson", import.meta.url),
  new URL("../../data/utm/footprints/HM2.geojson", import.meta.url),
  new URL("../../data/utm/footprints/KN.geojson", import.meta.url),
  new URL("../../data/utm/footprints/RAWC.geojson", import.meta.url),
  new URL("../../data/utm/footprints/XR.geojson", import.meta.url),
  new URL("../../data/utm/footprints/HB.geojson", import.meta.url),
  new URL("../../data/utm/footprints/AX.geojson", import.meta.url),
  new URL("../../data/utm/footprints/DW2.geojson", import.meta.url),
  new URL("../../data/utm/footprints/EH.geojson", import.meta.url),
  new URL("../../data/utm/footprints/LL2.geojson", import.meta.url),
  new URL("../../data/utm/footprints/r5.geojson", import.meta.url),
  new URL("../../data/utm/footprints/mv2.geojson", import.meta.url),
  new URL("../../data/utm/footprints/mv3.geojson", import.meta.url),
  new URL("../../data/utm/footprints/mv4.geojson", import.meta.url),
  new URL("../../data/utm/footprints/mv5.geojson", import.meta.url),
  new URL("../../data/utm/footprints/mv6.geojson", import.meta.url),
  new URL("../../data/utm/footprints/r1.geojson", import.meta.url),
  new URL("../../data/utm/footprints/r3.geojson", import.meta.url),
  new URL("../../data/utm/footprints/r2.geojson", import.meta.url),
  new URL("../../data/utm/footprints/r6.geojson", import.meta.url),
  new URL("../../data/utm/footprints/r8.geojson", import.meta.url),
  new URL("../../data/utm/footprints/NRB.geojson", import.meta.url),
  new URL("../../data/utm/footprints/IC.geojson", import.meta.url),
  new URL("../../data/utm/footprints/WC.geojson", import.meta.url),
  new URL("../../data/utm/footprints/CUP.geojson", import.meta.url),
  new URL("../../data/utm/footprints/FCSH.geojson", import.meta.url),
  new URL("../../data/utm/footprints/GF.geojson", import.meta.url),
  new URL("../../data/utm/footprints/NSB.geojson", import.meta.url),
  new URL("../../data/utm/footprints/PL.geojson", import.meta.url),
  new URL("../../data/utm/footprints/BG.geojson", import.meta.url),
  new URL("../../data/utm/footprints/LH.geojson", import.meta.url),
] as const;

function geometryPolygons(
  geometry: CampusBuildingFootprint["geometry"],
): FootprintCoordinate[][][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
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

function loadFragments(): CampusBuildingFootprint[] {
  return footprintUrls.map(
    (url) => JSON.parse(readFileSync(url, "utf8")) as CampusBuildingFootprint,
  );
}

function mergeFragments(fragments: CampusBuildingFootprint[]): CampusBuildingFootprint[] {
  const grouped = new Map<string, CampusBuildingFootprint[]>();
  for (const fragment of fragments) {
    const code = fragment.properties.buildingCode.toUpperCase();
    const records = grouped.get(code) ?? [];
    records.push(fragment);
    grouped.set(code, records);
  }

  return UTM_BUILDINGS.map((building) => {
    const records = grouped.get(building.code) ?? [];
    if (records.length === 0) {
      throw new Error(`Canonical UTM footprint coverage is missing ${building.code}.`);
    }
    const polygons = records.flatMap((record) => geometryPolygons(record.geometry));
    return {
      type: "Feature",
      id: building.code,
      properties: {
        buildingCode: building.code,
        name: building.name,
        category: building.category,
        source: "OpenStreetMap",
        sourceIds: [...new Set(records.flatMap((record) => record.properties.sourceIds))].sort(),
        matchMethods: [
          ...new Set(records.flatMap((record) => record.properties.matchMethods)),
        ].sort(),
        lastVerified: records
          .map((record) => record.properties.lastVerified)
          .sort()
          .at(-1)!,
        verificationStatus: "verified",
      },
      geometry:
        polygons.length === 1
          ? { type: "Polygon" as const, coordinates: polygons[0]! }
          : { type: "MultiPolygon" as const, coordinates: polygons },
    } satisfies CampusBuildingFootprint;
  });
}

function partitionSharedKaneffComplex(features: CampusBuildingFootprint[]) {
  const kaneff = features.find((feature) => feature.properties.buildingCode === "KN");
  const innovation = features.find((feature) => feature.properties.buildingCode === "IC");
  if (!kaneff || !innovation) return features;

  const innovationPolygons = geometryPolygons(innovation.geometry);
  const kaneffPolygons = geometryPolygons(kaneff.geometry).map((polygon) => {
    const outer = polygon[0];
    if (!outer) return polygon;
    const nestedRings = innovationPolygons
      .map((candidate) => candidate[0])
      .filter((ring): ring is FootprintCoordinate[] => Boolean(ring?.[0]))
      .filter((ring) => pointInRing(ring[0]!, outer));
    return nestedRings.length > 0 ? [...polygon, ...nestedRings] : polygon;
  });

  const partitionedKaneff: CampusBuildingFootprint = {
    ...kaneff,
    geometry:
      kaneffPolygons.length === 1
        ? { type: "Polygon", coordinates: kaneffPolygons[0]! }
        : { type: "MultiPolygon", coordinates: kaneffPolygons },
  };
  return features.map((feature) =>
    feature.properties.buildingCode === "KN" ? partitionedKaneff : feature,
  );
}

export function serverCampusBuildingFootprints(): CampusBuildingFootprint[] {
  return partitionSharedKaneffComplex(mergeFragments(loadFragments()));
}

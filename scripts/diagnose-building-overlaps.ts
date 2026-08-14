import {
  CAMPUS_BUILDING_FOOTPRINTS,
  getCampusBuildingFootprintBounds,
  pointInBuildingFootprint,
  type FootprintCoordinate,
} from "../src/data/utm/building-footprints";

for (const feature of CAMPUS_BUILDING_FOOTPRINTS.features) {
  const bounds = getCampusBuildingFootprintBounds(feature.properties.buildingCode);
  if (!bounds) continue;
  const [[west, south], [east, north]] = bounds;
  const signatures = new Map<string, number>();
  let sampledInside = 0;
  let sampledUnique = 0;

  for (let row = 1; row < 40; row += 1) {
    for (let column = 1; column < 40; column += 1) {
      const point: FootprintCoordinate = [
        west + ((east - west) * column) / 40,
        south + ((north - south) * row) / 40,
      ];
      if (!pointInBuildingFootprint(point, feature)) continue;
      sampledInside += 1;
      const matches = CAMPUS_BUILDING_FOOTPRINTS.features
        .filter((candidate) => pointInBuildingFootprint(point, candidate))
        .map((candidate) => candidate.properties.buildingCode)
        .sort();
      if (matches.length === 1 && matches[0] === feature.properties.buildingCode) sampledUnique += 1;
      const signature = matches.join("+");
      signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
    }
  }

  const overlapSummary = [...signatures.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([codes, count]) => `${codes || "none"}:${count}`)
    .join(", ");
  console.log(
    `${feature.properties.buildingCode}: inside=${sampledInside}, unique=${sampledUnique}, matches=[${overlapSummary}]`,
  );
}

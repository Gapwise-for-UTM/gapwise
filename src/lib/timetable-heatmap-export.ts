import { CAMPUS_BUILDING_FOOTPRINTS } from "@/data/utm/building-footprints";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { createCampusDayRouteStops } from "@/features/routing/campus-day";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import { WEEKDAYS, type Meeting, type Term, type Weekday } from "@/lib/timetable-types";

export type TimetableHeatmapSelection = Term | "all";

export type TimetableHeatmapRoute = {
  weekday: Weekday;
  coordinates: [number, number][];
};

export type TimetableHeatmapVisit = {
  buildingCode: string;
  count: number;
};

export type TimetableHeatmapData = {
  selection: TimetableHeatmapSelection;
  visits: TimetableHeatmapVisit[];
  routes: TimetableHeatmapRoute[];
  totalStops: number;
  uniqueBuildings: number;
  maxVisits: number;
};

type Coordinate = [number, number];
type Projected = [number, number];
type Projection = (coordinate: Coordinate) => Projected;

type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;
const MAP_INSET = 52;
const MIN_FOCUS_FRACTION = 0.36;
const FOCUS_PADDING = 1.55;
const MAX_PIXELS = 12_000_000;

function mercator([longitude, latitude]: Coordinate): Projected {
  const clampedLatitude = Math.max(-85, Math.min(85, latitude));
  const radians = (clampedLatitude * Math.PI) / 180;
  const x = (longitude + 180) / 360;
  const y = (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
  return [x, y];
}

function footprintPolygons(
  geometry: (typeof CAMPUS_BUILDING_FOOTPRINTS.features)[number]["geometry"],
): Coordinate[][][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function featureCoordinates(
  feature: (typeof CAMPUS_BUILDING_FOOTPRINTS.features)[number],
): Coordinate[] {
  return footprintPolygons(feature.geometry).flat(2);
}

function campusBuildingCoordinates(): Coordinate[] {
  return CAMPUS_BUILDING_FOOTPRINTS.features.flatMap(featureCoordinates);
}

function boundsFor(points: readonly Projected[]): Bounds {
  return {
    minX: Math.min(...points.map(([x]) => x)),
    maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function boundedWindow(
  center: number,
  requestedSpan: number,
  outerMin: number,
  outerMax: number,
): [number, number] {
  const outerSpan = outerMax - outerMin;
  const span = Math.min(outerSpan, Math.max(1e-9, requestedSpan));
  let min = center - span / 2;
  let max = center + span / 2;
  if (min < outerMin) {
    max += outerMin - min;
    min = outerMin;
  }
  if (max > outerMax) {
    min -= max - outerMax;
    max = outerMax;
  }
  return [Math.max(outerMin, min), Math.min(outerMax, max)];
}

function createProjection(data: TimetableHeatmapData): Projection {
  const campusProjected = campusBuildingCoordinates().map(mercator);
  const campus = boundsFor(campusProjected);
  const visitedCodes = new Set(data.visits.map((visit) => visit.buildingCode));
  const focusCoordinates = CAMPUS_BUILDING_FOOTPRINTS.features
    .filter((feature) => visitedCodes.has(feature.properties.buildingCode))
    .flatMap(featureCoordinates);
  const focus = boundsFor(
    (focusCoordinates.length ? focusCoordinates : campusBuildingCoordinates()).map(mercator),
  );

  const campusSpanX = campus.maxX - campus.minX;
  const campusSpanY = campus.maxY - campus.minY;
  const focusSpanX = focus.maxX - focus.minX;
  const focusSpanY = focus.maxY - focus.minY;
  const centerX = (focus.minX + focus.maxX) / 2;
  const centerY = (focus.minY + focus.maxY) / 2;
  const [minX, maxX] = boundedWindow(
    centerX,
    Math.max(focusSpanX * FOCUS_PADDING, campusSpanX * MIN_FOCUS_FRACTION),
    campus.minX,
    campus.maxX,
  );
  const [minY, maxY] = boundedWindow(
    centerY,
    Math.max(focusSpanY * FOCUS_PADDING, campusSpanY * MIN_FOCUS_FRACTION),
    campus.minY,
    campus.maxY,
  );

  const innerWidth = EXPORT_WIDTH - MAP_INSET * 2;
  const innerHeight = EXPORT_HEIGHT - MAP_INSET * 2;
  const scale = Math.min(
    innerWidth / Math.max(1e-9, maxX - minX),
    innerHeight / Math.max(1e-9, maxY - minY),
  );
  const usedWidth = (maxX - minX) * scale;
  const usedHeight = (maxY - minY) * scale;
  const offsetX = (EXPORT_WIDTH - usedWidth) / 2;
  const offsetY = (EXPORT_HEIGHT - usedHeight) / 2;

  return (coordinate) => {
    const [x, y] = mercator(coordinate);
    return [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale];
  };
}

function pathForCoordinates(
  coordinates: readonly Coordinate[],
  project: Projection,
  close = false,
) {
  if (coordinates.length === 0) return "";
  const commands = coordinates.map((coordinate, index) => {
    const [x, y] = project(coordinate);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  if (close) commands.push("Z");
  return commands.join(" ");
}

function footprintPath(
  geometry: (typeof CAMPUS_BUILDING_FOOTPRINTS.features)[number]["geometry"],
  project: Projection,
) {
  return footprintPolygons(geometry)
    .flatMap((polygon) => polygon.map((ring) => pathForCoordinates(ring, project, true)))
    .join(" ");
}

function nodeCoordinate(id: string): Coordinate | null {
  const node = UTM_ROUTING_GRAPH.nodes.find((candidate) => candidate.id === id);
  if (node?.longitude === undefined || node.latitude === undefined) return null;
  return [node.longitude, node.latitude];
}

function routingNetworkPath(project: Projection) {
  const paths: string[] = [];
  for (const edge of UTM_ROUTING_GRAPH.edges) {
    if (edge.environment === "indoor") continue;
    const coordinates = edge.geometry?.length
      ? edge.geometry
      : [nodeCoordinate(edge.from), nodeCoordinate(edge.to)].filter(
          (coordinate): coordinate is Coordinate => Boolean(coordinate),
        );
    if (coordinates.length < 2) continue;
    paths.push(pathForCoordinates(coordinates, project));
  }
  return paths.join(" ");
}

function mixChannel(start: number, end: number, amount: number) {
  return Math.round(start + (end - start) * amount);
}

function heatColor(intensity: number) {
  const amount = Math.max(0, Math.min(1, Math.pow(intensity, 0.78)));
  const start = [37, 99, 235] as const;
  const end = [224, 242, 254] as const;
  return `rgb(${mixChannel(start[0], end[0], amount)} ${mixChannel(start[1], end[1], amount)} ${mixChannel(start[2], end[2], amount)})`;
}

export function createTimetableHeatmapData({
  meetings,
  selection,
  preferences,
  planTransition,
}: {
  meetings: readonly Meeting[];
  selection: TimetableHeatmapSelection;
  preferences: UserPreferences;
  planTransition: TransitionPlanner;
}): TimetableHeatmapData {
  const selected = meetings.filter((meeting) => selection === "all" || meeting.term === selection);
  const visitCounts = new Map<string, number>();
  for (const meeting of selected) {
    if (!meeting.buildingCode) continue;
    const code = meeting.buildingCode.toUpperCase();
    if (
      !CAMPUS_BUILDING_FOOTPRINTS.features.some(
        (feature) => feature.properties.buildingCode === code,
      )
    ) {
      continue;
    }
    visitCounts.set(code, (visitCounts.get(code) ?? 0) + 1);
  }

  const routes: TimetableHeatmapRoute[] = [];
  const selectedTerms = [...new Set(selected.map((meeting) => meeting.term))];
  for (const routeTerm of selectedTerms) {
    for (const weekday of WEEKDAYS) {
      const dayMeetings = selected
        .filter((meeting) => meeting.term === routeTerm && meeting.weekday === weekday)
        .sort((a, b) => a.startTime - b.startTime);
      const stops = createCampusDayRouteStops(dayMeetings, preferences, routeTerm, weekday);
      for (let index = 0; index < stops.length - 1; index += 1) {
        const from = stops[index]!;
        const to = stops[index + 1]!;
        const route = planTransition(from, to, preferences);
        if (route.displayCoordinates.length < 2) continue;
        routes.push({ weekday, coordinates: route.displayCoordinates });
      }
    }
  }

  const visits = Array.from(visitCounts.entries())
    .map(([buildingCode, count]) => ({ buildingCode, count }))
    .sort((a, b) => b.count - a.count || a.buildingCode.localeCompare(b.buildingCode));
  return {
    selection,
    visits,
    routes,
    totalStops: visits.reduce((total, visit) => total + visit.count, 0),
    uniqueBuildings: visits.length,
    maxVisits: Math.max(0, ...visits.map((visit) => visit.count)),
  };
}

export function renderTimetableHeatmapSvg(data: TimetableHeatmapData, _fontDataUrl?: string) {
  const project = createProjection(data);
  const visitMap = new Map(data.visits.map((visit) => [visit.buildingCode, visit.count]));

  const buildings = CAMPUS_BUILDING_FOOTPRINTS.features
    .map((feature) => {
      const count = visitMap.get(feature.properties.buildingCode) ?? 0;
      const path = footprintPath(feature.geometry, project);
      if (count === 0) {
        return `<path d="${path}" fill="#111b29" fill-opacity="0.9" stroke="#26364d" stroke-width="1.7" fill-rule="evenodd"/>`;
      }
      const intensity = data.maxVisits > 0 ? count / data.maxVisits : 0;
      const fillOpacity = (0.42 + intensity * 0.5).toFixed(2);
      const strokeOpacity = (0.62 + intensity * 0.34).toFixed(2);
      return `<path d="${path}" fill="${heatColor(intensity)}" fill-opacity="${fillOpacity}" stroke="#dbeafe" stroke-opacity="${strokeOpacity}" stroke-width="2.6" fill-rule="evenodd" filter="url(#building-glow)"/>`;
    })
    .join("");

  const routeUnderlay = data.routes
    .map(
      (route) =>
        `<path d="${pathForCoordinates(route.coordinates, project)}" fill="none" stroke="#2563eb" stroke-opacity="0.22" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const routeLines = data.routes
    .map(
      (route) =>
        `<path d="${pathForCoordinates(route.coordinates, project)}" fill="none" stroke="#67b7ff" stroke-opacity="0.68" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${EXPORT_WIDTH}" height="${EXPORT_HEIGHT}" viewBox="0 0 ${EXPORT_WIDTH} ${EXPORT_HEIGHT}"><defs><radialGradient id="map-glow" cx="52%" cy="40%" r="78%"><stop offset="0" stop-color="#0b1b30"/><stop offset="0.58" stop-color="#07111f"/><stop offset="1" stop-color="#040912"/></radialGradient><filter id="building-glow" x="-70%" y="-70%" width="240%" height="240%"><feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#60a5fa" flood-opacity="0.66"/></filter><clipPath id="map-clip"><rect width="${EXPORT_WIDTH}" height="${EXPORT_HEIGHT}"/></clipPath></defs><rect width="100%" height="100%" fill="url(#map-glow)"/><g clip-path="url(#map-clip)"><path d="${routingNetworkPath(project)}" fill="none" stroke="#263852" stroke-opacity="0.78" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${buildings}${routeUnderlay}${routeLines}</g></svg>`;
}

export function timetableHeatmapFilename(selection: TimetableHeatmapSelection) {
  return `${selection === "all" ? "all-terms" : selection.toLowerCase()}-utm-timetable-heatmap.png`;
}

export async function generateTimetableHeatmapPng(
  data: TimetableHeatmapData,
  ratio = typeof window === "undefined" ? 2 : Math.min(2.5, Math.max(1.5, window.devicePixelRatio)),
  imageFactory: () => HTMLImageElement = () => new Image(),
  objectUrls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
  _fontDataUrl?: string,
): Promise<{ blob: Blob; filename: string }> {
  if (data.totalStops === 0) throw new Error("The selected term has no mapped campus stops.");
  const svg = renderTimetableHeatmapSvg(data);
  const url = objectUrls.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  let canvas: HTMLCanvasElement | null = null;
  try {
    const image = imageFactory();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The heatmap artwork could not be rendered."));
      image.src = url;
    });
    const requestedPixels = EXPORT_WIDTH * EXPORT_HEIGHT * ratio * ratio;
    const safeRatio =
      requestedPixels > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / (EXPORT_WIDTH * EXPORT_HEIGHT)) : ratio;
    canvas = document.createElement("canvas");
    canvas.width = Math.round(EXPORT_WIDTH * safeRatio);
    canvas.height = Math.round(EXPORT_HEIGHT * safeRatio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is not supported by this browser.");
    context.scale(safeRatio, safeRatio);
    context.drawImage(image, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The heatmap PNG could not be created.");
    return { blob, filename: timetableHeatmapFilename(data.selection) };
  } finally {
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
    objectUrls.revokeObjectURL(url);
  }
}

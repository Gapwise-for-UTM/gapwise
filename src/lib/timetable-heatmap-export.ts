import geistFontUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import {
  CAMPUS_BUILDING_FOOTPRINTS,
  representativePointForFootprint,
} from "@/data/utm/building-footprints";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { createCampusDayRouteStops } from "@/features/routing/campus-day";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import { WEEKDAYS, type Meeting, type Term, type Weekday } from "@/lib/timetable-types";

export type TimetableHeatmapRoute = {
  weekday: Weekday;
  coordinates: [number, number][];
};

export type TimetableHeatmapVisit = {
  buildingCode: string;
  count: number;
};

export type TimetableHeatmapData = {
  term: Term;
  visits: TimetableHeatmapVisit[];
  routes: TimetableHeatmapRoute[];
  totalStops: number;
  uniqueBuildings: number;
  maxVisits: number;
};

type Coordinate = [number, number];
type Projected = [number, number];
type Projection = (coordinate: Coordinate) => Projected;

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;
const MAP_X = 42;
const MAP_Y = 190;
const MAP_WIDTH = EXPORT_WIDTH - MAP_X * 2;
const MAP_HEIGHT = 975;
const MAP_INSET = 44;
const MAX_PIXELS = 12_000_000;

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!,
  );

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

function campusCoordinates(): Coordinate[] {
  const footprintCoordinates = CAMPUS_BUILDING_FOOTPRINTS.features.flatMap((feature) =>
    footprintPolygons(feature.geometry).flat(2),
  );
  const graphCoordinates = UTM_ROUTING_GRAPH.nodes.flatMap((node) =>
    node.longitude !== undefined && node.latitude !== undefined
      ? ([[node.longitude, node.latitude]] as Coordinate[])
      : [],
  );
  return [...footprintCoordinates, ...graphCoordinates];
}

function createProjection(): Projection {
  const projected = campusCoordinates().map(mercator);
  const minX = Math.min(...projected.map(([x]) => x));
  const maxX = Math.max(...projected.map(([x]) => x));
  const minY = Math.min(...projected.map(([, y]) => y));
  const maxY = Math.max(...projected.map(([, y]) => y));
  const innerWidth = MAP_WIDTH - MAP_INSET * 2;
  const innerHeight = MAP_HEIGHT - MAP_INSET * 2;
  const scale = Math.min(
    innerWidth / Math.max(1e-9, maxX - minX),
    innerHeight / Math.max(1e-9, maxY - minY),
  );
  const usedWidth = (maxX - minX) * scale;
  const usedHeight = (maxY - minY) * scale;
  const offsetX = MAP_X + (MAP_WIDTH - usedWidth) / 2;
  const offsetY = MAP_Y + (MAP_HEIGHT - usedHeight) / 2;
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
  term,
  preferences,
  planTransition,
}: {
  meetings: readonly Meeting[];
  term: Term;
  preferences: UserPreferences;
  planTransition: TransitionPlanner;
}): TimetableHeatmapData {
  const selected = meetings.filter((meeting) => meeting.term === term);
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
  for (const weekday of WEEKDAYS) {
    const dayMeetings = selected
      .filter((meeting) => meeting.weekday === weekday)
      .sort((a, b) => a.startTime - b.startTime);
    const stops = createCampusDayRouteStops(dayMeetings, preferences, term, weekday);
    for (let index = 0; index < stops.length - 1; index += 1) {
      const from = stops[index]!;
      const to = stops[index + 1]!;
      const route = planTransition(from, to, preferences);
      if (route.displayCoordinates.length < 2) continue;
      routes.push({ weekday, coordinates: route.displayCoordinates });
    }
  }

  const visits = Array.from(visitCounts.entries())
    .map(([buildingCode, count]) => ({ buildingCode, count }))
    .sort((a, b) => b.count - a.count || a.buildingCode.localeCompare(b.buildingCode));
  return {
    term,
    visits,
    routes,
    totalStops: visits.reduce((total, visit) => total + visit.count, 0),
    uniqueBuildings: visits.length,
    maxVisits: Math.max(0, ...visits.map((visit) => visit.count)),
  };
}

function buildingLabelSvg(
  feature: (typeof CAMPUS_BUILDING_FOOTPRINTS.features)[number],
  count: number,
  maxVisits: number,
  project: Projection,
) {
  const point = representativePointForFootprint(feature);
  if (!point) return "";
  const [x, y] = project(point);
  const intensity = maxVisits > 0 ? count / maxVisits : 0;
  const labelOpacity = (0.76 + intensity * 0.24).toFixed(2);
  return `<g text-anchor="middle" opacity="${labelOpacity}"><text x="${x.toFixed(1)}" y="${(y - 2).toFixed(1)}" font-size="19" font-weight="820" fill="#f8fafc" paint-order="stroke" stroke="#07101d" stroke-width="5" stroke-linejoin="round">${escapeXml(feature.properties.buildingCode)}</text><text x="${x.toFixed(1)}" y="${(y + 17).toFixed(1)}" font-size="10.5" font-weight="650" fill="#bfdbfe" paint-order="stroke" stroke="#07101d" stroke-width="4">${count}× / week</text></g>`;
}

export function renderTimetableHeatmapSvg(data: TimetableHeatmapData, fontDataUrl?: string) {
  const project = createProjection();
  const visitMap = new Map(data.visits.map((visit) => [visit.buildingCode, visit.count]));
  const fontFace = fontDataUrl
    ? `@font-face{font-family:HeatmapGeist;src:url('${fontDataUrl}') format('woff2');font-weight:100 900}`
    : "";

  const buildings = CAMPUS_BUILDING_FOOTPRINTS.features
    .map((feature) => {
      const count = visitMap.get(feature.properties.buildingCode) ?? 0;
      const path = footprintPath(feature.geometry, project);
      if (count === 0) {
        return `<path d="${path}" fill="#121a26" fill-opacity="0.9" stroke="#273448" stroke-width="1.4" fill-rule="evenodd"/>`;
      }
      const intensity = data.maxVisits > 0 ? count / data.maxVisits : 0;
      const fillOpacity = (0.38 + intensity * 0.52).toFixed(2);
      const strokeOpacity = (0.58 + intensity * 0.36).toFixed(2);
      return `<path d="${path}" fill="${heatColor(intensity)}" fill-opacity="${fillOpacity}" stroke="#bae6fd" stroke-opacity="${strokeOpacity}" stroke-width="2" fill-rule="evenodd" filter="url(#building-glow)"/>`;
    })
    .join("");

  const routeUnderlay = data.routes
    .map(
      (route) =>
        `<path d="${pathForCoordinates(route.coordinates, project)}" fill="none" stroke="#2563eb" stroke-opacity="0.18" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const routeLines = data.routes
    .map(
      (route) =>
        `<path d="${pathForCoordinates(route.coordinates, project)}" fill="none" stroke="#7dd3fc" stroke-opacity="0.53" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const labels = CAMPUS_BUILDING_FOOTPRINTS.features
    .map((feature) => {
      const count = visitMap.get(feature.properties.buildingCode) ?? 0;
      return count > 0 ? buildingLabelSvg(feature, count, data.maxVisits, project) : "";
    })
    .join("");

  const busiest = data.visits[0];
  const summary = `${data.totalStops} weekly ${data.totalStops === 1 ? "stop" : "stops"} · ${data.uniqueBuildings} ${data.uniqueBuildings === 1 ? "building" : "buildings"}`;
  const busiestText = busiest
    ? `Most visited: ${busiest.buildingCode} · ${busiest.count}× / week`
    : "No mapped campus stops in this term";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${EXPORT_WIDTH}" height="${EXPORT_HEIGHT}" viewBox="0 0 ${EXPORT_WIDTH} ${EXPORT_HEIGHT}"><style>${fontFace}text{font-family:HeatmapGeist,'Geist Variable',system-ui,sans-serif}</style><defs><radialGradient id="page-glow" cx="84%" cy="2%" r="72%"><stop offset="0" stop-color="#13284b"/><stop offset="0.46" stop-color="#09111f"/><stop offset="1" stop-color="#05080e"/></radialGradient><linearGradient id="heat-legend" x1="0" x2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="0.52" stop-color="#60a5fa"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient><filter id="panel-shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#00000088"/></filter><filter id="building-glow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#60a5fa" flood-opacity="0.62"/></filter><clipPath id="map-clip"><rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" rx="34"/></clipPath></defs><rect width="100%" height="100%" fill="url(#page-glow)"/><text x="54" y="72" font-size="16" font-weight="800" letter-spacing="3.4" fill="#7dd3fc">GAPWISE · UTM</text><text x="54" y="122" font-size="39" font-weight="810" letter-spacing="-1.3" fill="#f8fafc">My timetable heatmap</text><text x="54" y="157" font-size="16" font-weight="590" fill="#9fb0c7">${escapeXml(data.term)} · ${escapeXml(summary)}</text><g filter="url(#panel-shadow)"><rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" rx="34" fill="#08101b" stroke="#27364c" stroke-width="2"/></g><g clip-path="url(#map-clip)"><rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" fill="#08101b"/><path d="${routingNetworkPath(project)}" fill="none" stroke="#26364b" stroke-opacity="0.72" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>${buildings}${routeUnderlay}${routeLines}${labels}</g><g transform="translate(54 1204)"><text x="0" y="0" font-size="13" font-weight="720" fill="#dbeafe">Building brightness = weekly visits</text><rect x="0" y="18" width="270" height="13" rx="6.5" fill="url(#heat-legend)"/><text x="0" y="51" font-size="11.5" font-weight="560" fill="#8090a8">Fewer visits</text><text x="270" y="51" text-anchor="end" font-size="11.5" font-weight="560" fill="#8090a8">More visits</text><text x="360" y="0" font-size="13" font-weight="720" fill="#dbeafe">${escapeXml(busiestText)}</text><text x="360" y="28" font-size="11.5" font-weight="560" fill="#8090a8">Brighter overlapping lines = repeated timetable routes</text></g><line x1="54" y1="1283" x2="1026" y2="1283" stroke="#233147"/><text x="54" y="1318" font-size="11.5" font-weight="560" fill="#718096">Generated locally from your timetable · no course codes or room numbers included</text><text x="1026" y="1318" text-anchor="end" font-size="11.5" font-weight="650" fill="#718096">Campus geometry © OpenStreetMap contributors · Gapwise</text></svg>`;
}

export function timetableHeatmapFilename(term: Term) {
  return `${term.toLowerCase()}-utm-timetable-heatmap.png`;
}

let geistDataPromise: Promise<string> | null = null;
async function embeddedGeistDataUrl() {
  geistDataPromise ??= fetch(geistFontUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Heatmap typography could not be prepared.");
      return response.arrayBuffer();
    })
    .then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return `data:font/woff2;base64,${btoa(binary)}`;
    });
  return geistDataPromise;
}

export async function generateTimetableHeatmapPng(
  data: TimetableHeatmapData,
  ratio =
    typeof window === "undefined" ? 2 : Math.min(2.5, Math.max(1.5, window.devicePixelRatio)),
  imageFactory: () => HTMLImageElement = () => new Image(),
  objectUrls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
  fontDataUrl?: string,
): Promise<{ blob: Blob; filename: string }> {
  if (data.totalStops === 0) throw new Error("The selected term has no mapped campus stops.");
  if (typeof document !== "undefined" && "fonts" in document) await document.fonts.ready;
  const embeddedFont = fontDataUrl ?? (await embeddedGeistDataUrl());
  const svg = renderTimetableHeatmapSvg(data, embeddedFont);
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
      requestedPixels > MAX_PIXELS
        ? Math.sqrt(MAX_PIXELS / (EXPORT_WIDTH * EXPORT_HEIGHT))
        : ratio;
    canvas = document.createElement("canvas");
    canvas.width = Math.round(EXPORT_WIDTH * safeRatio);
    canvas.height = Math.round(EXPORT_HEIGHT * safeRatio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is not supported by this browser.");
    context.scale(safeRatio, safeRatio);
    context.drawImage(image, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The heatmap PNG could not be created.");
    return { blob, filename: timetableHeatmapFilename(data.term) };
  } finally {
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
    objectUrls.revokeObjectURL(url);
  }
}

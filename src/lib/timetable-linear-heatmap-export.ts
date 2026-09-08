import {
  renderTimetableHeatmapSvg,
  timetableHeatmapFilename,
  type TimetableHeatmapData,
} from "./timetable-heatmap-export";

export type TimetableHeatmapTheme = "light" | "dark";

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;
const MAX_PIXELS = 12_000_000;

const PALETTES = {
  light: {
    background: "#f7f7f8",
    building: "#ececef",
    buildingStroke: "#d4d4d8",
    visitedStroke: "#2563eb",
    network: "#d7d7dc",
    routeUnderlay: "#bfdbfe",
    route: "#2563eb",
    heatStart: [219, 234, 254] as const,
    heatEnd: [37, 99, 235] as const,
  },
  dark: {
    background: "#111113",
    building: "#1b1b1f",
    buildingStroke: "#2a2a2f",
    visitedStroke: "#7fb0ff",
    network: "#292a31",
    routeUnderlay: "#20365d",
    route: "#4c8dff",
    heatStart: [25, 38, 58] as const,
    heatEnd: [76, 141, 255] as const,
  },
} as const;

function mix(
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  amount: number,
) {
  return start.map((channel, index) => Math.round(channel + (end[index]! - channel) * amount));
}

function applyLinearHeatmapTheme(svg: string, theme: TimetableHeatmapTheme) {
  const palette = PALETTES[theme];
  let next = svg
    .replaceAll("#0b1b30", palette.background)
    .replaceAll("#07111f", palette.background)
    .replaceAll("#040912", palette.background)
    .replaceAll("#111b29", palette.building)
    .replaceAll("#26364d", palette.buildingStroke)
    .replaceAll("#dbeafe", palette.visitedStroke)
    .replaceAll("#263852", palette.network)
    .replaceAll("#2563eb", palette.routeUnderlay)
    .replaceAll("#67b7ff", palette.route)
    .replaceAll(' filter="url(#building-glow)"', "")
    .replaceAll('stroke-width="13"', 'stroke-width="8"')
    .replaceAll('stroke-width="4.8"', 'stroke-width="3.4"')
    .replaceAll('stroke-width="2.6"', 'stroke-width="1.8"')
    .replaceAll('stroke-width="1.8"', 'stroke-width="1.25"');

  next = next.replace(/fill="rgb\((\d+) (\d+) (\d+)\)"/g, (_match, red) => {
    const amount = Math.max(0, Math.min(1, (Number(red) - 37) / (224 - 37)));
    const [r, g, b] = mix(palette.heatStart, palette.heatEnd, amount);
    return `fill="rgb(${r} ${g} ${b})"`;
  });
  return next;
}

export function renderLinearTimetableHeatmapSvg(
  data: TimetableHeatmapData,
  theme: TimetableHeatmapTheme,
) {
  return applyLinearHeatmapTheme(renderTimetableHeatmapSvg(data), theme);
}

export async function generateLinearTimetableHeatmapPng(
  data: TimetableHeatmapData,
  theme: TimetableHeatmapTheme,
  ratio = typeof window === "undefined" ? 2 : Math.min(2.5, Math.max(1.5, window.devicePixelRatio)),
  imageFactory: () => HTMLImageElement = () => new Image(),
  objectUrls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
): Promise<{ blob: Blob; filename: string }> {
  if (data.totalStops === 0) throw new Error("The selected term has no mapped campus stops.");
  const svg = renderLinearTimetableHeatmapSvg(data, theme);
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

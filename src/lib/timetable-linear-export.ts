import geistFontUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import {
  createTimetableExportPlan,
  EXPORT_PALETTES,
  renderTimetableExportSvg,
  timetableExportFilename,
  type ExportSelection,
  type ExportTheme,
  type TimetableExportPalette,
} from "./timetable-export";
import type { Meeting } from "./timetable-types";

const LINEAR_PALETTES: Record<ExportTheme, TimetableExportPalette> = {
  light: {
    pageBackground: "#f7f7f8",
    pageGlow: "#f7f7f8",
    timetableBackground: "#ffffff",
    headerSurface: "#fafafa",
    eventSurface: "#ffffff",
    foreground: "#202124",
    secondaryForeground: "#4b4c52",
    mutedForeground: "#77787f",
    border: "#e2e2e5",
    grid: "#eeeeef",
    accent: "#5965cc",
    accentSoft: "#eef0ff",
    lec: "#5965cc",
    tut: "#2f8c91",
    pra: "#8066b3",
    reserved: "#9b6a1f",
    other: "#74757c",
    shadow: "#00000000",
    highlight: "#ffffff",
  },
  dark: {
    pageBackground: "#111113",
    pageGlow: "#111113",
    timetableBackground: "#151518",
    headerSurface: "#18181b",
    eventSurface: "#19191c",
    foreground: "#f2f2f3",
    secondaryForeground: "#c8c8cd",
    mutedForeground: "#8b8b93",
    border: "#2a2a2f",
    grid: "#242429",
    accent: "#6975df",
    accentSoft: "#20233a",
    lec: "#6975df",
    tut: "#4d9fa5",
    pra: "#9679c5",
    reserved: "#c59642",
    other: "#8b8b93",
    shadow: "#00000000",
    highlight: "#ffffff08",
  },
};

export function renderLinearTimetableSvg(
  meetings: readonly Meeting[],
  selection: ExportSelection,
  theme: ExportTheme,
  ratio: number,
  fontDataUrl: string,
) {
  const plan = createTimetableExportPlan(meetings, selection, ratio);
  const palette = EXPORT_PALETTES[theme];
  const previous = { ...palette };
  Object.assign(palette, LINEAR_PALETTES[theme]);
  try {
    const svg = renderTimetableExportSvg(meetings, plan, theme, fontDataUrl)
      .replaceAll(' filter="url(#panel-shadow)"', "")
      .replaceAll(' filter="url(#event-shadow)"', "")
      .replaceAll('rx="24"', 'rx="12"')
      .replaceAll('rx="10"', 'rx="7"');
    return { svg, plan };
  } finally {
    Object.assign(palette, previous);
  }
}

let geistDataPromise: Promise<string> | null = null;
async function embeddedGeistDataUrl() {
  geistDataPromise ??= fetch(geistFontUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Export typography could not be prepared.");
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

export async function generateLinearTimetablePng(
  meetings: readonly Meeting[],
  selection: ExportSelection,
  theme: ExportTheme,
  ratio = typeof window === "undefined" ? 2 : window.devicePixelRatio,
  imageFactory: () => HTMLImageElement = () => new Image(),
  objectUrls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
): Promise<{ blob: Blob; filename: string }> {
  if (typeof document !== "undefined" && "fonts" in document) await document.fonts.ready;
  const fontDataUrl = await embeddedGeistDataUrl();
  const { svg, plan } = renderLinearTimetableSvg(meetings, selection, theme, ratio, fontDataUrl);
  const url = objectUrls.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  let canvas: HTMLCanvasElement | null = null;
  try {
    const image = imageFactory();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The timetable artwork could not be rendered."));
      image.src = url;
    });
    canvas = document.createElement("canvas");
    canvas.width = Math.round(plan.width * plan.pixelRatio);
    canvas.height = Math.round(plan.height * plan.pixelRatio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is not supported by this browser.");
    context.scale(plan.pixelRatio, plan.pixelRatio);
    context.drawImage(image, 0, 0, plan.width, plan.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The PNG could not be created.");
    return { blob, filename: timetableExportFilename(selection, plan.terms) };
  } finally {
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
    objectUrls.revokeObjectURL(url);
  }
}

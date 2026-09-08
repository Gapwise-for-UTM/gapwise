import geistFontUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import {
  createTimetableExportPlan,
  renderTimetableExportSvg,
  timetableExportFilename,
  type ExportSelection,
  type ExportTheme,
} from "./timetable-export";
import type { Meeting } from "./timetable-types";

const COLOR_REMAP: Record<ExportTheme, Record<string, string>> = {
  light: {
    "#f4f6fa": "#f7f7f8",
    "#e7efff": "#f7f7f8",
    "#fdfdfe": "#ffffff",
    "#f5f7fb": "#fafafa",
    "#ffffff": "#ffffff",
    "#202735": "#1f2024",
    "#46536a": "#45464d",
    "#6b7587": "#73757d",
    "#d7dde7": "#e4e4e7",
    "#e4e8ef": "#eeeeef",
    "#2866c7": "#2563eb",
    "#e8f0ff": "#eff6ff",
    "#3769b8": "#3b82f6",
    "#237a92": "#0891b2",
    "#8554a8": "#8b5cf6",
    "#a66d1d": "#b7791f",
    "#687386": "#71717a",
    "#1720331a": "#00000000",
  },
  dark: {
    "#090c13": "#111113",
    "#12203b": "#111113",
    "#111621": "#151518",
    "#151b27": "#18181b",
    "#171d29": "#1b1b1f",
    "#f2f4f7": "#f3f3f4",
    "#c3cad5": "#d2d2d6",
    "#9ba5b4": "#8b8b93",
    "#293140": "#2a2a2f",
    "#252c39": "#232329",
    "#78a9f2": "#60a5fa",
    "#182a46": "#18233a",
    "#78a6e8": "#6ea8fe",
    "#72bdcf": "#55c2cf",
    "#b18bd0": "#a78bfa",
    "#dfad52": "#e0a84e",
    "#a6afbd": "#8b8b93",
    "#00000066": "#00000000",
    "#ffffff12": "#ffffff0a",
  },
};

function applyLinearTheme(svg: string, theme: ExportTheme) {
  let next = svg;
  for (const [from, to] of Object.entries(COLOR_REMAP[theme])) {
    next = next.replaceAll(from, to);
  }
  return next
    .replaceAll(' filter="url(#panel-shadow)"', "")
    .replaceAll(' filter="url(#event-shadow)"', "")
    .replaceAll('rx="24"', 'rx="12"')
    .replaceAll('rx="10"', 'rx="7"');
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
  const plan = createTimetableExportPlan(meetings, selection, ratio);
  if (typeof document !== "undefined" && "fonts" in document) await document.fonts.ready;
  const fontDataUrl = await embeddedGeistDataUrl();
  const svg = applyLinearTheme(renderTimetableExportSvg(meetings, plan, theme, fontDataUrl), theme);
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

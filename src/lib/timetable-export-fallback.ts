import {
  createTimetableExportPlan,
  renderTimetableExportSvg,
  timetableExportFilename,
  type ExportSelection,
  type ExportTheme,
} from "./timetable-export";
import { renderTimetablePrintSvg, timetablePrintFilename } from "./timetable-print-export";
import type { Meeting } from "./timetable-types";

/** Safari-safe fallback that avoids embedded webfonts in SVG image decoding. */
export async function generateTimetablePngFallback(
  meetings: readonly Meeting[],
  selection: ExportSelection,
  theme: ExportTheme,
): Promise<{ blob: Blob; filename: string }> {
  const plan = createTimetableExportPlan(meetings, selection, Math.min(window.devicePixelRatio || 2, 2));
  const svg = renderTimetableExportSvg(meetings, plan, theme);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Fallback timetable artwork could not be rendered."));
    image.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(plan.width * plan.pixelRatio);
  canvas.height = Math.round(plan.height * plan.pixelRatio);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image export is not supported by this browser.");
  context.scale(plan.pixelRatio, plan.pixelRatio);
  context.drawImage(image, 0, 0, plan.width, plan.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  canvas.width = 1;
  canvas.height = 1;
  if (!blob) throw new Error("Fallback PNG could not be created.");
  return { blob, filename: timetableExportFilename(selection, plan.terms) };
}

/** Vector fallback is fully self-contained except for using the browser's system sans font. */
export function generateTimetablePrintSvgFallback(
  meetings: readonly Meeting[],
  selection: ExportSelection,
): { blob: Blob; filename: string } {
  const plan = createTimetableExportPlan(meetings, selection, 2);
  const svg = renderTimetablePrintSvg(meetings, plan);
  return {
    blob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    filename: timetablePrintFilename(selection, plan.terms),
  };
}

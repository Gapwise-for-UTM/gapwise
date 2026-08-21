import geistFontUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import { buildTimetableModel } from "./timetable-layout";
import {
  formatTime,
  locationLabel,
  TERMS,
  type ActivityType,
  type Meeting,
  type Term,
  WEEKDAYS,
} from "./timetable-types";

export type ExportSelection = Term | "all";
export type ExportLayout = "single" | "side-by-side" | "balanced-grid" | "stacked";
export type ExportTheme = "light" | "dark";
export type ExportAppearance = "match" | ExportTheme;

export interface TimetableExportPalette {
  pageBackground: string;
  pageGlow: string;
  timetableBackground: string;
  headerSurface: string;
  eventSurface: string;
  foreground: string;
  secondaryForeground: string;
  mutedForeground: string;
  border: string;
  grid: string;
  accent: string;
  accentSoft: string;
  lec: string;
  tut: string;
  pra: string;
  other: string;
  shadow: string;
  highlight: string;
}

export const EXPORT_PALETTES: Record<ExportTheme, TimetableExportPalette> = {
  light: {
    pageBackground: "#f4f6fa",
    pageGlow: "#e7efff",
    timetableBackground: "#fdfdfe",
    headerSurface: "#f5f7fb",
    eventSurface: "#ffffff",
    foreground: "#202735",
    secondaryForeground: "#46536a",
    mutedForeground: "#6b7587",
    border: "#d7dde7",
    grid: "#e4e8ef",
    accent: "#2866c7",
    accentSoft: "#e8f0ff",
    lec: "#3769b8",
    tut: "#237a92",
    pra: "#8554a8",
    other: "#687386",
    shadow: "#1720331a",
    highlight: "#ffffff",
  },
  dark: {
    pageBackground: "#090c13",
    pageGlow: "#12203b",
    timetableBackground: "#111621",
    headerSurface: "#151b27",
    eventSurface: "#171d29",
    foreground: "#f2f4f7",
    secondaryForeground: "#c3cad5",
    mutedForeground: "#9ba5b4",
    border: "#293140",
    grid: "#252c39",
    accent: "#78a9f2",
    accentSoft: "#182a46",
    lec: "#78a6e8",
    tut: "#72bdcf",
    pra: "#b18bd0",
    other: "#a6afbd",
    shadow: "#00000066",
    highlight: "#ffffff12",
  },
};

export interface ExportPanelPlacement {
  term: Term;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimetableExportPlan {
  terms: Term[];
  layout: ExportLayout;
  width: number;
  height: number;
  termWidth: number;
  termHeight: number;
  pixelRatio: number;
  panels: ExportPanelPlacement[];
}

const GAP = 28;
const PAGE_PADDING = 48;
const HEADER_HEIGHT = 104;
const FOOTER_HEIGHT = 44;
const MAX_PIXELS = 16_000_000;

export function resolveExportTheme(
  appearance: ExportAppearance,
  resolvedGapwiseTheme: ExportTheme,
): ExportTheme {
  return appearance === "match" ? resolvedGapwiseTheme : appearance;
}

export function availableExportTerms(meetings: readonly Meeting[]): Term[] {
  return TERMS.filter((term) => meetings.some((meeting) => meeting.term === term));
}

function termMetrics(meetings: readonly Meeting[], term: Term) {
  const selected = meetings.filter((meeting) => meeting.term === term);
  const model = buildTimetableModel(selected);
  const busiestDay = Math.max(0, ...WEEKDAYS.map((day) => model.days.get(day)?.sorted.length ?? 0));
  const maxLanes = Math.max(1, ...WEEKDAYS.map((day) => model.days.get(day)?.laneCount ?? 1));
  return { blocks: selected.length, busiestDay, maxLanes, hours: model.hours.length };
}

/** Plans a balanced composition from real schedule span, overlap, and density. */
export function createTimetableExportPlan(
  meetings: readonly Meeting[],
  selection: ExportSelection,
  devicePixelRatio = 2,
): TimetableExportPlan {
  const available = availableExportTerms(meetings);
  const terms = selection === "all" ? available : available.filter((term) => term === selection);
  if (terms.length === 0) throw new Error("The selected term has no scheduled meetings.");

  const metrics = terms.map((term) => termMetrics(meetings, term));
  const dense = metrics.some(
    ({ blocks, busiestDay, maxLanes, hours }) =>
      blocks >= 18 || busiestDay >= 6 || maxLanes >= 3 || hours >= 14,
  );
  const unevenTwoTerms = terms.length === 2 && Math.abs(metrics[0]!.hours - metrics[1]!.hours) >= 5;
  const layout: ExportLayout =
    terms.length === 1
      ? "single"
      : dense || unevenTwoTerms
        ? "stacked"
        : terms.length === 2
          ? "side-by-side"
          : "balanced-grid";
  const columns = layout === "side-by-side" || layout === "balanced-grid" ? 2 : 1;
  const termWidth = columns === 1 ? 1180 : 1010;
  const maxHours = Math.max(...metrics.map(({ hours }) => hours));
  const termHeight = Math.max(560, 118 + maxHours * (dense ? 58 : 54));
  const rows = layout === "balanced-grid" ? 2 : Math.ceil(terms.length / columns);
  const width = PAGE_PADDING * 2 + columns * termWidth + (columns - 1) * GAP;
  const height =
    PAGE_PADDING * 2 + HEADER_HEIGHT + rows * termHeight + (rows - 1) * GAP + FOOTER_HEIGHT;
  const panels = terms.map((term, index) => {
    const row = Math.floor(index / columns);
    const lastCentered = layout === "balanced-grid" && terms.length === 3 && index === 2;
    const column = index % columns;
    return {
      term,
      x: lastCentered
        ? Math.round((width - termWidth) / 2)
        : PAGE_PADDING + column * (termWidth + GAP),
      y: PAGE_PADDING + HEADER_HEIGHT + row * (termHeight + GAP),
      width: termWidth,
      height: termHeight,
    };
  });
  const requestedRatio = Math.min(3, Math.max(2, devicePixelRatio));
  const maxRatio = Math.sqrt(MAX_PIXELS / (width * height));
  const pixelRatio = Math.max(1.5, Math.min(requestedRatio, maxRatio));
  return { terms, layout, width, height, termWidth, termHeight, pixelRatio, panels };
}

export function timetableExportFilename(
  selection: ExportSelection,
  terms: readonly Term[],
): string {
  const label = selection === "all" ? terms.join("-") : selection;
  return `gapwise-${label.toLowerCase()}-timetable.png`;
}

export const escapeExportText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!,
  );

function hexToRgb(hex: string) {
  const value = hex.slice(1);
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
}

function mixHex(base: string, tint: string, amount: number) {
  const a = hexToRgb(base);
  const b = hexToRgb(tint);
  return `#${a
    .map((channel, index) =>
      Math.round(channel * (1 - amount) + b[index]! * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function exportSafeCustomAccent(color: string, theme: ExportTheme) {
  const [red, green, blue] = hexToRgb(color).map((channel) => channel / 255) as [
    number,
    number,
    number,
  ];
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  if (theme === "dark" && luminance < 0.38) return mixHex(color, "#ffffff", 0.38);
  if (theme === "light" && luminance > 0.78) return mixHex(color, "#000000", 0.3);
  return color;
}

export function meetingExportStyle(
  meeting: Meeting,
  theme: ExportTheme,
  palette = EXPORT_PALETTES[theme],
) {
  const study = meeting.sectionCode === "STUDY";
  const personal = meeting.sectionCode === "PERSONAL";
  const activity: Record<ActivityType, string> = {
    LEC: palette.lec,
    TUT: palette.tut,
    PRA: palette.pra,
    OTHER: palette.other,
  };
  const custom = meeting.color && /^#[0-9a-f]{6}$/i.test(meeting.color) ? meeting.color : null;
  const accent = study
    ? palette.accent
    : custom
      ? exportSafeCustomAccent(custom, theme)
      : activity[meeting.activityType];
  return {
    accent,
    base: mixHex(palette.eventSurface, accent, theme === "dark" ? 0.12 : 0.1),
    border: mixHex(palette.border, accent, theme === "dark" ? 0.42 : 0.5),
    badge: mixHex(palette.eventSurface, accent, theme === "dark" ? 0.2 : 0.16),
    dashed: study,
    label: study ? "STUDY" : personal ? "PERSONAL" : meeting.activityType,
  };
}

function timeShort(minutes: number) {
  return formatTime(minutes).replace(":00", "").replace(" ", "").toLowerCase();
}

function renderTerm(
  meetings: readonly Meeting[],
  panel: ExportPanelPlacement,
  theme: ExportTheme,
  palette: TimetableExportPalette,
) {
  const { term, x, y, width, height } = panel;
  const selected = meetings.filter((meeting) => meeting.term === term);
  const { startHour, hours, days } = buildTimetableModel(selected);
  const titleHeight = 64;
  const dayHeight = 46;
  const bottomPadding = 18;
  const axisWidth = 72;
  const gridY = y + titleHeight + dayHeight;
  const gridHeight = height - titleHeight - dayHeight - bottomPadding;
  const hourHeight = gridHeight / Math.max(1, hours.length);
  const dayWidth = (width - axisWidth) / 5;
  const minuteY = (minute: number) => gridY + ((minute - startHour * 60) / 60) * hourHeight;
  let svg = `<g filter="url(#panel-shadow)"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${palette.timetableBackground}" stroke="${palette.border}"/></g>`;
  svg += `<path d="M${x + 24} ${y + titleHeight}H${x + width - 24}" stroke="${palette.border}"/>`;
  svg += `<text x="${x + 26}" y="${y + 37}" font-size="23" font-weight="760" letter-spacing="-.5" fill="${palette.foreground}">${term}</text>`;
  svg += `<text x="${x + width - 26}" y="${y + 36}" text-anchor="end" font-size="11" font-weight="650" letter-spacing="1.2" fill="${palette.mutedForeground}">${selected.length} ${selected.length === 1 ? "EVENT" : "EVENTS"}</text>`;
  svg += `<rect x="${x + 1}" y="${y + titleHeight + 1}" width="${width - 2}" height="${dayHeight}" fill="${palette.headerSurface}"/>`;
  svg += `<text x="${x + 20}" y="${y + titleHeight + 29}" font-size="10" font-weight="680" letter-spacing="1" fill="${palette.mutedForeground}">TIME</text>`;
  WEEKDAYS.forEach((day, index) => {
    const dx = Math.round(x + axisWidth + index * dayWidth);
    svg += `<line x1="${dx}" y1="${y + titleHeight}" x2="${dx}" y2="${y + height - bottomPadding}" stroke="${palette.grid}"/>`;
    svg += `<text x="${Math.round(dx + dayWidth / 2)}" y="${y + titleHeight + 29}" text-anchor="middle" font-size="12" font-weight="720" fill="${palette.secondaryForeground}">${day.slice(0, 3).toUpperCase()}</text>`;
  });
  hours.forEach((hour) => {
    const hy = Math.round(minuteY(hour * 60)) + 0.5;
    svg += `<line x1="${x + axisWidth}" y1="${hy}" x2="${x + width}" y2="${hy}" stroke="${palette.grid}"/>`;
    svg += `<text x="${x + axisWidth - 12}" y="${hy + 4}" text-anchor="end" font-size="10" font-weight="560" fill="${palette.mutedForeground}">${timeShort(hour * 60)}</text>`;
  });
  WEEKDAYS.forEach((day, dayIndex) => {
    const { laneCount, placement, sorted } = days.get(day)!;
    sorted.forEach((meeting, meetingIndex) => {
      const lane = placement.get(meeting.id) ?? 0;
      const laneWidth = dayWidth / laneCount;
      const mx = Math.round(x + axisWidth + dayIndex * dayWidth + lane * laneWidth + 5);
      const my = Math.round(minuteY(meeting.startTime) + 4);
      const mh = Math.max(
        27,
        Math.round(minuteY(meeting.endTime) - minuteY(meeting.startTime) - 8),
      );
      const mw = Math.max(34, Math.round(laneWidth - 10));
      const style = meetingExportStyle(meeting, theme, palette);
      const narrow = mw < 115;
      const clipId = `event-${term}-${dayIndex}-${meetingIndex}`;
      const textX = mx + (narrow ? 9 : 12);
      const badgeWidth = Math.max(34, style.label.length * 6 + 12);
      svg += `<clipPath id="${clipId}"><rect x="${mx + 6}" y="${my + 3}" width="${mw - 12}" height="${mh - 6}" rx="7"/></clipPath>`;
      svg += `<g filter="url(#event-shadow)"><rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="10" fill="${style.base}" stroke="${style.border}" ${style.dashed ? 'stroke-dasharray="5 4"' : ""}/><path d="M${mx + 4} ${my + 9}V${my + mh - 9}" stroke="${style.accent}" stroke-width="4" stroke-linecap="round"/><path d="M${mx + 10} ${my + 1}H${mx + mw - 10}" stroke="${palette.highlight}" stroke-linecap="round"/></g>`;
      svg += `<g clip-path="url(#${clipId})">`;
      svg += `<text x="${textX}" y="${my + 20}" font-size="${narrow ? 10.5 : 12.5}" font-weight="790" letter-spacing="-.15" fill="${palette.foreground}">${escapeExportText(meeting.courseCode)}</text>`;
      if (!narrow && mw > 145) {
        svg += `<rect x="${mx + mw - badgeWidth - 9}" y="${my + 8}" width="${badgeWidth}" height="18" rx="6" fill="${style.badge}" stroke="${style.border}"/>`;
        svg += `<text x="${mx + mw - badgeWidth / 2 - 9}" y="${my + 21}" text-anchor="middle" font-size="8" font-weight="800" letter-spacing=".5" fill="${style.accent}">${style.label}</text>`;
      }
      if (mh >= 48)
        svg += `<text x="${textX}" y="${my + 38}" font-size="${narrow ? 8.5 : 10}" font-weight="610" fill="${palette.secondaryForeground}">${timeShort(meeting.startTime)}–${timeShort(meeting.endTime)}</text>`;
      if (!narrow && mh >= 66)
        svg += `<text x="${textX}" y="${my + 55}" font-size="10" font-weight="680" fill="${palette.secondaryForeground}">${escapeExportText(locationLabel(meeting))}</text>`;
      if (!narrow && mh >= 87 && mw >= 145)
        svg += `<text x="${textX}" y="${my + 72}" font-size="9.5" font-weight="520" fill="${palette.mutedForeground}">${escapeExportText(meeting.courseName)}</text>`;
      svg += `</g>`;
    });
  });
  return svg;
}

export function renderTimetableExportSvg(
  meetings: readonly Meeting[],
  plan: TimetableExportPlan,
  theme: ExportTheme = "light",
  fontDataUrl?: string,
) {
  const palette = EXPORT_PALETTES[theme];
  const title = plan.terms.length === 1 ? `${plan.terms[0]} schedule` : "Academic schedule";
  const fontFace = fontDataUrl
    ? `@font-face{font-family:GapwiseGeist;src:url('${fontDataUrl}') format('woff2');font-weight:100 900}`
    : "";
  let body = `<defs><radialGradient id="page-glow" cx="82%" cy="0%" r="68%"><stop offset="0" stop-color="${palette.pageGlow}"/><stop offset="1" stop-color="${palette.pageBackground}"/></radialGradient><filter id="panel-shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="${palette.shadow}"/></filter><filter id="event-shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${palette.shadow}"/></filter></defs>`;
  body += `<rect width="100%" height="100%" fill="url(#page-glow)"/>`;
  body += `<g><rect x="${PAGE_PADDING}" y="${PAGE_PADDING + 2}" width="38" height="38" rx="12" fill="${palette.accent}"/><path d="M${PAGE_PADDING + 10} ${PAGE_PADDING + 22}h7l4-9 5 17 4-8h6" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><text x="${PAGE_PADDING + 52}" y="${PAGE_PADDING + 18}" font-size="12" font-weight="760" letter-spacing="1.6" fill="${palette.accent}">GAPWISE</text><text x="${PAGE_PADDING + 52}" y="${PAGE_PADDING + 43}" font-size="28" font-weight="780" letter-spacing="-.8" fill="${palette.foreground}">${escapeExportText(title)}</text></g>`;
  plan.panels.forEach((panel) => {
    body += renderTerm(meetings, panel, theme, palette);
  });
  body += `<text x="${PAGE_PADDING}" y="${plan.height - 24}" font-size="11" font-weight="590" fill="${palette.mutedForeground}">Generated with Gapwise</text><text x="${plan.width - PAGE_PADDING}" y="${plan.height - 24}" text-anchor="end" font-size="11" font-weight="700" fill="${palette.accent}">gapwise.ca</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width}" height="${plan.height}" viewBox="0 0 ${plan.width} ${plan.height}"><style>${fontFace}text{font-family:GapwiseGeist,'Geist Variable',system-ui,sans-serif;font-variant-numeric:tabular-nums}</style>${body}</svg>`;
}

let geistDataPromise: Promise<string> | null = null;
async function embeddedGeistDataUrl() {
  geistDataPromise ??= fetch(geistFontUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Gapwise typography could not be prepared.");
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

export async function generateTimetablePng(
  meetings: readonly Meeting[],
  selection: ExportSelection,
  theme: ExportTheme = "light",
  ratio = typeof window === "undefined" ? 2 : window.devicePixelRatio,
  imageFactory: () => HTMLImageElement = () => new Image(),
  objectUrls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
  fontDataUrl?: string,
): Promise<{ blob: Blob; filename: string; plan: TimetableExportPlan }> {
  const plan = createTimetableExportPlan(meetings, selection, ratio);
  if (typeof document !== "undefined" && "fonts" in document) await document.fonts.ready;
  const embeddedFont = fontDataUrl ?? (await embeddedGeistDataUrl());
  const svg = renderTimetableExportSvg(meetings, plan, theme, embeddedFont);
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
    return { blob, filename: timetableExportFilename(selection, plan.terms), plan };
  } finally {
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
    objectUrls.revokeObjectURL(url);
  }
}

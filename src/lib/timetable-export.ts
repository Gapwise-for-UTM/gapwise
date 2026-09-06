import geistFontUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import { buildTimetableModel } from "./timetable-layout";
import {
  formatTime,
  isAssessmentWindow,
  locationLabel,
  TERMS,
  type ActivityType,
  type Meeting,
  type Term,
  visibleWeekdaysForMeetings,
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
  reserved: string;
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
    reserved: "#a66d1d",
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
    reserved: "#dfad52",
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
  startHour: number;
  endHour: number;
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
  startHour: number;
  endHour: number;
}

const GAP = 28;
const PAGE_PADDING = 36;
const HEADER_HEIGHT = 64;
const MAX_PIXELS = 16_000_000;
const EXPORT_TIME_GUTTER = 84;
const EXPORT_TIME_LABEL_INSET = 14;
const EXPORT_DAY_HEADER_HEIGHT = 46;

export function resolveExportTheme(
  appearance: ExportAppearance,
  resolvedTheme: ExportTheme,
): ExportTheme {
  return appearance === "match" ? resolvedTheme : appearance;
}

export function availableExportTerms(meetings: readonly Meeting[]): Term[] {
  return TERMS.filter((term) => meetings.some((meeting) => meeting.term === term));
}

function termMetrics(meetings: readonly Meeting[], term: Term) {
  const selected = meetings.filter((meeting) => meeting.term === term);
  const visibleDays = visibleWeekdaysForMeetings(selected);
  const model = buildTimetableModel(selected, visibleDays);
  const busiestDay = Math.max(
    0,
    ...visibleDays.map((day) => model.days.get(day)?.sorted.length ?? 0),
  );
  const maxLanes = Math.max(1, ...visibleDays.map((day) => model.days.get(day)?.laneCount ?? 1));
  const earliestMinute = Math.min(...selected.map((meeting) => meeting.startTime));
  const latestMinute = Math.max(...selected.map((meeting) => meeting.endTime));
  const startHour = Math.max(0, Math.floor(earliestMinute / 60) - 1);
  const endHour = Math.min(24, Math.ceil(latestMinute / 60) + 1);
  return {
    blocks: selected.length,
    busiestDay,
    maxLanes,
    hours: endHour - startHour,
    startHour,
    endHour,
  };
}

/** Plans a balanced composition from each term's real schedule span, overlap, and density. */
export function createTimetableExportPlan(
  meetings: readonly Meeting[],
  selection: ExportSelection,
  devicePixelRatio = 2,
): TimetableExportPlan {
  const available = availableExportTerms(meetings);
  const terms = selection === "all" ? available : available.filter((term) => term === selection);
  if (terms.length === 0) throw new Error("The selected term has no scheduled meetings.");

  const metrics = terms.map((term) => termMetrics(meetings, term));
  const startHour = Math.min(...metrics.map((metric) => metric.startHour));
  const endHour = Math.max(...metrics.map((metric) => metric.endHour));
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
  const termHeaderHeight = terms.length > 1 ? 58 : 0;
  const panelHeights = metrics.map((metric) =>
    Math.max(500, termHeaderHeight + 64 + metric.hours * (dense ? 58 : 54)),
  );
  const termHeight = Math.max(...panelHeights);
  const rows = Math.ceil(terms.length / columns);
  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(...panelHeights.filter((_, index) => Math.floor(index / columns) === row)),
  );
  const rowY = (row: number) =>
    PAGE_PADDING +
    HEADER_HEIGHT +
    rowHeights.slice(0, row).reduce((total, rowHeight) => total + rowHeight + GAP, 0);
  const width = PAGE_PADDING * 2 + columns * termWidth + (columns - 1) * GAP;
  const height =
    PAGE_PADDING * 2 +
    HEADER_HEIGHT +
    rowHeights.reduce((total, rowHeight) => total + rowHeight, 0) +
    Math.max(0, rows - 1) * GAP;
  const panels = terms.map((term, index) => {
    const row = Math.floor(index / columns);
    const lastCentered = layout === "balanced-grid" && terms.length === 3 && index === 2;
    const column = index % columns;
    const metric = metrics[index]!;
    return {
      term,
      x: lastCentered
        ? Math.round((width - termWidth) / 2)
        : PAGE_PADDING + column * (termWidth + GAP),
      y: rowY(row),
      width: termWidth,
      height: panelHeights[index]!,
      startHour: metric.startHour,
      endHour: metric.endHour,
    };
  });
  const requestedRatio = Math.min(3, Math.max(2, devicePixelRatio));
  const maxRatio = Math.sqrt(MAX_PIXELS / (width * height));
  const pixelRatio = Math.max(1.5, Math.min(requestedRatio, maxRatio));
  return {
    terms,
    layout,
    width,
    height,
    termWidth,
    termHeight,
    pixelRatio,
    panels,
    startHour,
    endHour,
  };
}

export function timetableExportTitle(terms: readonly Term[]): string {
  if (terms.length === 1) return `${terms[0]} timetable`;
  if (terms.includes("Fall") && terms.includes("Winter")) return "Fall/Winter timetable";
  return `${terms[0]} timetable`;
}

export function timetableExportFilename(
  selection: ExportSelection,
  terms: readonly Term[],
): string {
  const label = selection === "all" ? terms.join("-") : selection;
  return `${label.toLowerCase()}-timetable.png`;
}

export const escapeExportText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!,
  );

export function exportMinutePosition(minute: number, startHour: number, hourHeight: number) {
  return ((minute - startHour * 60) / 60) * hourHeight;
}

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
  const reserved = isAssessmentWindow(meeting);
  const activity: Record<ActivityType, string> = {
    LEC: palette.lec,
    TUT: palette.tut,
    PRA: palette.pra,
    OTHER: palette.other,
  };
  const custom = meeting.color && /^#[0-9a-f]{6}$/i.test(meeting.color) ? meeting.color : null;
  const accent = reserved
    ? palette.reserved
    : study
      ? palette.accent
      : custom
        ? exportSafeCustomAccent(custom, theme)
        : activity[meeting.activityType];
  return {
    accent,
    base: mixHex(
      palette.eventSurface,
      accent,
      reserved ? (theme === "dark" ? 0.16 : 0.13) : theme === "dark" ? 0.12 : 0.1,
    ),
    border: mixHex(
      palette.border,
      accent,
      reserved ? (theme === "dark" ? 0.6 : 0.64) : theme === "dark" ? 0.42 : 0.5,
    ),
    badge: mixHex(
      palette.eventSurface,
      accent,
      reserved ? (theme === "dark" ? 0.25 : 0.21) : theme === "dark" ? 0.2 : 0.16,
    ),
    dashed: study || reserved,
    reserved,
    label: reserved ? "RES" : study ? "STUDY" : personal ? "PERSONAL" : meeting.activityType,
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
  plan: TimetableExportPlan,
) {
  const { term, x, y, width, height, startHour, endHour } = panel;
  const selected = meetings.filter((meeting) => meeting.term === term);
  const visibleDays = visibleWeekdaysForMeetings(selected);
  const { days } = buildTimetableModel(selected, visibleDays);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const titleHeight = plan.terms.length > 1 ? 58 : 0;
  const dayHeight = EXPORT_DAY_HEADER_HEIGHT;
  const bottomPadding = 18;
  const axisWidth = EXPORT_TIME_GUTTER;
  const scheduleStartX = x + axisWidth;
  const scheduleEndX = x + width;
  const headerY = y + titleHeight;
  const gridY = headerY + dayHeight;
  const gridHeight = height - titleHeight - dayHeight - bottomPadding;
  const hourHeight = gridHeight / Math.max(1, hours.length);
  const dayWidth = (scheduleEndX - scheduleStartX) / visibleDays.length;
  const minuteY = (minute: number) => gridY + exportMinutePosition(minute, startHour, hourHeight);
  const panelClipId = `panel-${term.toLowerCase()}-${x}-${y}`;
  let svg = `<clipPath id="${panelClipId}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24"/></clipPath>`;
  svg += `<g filter="url(#panel-shadow)"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${palette.timetableBackground}" stroke="${palette.border}"/></g>`;
  svg += `<g clip-path="url(#${panelClipId})">`;
  if (titleHeight > 0) {
    svg += `<line x1="${scheduleStartX}" y1="${headerY}" x2="${scheduleEndX}" y2="${headerY}" stroke="${palette.border}"/>`;
    svg += `<text x="${x + 26}" y="${y + 36}" font-size="21" font-weight="760" letter-spacing="-.45" fill="${palette.foreground}">${term}</text>`;
    svg += `<text x="${x + width - 26}" y="${y + 35}" text-anchor="end" font-size="10" font-weight="650" letter-spacing="1.1" fill="${palette.mutedForeground}">${selected.length} ${selected.length === 1 ? "EVENT" : "EVENTS"}</text>`;
  }
  svg += `<rect x="${scheduleStartX}" y="${headerY}" width="${scheduleEndX - scheduleStartX}" height="${dayHeight}" fill="${palette.headerSurface}"/>`;
  visibleDays.forEach((day, index) => {
    const dx = scheduleStartX + index * dayWidth;
    svg += `<line x1="${dx}" y1="${headerY}" x2="${dx}" y2="${y + height - bottomPadding}" stroke="${palette.grid}"/>`;
    svg += `<text x="${dx + dayWidth / 2}" y="${headerY + 29}" text-anchor="middle" font-size="12" font-weight="720" fill="${palette.secondaryForeground}">${day.slice(0, 3).toUpperCase()}</text>`;
  });
  hours.forEach((hour) => {
    const hy = Math.round(minuteY(hour * 60)) + 0.5;
    svg += `<line x1="${scheduleStartX}" y1="${hy}" x2="${scheduleEndX}" y2="${hy}" stroke="${palette.grid}"/>`;
    svg += `<text x="${scheduleStartX - EXPORT_TIME_LABEL_INSET}" y="${hy}" dy="0.35em" text-anchor="end" font-size="10" font-weight="560" fill="${palette.mutedForeground}">${timeShort(hour * 60)}</text>`;
  });
  svg += `</g>`;
  visibleDays.forEach((day, dayIndex) => {
    const { laneCount, placement, sorted } = days.get(day)!;
    sorted.forEach((meeting, meetingIndex) => {
      const lane = placement.get(meeting.id) ?? 0;
      const laneWidth = dayWidth / laneCount;
      const mx = Math.round(scheduleStartX + dayIndex * dayWidth + lane * laneWidth + 5);
      const my = Math.round(minuteY(meeting.startTime));
      const mh = Math.max(1, Math.round(minuteY(meeting.endTime) - minuteY(meeting.startTime)));
      const mw = Math.max(34, Math.round(laneWidth - 10));
      const style = meetingExportStyle(meeting, theme, palette);
      const narrow = mw < 115;
      const clipId = `event-${term}-${dayIndex}-${meetingIndex}`;
      const textX = mx + (narrow ? 9 : 12);
      const badgeWidth = Math.max(34, style.label.length * 6 + 12);
      const showBadge = !narrow && mw > 145;
      const courseWidth = showBadge ? mw - badgeWidth - 34 : mw - 18;
      const courseFontSize = Math.max(
        8,
        Math.min(narrow ? 10.5 : 12.5, courseWidth / Math.max(1, meeting.courseCode.length * 0.6)),
      );
      const detailLine = style.reserved ? "Reserved assessment window" : locationLabel(meeting);
      const noteLine = style.reserved ? "Only active when announced" : meeting.courseName;
      svg += `<clipPath id="${clipId}"><rect x="${mx + 6}" y="${my + 3}" width="${mw - 12}" height="${mh - 6}" rx="7"/></clipPath>`;
      svg += `<g filter="url(#event-shadow)"><rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="10" fill="${style.base}" stroke="${style.border}" ${style.dashed ? 'stroke-dasharray="5 4"' : ""}/>${style.reserved ? `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="10" fill="url(#reserved-hatch)"/>` : ""}<path d="M${mx + 10} ${my + 1}H${mx + mw - 10}" stroke="${palette.highlight}" stroke-linecap="round"/></g>`;
      svg += `<g clip-path="url(#${clipId})">`;
      svg += `<text x="${textX}" y="${my + 20}" font-size="${courseFontSize}" font-weight="790" letter-spacing="-.15" fill="${palette.foreground}">${escapeExportText(meeting.courseCode)}</text>`;
      if (showBadge) {
        svg += `<rect x="${mx + mw - badgeWidth - 9}" y="${my + 8}" width="${badgeWidth}" height="18" rx="6" fill="${style.badge}" stroke="${style.border}"/>`;
        svg += `<text x="${mx + mw - badgeWidth / 2 - 9}" y="${my + 21}" text-anchor="middle" font-size="8" font-weight="800" letter-spacing=".5" fill="${style.accent}">${style.label}</text>`;
      }
      if (mh >= 48)
        svg += `<text x="${textX}" y="${my + 38}" font-size="${narrow ? 8.5 : 10}" font-weight="610" fill="${palette.secondaryForeground}">${timeShort(meeting.startTime)}–${timeShort(meeting.endTime)}</text>`;
      if (!narrow && mh >= 66)
        svg += `<text x="${textX}" y="${my + 55}" font-size="10" font-weight="680" fill="${style.reserved ? style.accent : palette.secondaryForeground}">${escapeExportText(detailLine)}</text>`;
      if (!narrow && mh >= 87 && mw >= 145)
        svg += `<text x="${textX}" y="${my + 72}" font-size="9.5" font-weight="520" fill="${style.reserved ? style.accent : palette.mutedForeground}">${escapeExportText(noteLine)}</text>`;
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
  const title = timetableExportTitle(plan.terms);
  const fontFace = fontDataUrl
    ? `@font-face{font-family:ExportGeist;src:url('${fontDataUrl}') format('woff2');font-weight:100 900}`
    : "";
  let body = `<defs><radialGradient id="page-glow" cx="82%" cy="0%" r="68%"><stop offset="0" stop-color="${palette.pageGlow}"/><stop offset="1" stop-color="${palette.pageBackground}"/></radialGradient><pattern id="reserved-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="14" fill="${palette.reserved}" opacity="${theme === "dark" ? "0.10" : "0.08"}"/></pattern><filter id="panel-shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="${palette.shadow}"/></filter><filter id="event-shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${palette.shadow}"/></filter></defs>`;
  body += `<rect width="100%" height="100%" fill="url(#page-glow)"/>`;
  body += `<text x="${PAGE_PADDING}" y="${PAGE_PADDING + 34}" font-size="30" font-weight="780" letter-spacing="-.8" fill="${palette.foreground}">${escapeExportText(title)}</text>`;
  plan.panels.forEach((panel) => {
    body += renderTerm(meetings, panel, theme, palette, plan);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width}" height="${plan.height}" viewBox="0 0 ${plan.width} ${plan.height}"><style>${fontFace}text{font-family:ExportGeist,'Geist Variable',system-ui,sans-serif;font-variant-numeric:tabular-nums}</style>${body}</svg>`;
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

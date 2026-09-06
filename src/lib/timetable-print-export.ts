import geistFontUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import { buildTimetableModel } from "./timetable-layout";
import {
  createTimetableExportPlan,
  escapeExportText,
  exportMinutePosition,
  timetableExportTitle,
  type ExportPanelPlacement,
  type ExportSelection,
  type TimetableExportPlan,
} from "./timetable-export";
import {
  formatTime,
  isAssessmentWindow,
  locationLabel,
  type ActivityType,
  type Meeting,
  type Term,
  visibleWeekdaysForMeetings,
} from "./timetable-types";

export interface TimetablePrintPalette {
  pageBackground: string;
  timetableBackground: string;
  headerSurface: string;
  eventSurface: string;
  alternateEventSurface: string;
  practiceEventSurface: string;
  foreground: string;
  secondaryForeground: string;
  mutedForeground: string;
  border: string;
  strongBorder: string;
  grid: string;
  badgeSurface: string;
}

/** Pure grayscale palette tuned for high-contrast paper output. */
export const PRINT_EXPORT_PALETTE: TimetablePrintPalette = {
  pageBackground: "#ffffff",
  timetableBackground: "#ffffff",
  headerSurface: "#f2f2f2",
  eventSurface: "#ffffff",
  alternateEventSurface: "#f7f7f7",
  practiceEventSurface: "#eeeeee",
  foreground: "#000000",
  secondaryForeground: "#1f1f1f",
  mutedForeground: "#555555",
  border: "#5f5f5f",
  strongBorder: "#161616",
  grid: "#b8b8b8",
  badgeSurface: "#efefef",
};

export interface MeetingPrintStyle {
  base: string;
  border: string;
  badge: string;
  dashed: boolean;
  label: string;
  strokeWidth: number;
  reserved: boolean;
}

/** Maps event semantics to monochrome styling without relying on source/custom colors. */
export function meetingPrintStyle(
  meeting: Meeting,
  palette: TimetablePrintPalette = PRINT_EXPORT_PALETTE,
): MeetingPrintStyle {
  const reserved = isAssessmentWindow(meeting);
  const study = meeting.sectionCode === "STUDY";
  const personal = meeting.sectionCode === "PERSONAL";
  const activitySurface: Record<ActivityType, string> = {
    LEC: palette.eventSurface,
    TUT: palette.alternateEventSurface,
    PRA: palette.practiceEventSurface,
    OTHER: palette.alternateEventSurface,
  };
  return {
    base: reserved
      ? palette.eventSurface
      : personal
        ? palette.practiceEventSurface
        : activitySurface[meeting.activityType],
    border: reserved || study || personal ? palette.strongBorder : palette.border,
    badge: reserved ? palette.eventSurface : palette.badgeSurface,
    dashed: reserved || study,
    label: reserved ? "RES" : study ? "STUDY" : personal ? "PERSONAL" : meeting.activityType,
    strokeWidth: reserved ? 1.7 : personal ? 1.7 : study ? 1.35 : 1.1,
    reserved,
  };
}

function timeShort(minutes: number) {
  return formatTime(minutes).replace(":00", "").replace(" ", "").toLowerCase();
}

function renderPrintTerm(
  meetings: readonly Meeting[],
  panel: ExportPanelPlacement,
  palette: TimetablePrintPalette,
  plan: TimetableExportPlan,
) {
  const { term, x, y, width, height, startHour, endHour } = panel;
  const selected = meetings.filter((meeting) => meeting.term === term);
  const visibleDays = visibleWeekdaysForMeetings(selected);
  const { days } = buildTimetableModel(selected, visibleDays);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const titleHeight = plan.terms.length > 1 ? 58 : 0;
  const dayHeight = 46;
  const bottomPadding = 18;
  const axisWidth = 84;
  const labelInset = 14;
  const scheduleStartX = x + axisWidth;
  const scheduleEndX = x + width;
  const headerY = y + titleHeight;
  const gridY = headerY + dayHeight;
  const gridHeight = height - titleHeight - dayHeight - bottomPadding;
  const hourHeight = gridHeight / Math.max(1, hours.length);
  const dayWidth = (scheduleEndX - scheduleStartX) / visibleDays.length;
  const minuteY = (minute: number) => gridY + exportMinutePosition(minute, startHour, hourHeight);
  const panelClipId = `print-panel-${term.toLowerCase()}-${x}-${y}`;

  let svg = `<clipPath id="${panelClipId}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18"/></clipPath>`;
  svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="${palette.timetableBackground}" stroke="${palette.strongBorder}" stroke-width="1.2"/>`;
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
    svg += `<text x="${dx + dayWidth / 2}" y="${headerY + 29}" text-anchor="middle" font-size="12" font-weight="760" letter-spacing=".35" fill="${palette.foreground}">${day.slice(0, 3).toUpperCase()}</text>`;
  });
  hours.forEach((hour) => {
    const hy = Math.round(minuteY(hour * 60)) + 0.5;
    svg += `<line x1="${scheduleStartX}" y1="${hy}" x2="${scheduleEndX}" y2="${hy}" stroke="${palette.grid}" stroke-width=".9"/>`;
    svg += `<text x="${scheduleStartX - labelInset}" y="${hy}" dy="0.35em" text-anchor="end" font-size="10" font-weight="590" fill="${palette.mutedForeground}">${timeShort(hour * 60)}</text>`;
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
      const style = meetingPrintStyle(meeting, palette);
      const narrow = mw < 115;
      const clipId = `print-event-${term}-${dayIndex}-${meetingIndex}`;
      const textX = mx + (narrow ? 9 : 12);
      const badgeWidth = Math.max(34, style.label.length * 6 + 12);
      const showBadge = !narrow && mw > 145;
      const courseWidth = showBadge ? mw - badgeWidth - 34 : mw - 18;
      const courseFontSize = Math.max(
        8,
        Math.min(narrow ? 10.5 : 12.5, courseWidth / Math.max(1, meeting.courseCode.length * 0.6)),
      );
      const cardFill = style.reserved ? "url(#print-reserved-hatch)" : style.base;
      svg += `<clipPath id="${clipId}"><rect x="${mx + 6}" y="${my + 3}" width="${mw - 12}" height="${Math.max(1, mh - 6)}" rx="6"/></clipPath>`;
      svg += `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="8" fill="${cardFill}" stroke="${style.border}" stroke-width="${style.strokeWidth}" ${style.dashed ? 'stroke-dasharray="5 4"' : ""}/>`;
      svg += `<g clip-path="url(#${clipId})">`;
      svg += `<text x="${textX}" y="${my + 20}" font-size="${courseFontSize}" font-weight="800" letter-spacing="-.15" fill="${palette.foreground}">${escapeExportText(meeting.courseCode)}</text>`;
      if (showBadge) {
        svg += `<rect x="${mx + mw - badgeWidth - 9}" y="${my + 8}" width="${badgeWidth}" height="18" rx="5" fill="${style.badge}" stroke="${palette.strongBorder}" stroke-width=".85"/>`;
        svg += `<text x="${mx + mw - badgeWidth / 2 - 9}" y="${my + 21}" text-anchor="middle" font-size="8" font-weight="820" letter-spacing=".5" fill="${palette.foreground}">${style.label}</text>`;
      }
      if (mh >= 48)
        svg += `<text x="${textX}" y="${my + 38}" font-size="${narrow ? 8.5 : 10}" font-weight="640" fill="${palette.secondaryForeground}">${timeShort(meeting.startTime)}–${timeShort(meeting.endTime)}</text>`;
      if (!narrow && mh >= 66)
        svg += `<text x="${textX}" y="${my + 55}" font-size="10" font-weight="${style.reserved ? 760 : 700}" fill="${palette.secondaryForeground}">${escapeExportText(style.reserved ? "Reserved assessment window" : locationLabel(meeting))}</text>`;
      if (!narrow && mh >= 87 && mw >= 145)
        svg += `<text x="${textX}" y="${my + 72}" font-size="9.5" font-weight="540" fill="${palette.mutedForeground}">${escapeExportText(style.reserved ? "Only active when announced" : meeting.courseName)}</text>`;
      svg += `</g>`;
    });
  });
  return svg;
}

/** Renders a resolution-independent, printer-safe monochrome timetable SVG. */
export function renderTimetablePrintSvg(
  meetings: readonly Meeting[],
  plan: TimetableExportPlan,
  fontDataUrl?: string,
) {
  const palette = PRINT_EXPORT_PALETTE;
  const title = timetableExportTitle(plan.terms);
  const fontFace = fontDataUrl
    ? `@font-face{font-family:PrintGeist;src:url('${fontDataUrl}') format('woff2');font-weight:100 900}`
    : "";
  let body = `<defs><pattern id="print-reserved-hatch" patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill="${palette.eventSurface}"/><path d="M-2 8L8-2M2 10L10 2" stroke="${palette.grid}" stroke-width=".75"/></pattern></defs>`;
  body += `<rect width="100%" height="100%" fill="${palette.pageBackground}"/>`;
  body += `<text x="36" y="70" font-size="30" font-weight="800" letter-spacing="-.8" fill="${palette.foreground}">${escapeExportText(title)}</text>`;
  body += `<line x1="36" y1="82" x2="${plan.width - 36}" y2="82" stroke="${palette.strongBorder}" stroke-width="1.15"/>`;
  plan.panels.forEach((panel) => {
    body += renderPrintTerm(meetings, panel, palette, plan);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${plan.width}" height="${plan.height}" viewBox="0 0 ${plan.width} ${plan.height}" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision" text-rendering="geometricPrecision"><style>${fontFace}text{font-family:PrintGeist,'Geist Variable',system-ui,sans-serif;font-variant-numeric:tabular-nums}</style>${body}</svg>`;
}

export function timetablePrintFilename(selection: ExportSelection, terms: readonly Term[]): string {
  const label = selection === "all" ? terms.join("-") : selection;
  return `${label.toLowerCase()}-timetable-print.svg`;
}

let geistDataPromise: Promise<string> | null = null;
async function embeddedPrintGeistDataUrl() {
  geistDataPromise ??= fetch(geistFontUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Print typography could not be prepared.");
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

/** Builds a self-contained vector file suitable for arbitrarily high-DPI printing. */
export async function generateTimetablePrintSvg(
  meetings: readonly Meeting[],
  selection: ExportSelection,
  fontDataUrl?: string,
): Promise<{ blob: Blob; filename: string; plan: TimetableExportPlan }> {
  const plan = createTimetableExportPlan(meetings, selection, 2);
  if (typeof document !== "undefined" && "fonts" in document) await document.fonts.ready;
  const embeddedFont = fontDataUrl ?? (await embeddedPrintGeistDataUrl());
  const svg = renderTimetablePrintSvg(meetings, plan, embeddedFont);
  return {
    blob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    filename: timetablePrintFilename(selection, plan.terms),
    plan,
  };
}

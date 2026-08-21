import { buildTimetableModel } from "./timetable-layout";
import {
  formatTime,
  locationLabel,
  TERMS,
  type Meeting,
  type Term,
  WEEKDAYS,
} from "./timetable-types";

export type ExportSelection = Term | "all";
export type ExportLayout = "single" | "side-by-side" | "grid" | "stacked";

export interface TimetableExportPlan {
  terms: Term[];
  layout: ExportLayout;
  width: number;
  height: number;
  columns: number;
  termWidth: number;
  termHeight: number;
  pixelRatio: number;
}

const CARD_GAP = 28;
const PAGE_PADDING = 48;
const HEADER_HEIGHT = 90;
const FOOTER_HEIGHT = 42;
const MAX_RASTER_PIXELS = 16_000_000;

// Keep these aligned with the light-theme timetable tokens in src/styles.css.
// The export is intentionally a stable light artifact regardless of the current app theme.
const EXPORT_ACTIVITY_COLORS = {
  LEC: "oklch(0.5 0.15 252)",
  TUT: "oklch(0.54 0.14 225)",
  PRA: "oklch(0.53 0.14 302)",
  OTHER: "oklch(0.47 0.028 258)",
} as const;
const EXPORT_ACCENT = "oklch(0.55 0.17 252)";

export function availableExportTerms(meetings: readonly Meeting[]): Term[] {
  return TERMS.filter((term) => meetings.some((meeting) => meeting.term === term));
}

function termDensity(meetings: readonly Meeting[], term: Term) {
  const selected = meetings.filter((meeting) => meeting.term === term);
  const perDay = WEEKDAYS.map(
    (day) => selected.filter((meeting) => meeting.weekday === day).length,
  );
  const earliest = Math.min(...selected.map((meeting) => meeting.startTime));
  const latest = Math.max(...selected.map((meeting) => meeting.endTime));
  return {
    blocks: selected.length,
    busiestDay: Math.max(0, ...perDay),
    span: Number.isFinite(earliest) ? latest - earliest : 0,
  };
}

/** Chooses a readable composition and a bounded retina scale before any DOM work begins. */
export function createTimetableExportPlan(
  meetings: readonly Meeting[],
  selection: ExportSelection,
  devicePixelRatio = 2,
): TimetableExportPlan {
  const available = availableExportTerms(meetings);
  const terms = selection === "all" ? available : available.filter((term) => term === selection);
  if (terms.length === 0) throw new Error("The selected term has no scheduled meetings.");

  const dense = terms.some((term) => {
    const density = termDensity(meetings, term);
    return density.blocks >= 18 || density.busiestDay >= 6 || density.span >= 780;
  });
  const layout: ExportLayout =
    terms.length === 1
      ? "single"
      : terms.length === 2
        ? dense
          ? "stacked"
          : "side-by-side"
        : dense
          ? "stacked"
          : "grid";
  const columns = layout === "side-by-side" || layout === "grid" ? 2 : 1;
  const rows = Math.ceil(terms.length / columns);
  const termWidth = columns === 1 ? 1180 : 1040;
  const maxHours = Math.max(
    ...terms.map(
      (term) => buildTimetableModel(meetings.filter((m) => m.term === term)).hours.length,
    ),
  );
  const termHeight = Math.max(570, 112 + maxHours * (dense ? 56 : 50));
  const width = PAGE_PADDING * 2 + columns * termWidth + (columns - 1) * CARD_GAP;
  const height =
    PAGE_PADDING * 2 + HEADER_HEIGHT + rows * termHeight + (rows - 1) * CARD_GAP + FOOTER_HEIGHT;
  const requestedRatio = Math.min(3, Math.max(2, devicePixelRatio));
  const maxRatio = Math.sqrt(MAX_RASTER_PIXELS / (width * height));
  const pixelRatio = Math.min(requestedRatio, maxRatio);
  return { terms, layout, width, height, columns, termWidth, termHeight, pixelRatio };
}

export function timetableExportFilename(
  selection: ExportSelection,
  terms: readonly Term[],
): string {
  const label = selection === "all" ? terms.join("-") : selection;
  return `gapwise-${label.toLowerCase()}-timetable.png`;
}

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!,
  );

function activityColor(meeting: Meeting) {
  if (meeting.color && /^#[0-9a-f]{6}$/i.test(meeting.color)) return meeting.color;
  if (meeting.sectionCode === "STUDY") return EXPORT_ACCENT;
  return EXPORT_ACTIVITY_COLORS[meeting.activityType];
}

function renderTerm(
  meetings: readonly Meeting[],
  term: Term,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const selected = meetings.filter((meeting) => meeting.term === term);
  const { startHour, hours, days } = buildTimetableModel(selected);
  const titleHeight = 58;
  const dayHeight = 44;
  const axisWidth = 72;
  const gridY = y + titleHeight + dayHeight;
  const gridHeight = height - titleHeight - dayHeight - 20;
  const hourHeight = gridHeight / Math.max(1, hours.length);
  const dayWidth = (width - axisWidth) / 5;
  const minuteY = (minute: number) => gridY + ((minute - startHour * 60) / 60) * hourHeight;
  let svg = `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="22" fill="#ffffff" stroke="#cbd5e1"/>`;
  svg += `<text x="${x + 24}" y="${y + 35}" font-size="24" font-weight="750" fill="#172033">${term} timetable</text>`;
  svg += `<text x="${x + width - 24}" y="${y + 34}" text-anchor="end" font-size="13" font-weight="600" fill="#64748b">${selected.length} scheduled ${selected.length === 1 ? "block" : "blocks"}</text>`;
  svg += `<rect x="${x}" y="${y + titleHeight}" width="${width}" height="${dayHeight}" fill="#f5f7fb"/>`;
  svg += `<text x="${x + 18}" y="${y + titleHeight + 28}" font-size="12" font-weight="650" fill="#64748b">TIME</text>`;
  WEEKDAYS.forEach((day, index) => {
    const dx = x + axisWidth + index * dayWidth;
    svg += `<line x1="${dx}" y1="${y + titleHeight}" x2="${dx}" y2="${y + height - 20}" stroke="#d9e0ea"/>`;
    svg += `<text x="${dx + 14}" y="${y + titleHeight + 28}" font-size="14" font-weight="750" fill="#172033">${day}</text>`;
  });
  hours.forEach((hour) => {
    const hy = minuteY(hour * 60);
    svg += `<line x1="${x}" y1="${hy}" x2="${x + width}" y2="${hy}" stroke="#e2e8f0"/>`;
    svg += `<text x="${x + axisWidth - 10}" y="${hy + 15}" text-anchor="end" font-size="11" font-weight="550" fill="#64748b">${formatTime(hour * 60).replace(":00", "")}</text>`;
  });
  WEEKDAYS.forEach((day, dayIndex) => {
    const { laneCount, placement, sorted } = days.get(day)!;
    sorted.forEach((meeting) => {
      const lane = placement.get(meeting.id) ?? 0;
      const laneWidth = dayWidth / laneCount;
      const mx = x + axisWidth + dayIndex * dayWidth + lane * laneWidth + 4;
      const my = minuteY(meeting.startTime) + 3;
      const mh = Math.max(25, minuteY(meeting.endTime) - minuteY(meeting.startTime) - 6);
      const mw = laneWidth - 8;
      const color = activityColor(meeting);
      const compact = mh < 72 || laneCount > 1;
      const studyStroke = meeting.sectionCode === "STUDY" ? ' stroke-dasharray="6 4"' : "";
      svg += `<g><rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="9" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-opacity="0.48"${studyStroke}/>`;
      svg += `<rect x="${mx}" y="${my}" width="4" height="${mh}" rx="2" fill="${color}"/>`;
      svg += `<text x="${mx + 11}" y="${my + 19}" font-size="${laneCount > 1 ? 11 : 13}" font-weight="800" fill="#172033">${escapeXml(meeting.courseCode.slice(0, laneCount > 1 ? 13 : 20))}</text>`;
      svg += `<text x="${mx + mw - 9}" y="${my + 18}" text-anchor="end" font-size="9" font-weight="800" fill="${color}">${meeting.sectionCode === "STUDY" ? "STUDY" : meeting.activityType}</text>`;
      if (mh >= 46)
        svg += `<text x="${mx + 11}" y="${my + 36}" font-size="10" font-weight="600" fill="#526079">${escapeXml(`${formatTime(meeting.startTime).replace(" ", "")}–${formatTime(meeting.endTime).replace(" ", "")}`)}</text>`;
      if (!compact && mh >= 66)
        svg += `<text x="${mx + 11}" y="${my + 53}" font-size="11" font-weight="700" fill="#334155">${escapeXml(meeting.sectionCode === "STUDY" ? meeting.notes || "Planned study" : locationLabel(meeting).slice(0, 24))}</text>`;
      if (!compact && mh >= 86)
        svg += `<text x="${mx + 11}" y="${my + 70}" font-size="10" fill="#64748b">${escapeXml(meeting.courseName.slice(0, 28))}</text>`;
      svg += `</g>`;
    });
  });
  return `${svg}</g>`;
}

export function renderTimetableExportSvg(meetings: readonly Meeting[], plan: TimetableExportPlan) {
  const generated = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date());
  let body = `<rect width="100%" height="100%" fill="#f3f6fb"/><circle cx="${plan.width - 80}" cy="50" r="180" fill="#2563eb" fill-opacity=".06"/>`;
  body += `<text x="${PAGE_PADDING}" y="${PAGE_PADDING + 30}" font-size="30" font-weight="780" fill="#172033">My Gapwise schedule</text>`;
  body += `<text x="${PAGE_PADDING}" y="${PAGE_PADDING + 57}" font-size="14" fill="#64748b">A clear weekly view of ${plan.terms.join(", ")}</text>`;
  plan.terms.forEach((term, index) => {
    const column = index % plan.columns;
    const row = Math.floor(index / plan.columns);
    const isLoneFinalCard =
      plan.columns > 1 &&
      plan.terms.length % plan.columns === 1 &&
      index === plan.terms.length - 1;
    const x = isLoneFinalCard
      ? (plan.width - plan.termWidth) / 2
      : PAGE_PADDING + column * (plan.termWidth + CARD_GAP);
    const y = PAGE_PADDING + HEADER_HEIGHT + row * (plan.termHeight + CARD_GAP);
    body += renderTerm(meetings, term, x, y, plan.termWidth, plan.termHeight);
  });
  body += `<text x="${PAGE_PADDING}" y="${plan.height - 24}" font-size="12" font-weight="650" fill="#64748b">Generated locally by Gapwise · ${escapeXml(generated)}</text>`;
  body += `<text x="${plan.width - PAGE_PADDING}" y="${plan.height - 24}" text-anchor="end" font-size="13" font-weight="800" fill="#2563eb">gapwise.ca</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width}" height="${plan.height}" viewBox="0 0 ${plan.width} ${plan.height}"><style>text{font-family:'Geist Variable','Geist',ui-sans-serif,system-ui,sans-serif}</style>${body}</svg>`;
}

export async function generateTimetablePng(
  meetings: readonly Meeting[],
  selection: ExportSelection,
  ratio = typeof window === "undefined" ? 2 : window.devicePixelRatio,
  imageFactory: () => HTMLImageElement = () => new Image(),
  objectUrls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
): Promise<{ blob: Blob; filename: string; plan: TimetableExportPlan }> {
  const plan = createTimetableExportPlan(meetings, selection, ratio);
  if (typeof document !== "undefined" && "fonts" in document) await document.fonts.ready;
  const svg = renderTimetableExportSvg(meetings, plan);
  const url = objectUrls.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = imageFactory();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The timetable artwork could not be rendered."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(plan.width * plan.pixelRatio);
    canvas.height = Math.round(plan.height * plan.pixelRatio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is not supported by this browser.");
    context.scale(plan.pixelRatio, plan.pixelRatio);
    context.drawImage(image, 0, 0, plan.width, plan.height);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The PNG could not be created.");
      return { blob, filename: timetableExportFilename(selection, plan.terms), plan };
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    objectUrls.revokeObjectURL(url);
  }
}

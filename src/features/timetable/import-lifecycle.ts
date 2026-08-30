import type { Meeting } from "@/lib/timetable-types";

export const MAX_ICS_FILE_BYTES = 2 * 1024 * 1024;

export type TimetableImportResult = Awaited<ReturnType<typeof parseTimetableText>>;

export function validateTimetableFile(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!/\.ics$/i.test(file.name) && file.type !== "text/calendar") {
    return "That file type isn't supported. Please choose a .ics calendar file.";
  }
  if (file.size > MAX_ICS_FILE_BYTES) {
    return "That calendar is too large. Please choose an .ics file under 2 MB.";
  }
  return null;
}

export async function parseTimetableText(text: string) {
  // Calendar parsing and location metadata remain browser-local. Canonical title
  // enrichment only sends three-letter subject prefixes (for example CSC/MAT)
  // to Gapwise, never the raw .ics file or the student's exact course list.
  const { parseIcs } = await import("@/lib/ics-parser");
  const { enrichCourseTitles } = await import("@/lib/course-title-catalog");
  const parsed = parseIcs(text);
  const meetings = await enrichCourseTitles(parsed.meetings);
  return { ...parsed, meetings };
}

export function timetableImportError(error: unknown): string {
  return error instanceof Error && error.name === "IcsParseError"
    ? error.message
    : "Something went wrong while reading that calendar. Try exporting it from ACORN again.";
}

export function describeTimetableChanges(
  previousMeetings: readonly Meeting[],
  nextMeetings: readonly Meeting[],
): string {
  const previousById = new Map(previousMeetings.map((meeting) => [meeting.id, meeting]));
  const nextIds = new Set(nextMeetings.map((meeting) => meeting.id));
  const added = nextMeetings.filter((meeting) => !previousById.has(meeting.id)).length;
  const removed = previousMeetings.filter((meeting) => !nextIds.has(meeting.id)).length;
  const changed = nextMeetings.filter((meeting) => {
    const previous = previousById.get(meeting.id);
    return previous && JSON.stringify(previous) !== JSON.stringify(meeting);
  }).length;
  const changes = [
    added ? `${added} added` : null,
    removed ? `${removed} removed` : null,
    changed ? `${changed} updated` : null,
  ].filter((change): change is string => change !== null);

  return changes.length ? changes.join(" · ") : "no meeting changes";
}

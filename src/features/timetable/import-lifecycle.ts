import { IcsParseError, MAX_ICS_FILE_BYTES, parseIcs } from "@/lib/ics-parser";
import type { Meeting } from "@/lib/timetable-types";

export type TimetableImportResult = ReturnType<typeof parseIcs>;

export function validateTimetableFile(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!/\.ics$/i.test(file.name) && file.type !== "text/calendar") {
    return "That file type isn't supported. Please choose a .ics calendar file.";
  }
  if (file.size > MAX_ICS_FILE_BYTES) {
    return "That calendar is too large. Please choose an .ics file under 2 MB.";
  }
  return null;
}

export function parseTimetableText(text: string): TimetableImportResult {
  return parseIcs(text);
}

export function timetableImportError(error: unknown): string {
  return error instanceof IcsParseError
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

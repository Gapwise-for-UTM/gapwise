import type { GapPreferences } from "@/features/gaps/types";
import type { UserPreferences } from "@/features/sync/preferences";
import type { PersonalItem } from "@/lib/personal-types";
import type { Meeting } from "@/lib/timetable-types";
import type { AiPermissions, AiSnapshot } from "./types";

function aiMeeting(meeting: Meeting): AiSnapshot["schedule"][number] {
  const result: AiSnapshot["schedule"][number] = {
    id: meeting.id,
    courseCode: meeting.courseCode,
    activityType: meeting.activityType,
    sectionCode: meeting.sectionCode,
    courseName: meeting.courseName,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    weekday: meeting.weekday,
    buildingCode: meeting.buildingCode,
    room: meeting.room,
    term: meeting.term,
    locationUnknown: meeting.locationUnknown,
  };
  if (meeting.locationType) result.locationType = meeting.locationType;
  if (meeting.dateRange) result.dateRange = { ...meeting.dateRange };
  if (meeting.excludedDates) result.excludedDates = [...meeting.excludedDates];
  if (meeting.recurrenceIntervalWeeks !== undefined) {
    result.recurrenceIntervalWeeks = meeting.recurrenceIntervalWeeks;
  }
  return result;
}

function aiPersonalItem(item: PersonalItem): AiSnapshot["personalItems"][number] {
  const result: AiSnapshot["personalItems"][number] = {
    id: item.id,
    title: item.title,
    category: item.category,
    term: item.term,
    weekday: item.weekday,
    flexibility: { ...item.flexibility },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
  if (item.startTime !== undefined) result.startTime = item.startTime;
  if (item.endTime !== undefined) result.endTime = item.endTime;
  if (item.locationBuildingCode !== undefined) {
    result.locationBuildingCode = item.locationBuildingCode;
  }
  if (item.locationRoom !== undefined) result.locationRoom = item.locationRoom;
  if (item.locationText !== undefined) result.locationText = item.locationText;
  if (item.color !== undefined) result.color = item.color;
  return result;
}

function aiRoutingPreferences(preferences: UserPreferences): AiSnapshot["routingPreferences"] {
  return {
    mode: preferences.mode,
    walkingSpeedMps: preferences.walkingSpeedMps,
    transitionBufferMinutes: preferences.transitionBufferMinutes,
    avoidStairs: preferences.avoidStairs,
    preferIndoor: preferences.preferIndoor,
    dayOrigin: preferences.dayOrigin,
    residenceBuildingCode: preferences.residenceBuildingCode,
    commuteMode: preferences.commuteMode,
    campusAccessPointId: preferences.campusAccessPointId,
  };
}

export function aiSnapshotContent(input: {
  meetings: Meeting[];
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  permissions: AiPermissions;
}) {
  return {
    permissions: input.permissions,
    schedule: input.meetings.map(aiMeeting),
    personalItems: input.permissions.readPersonal ? input.personalItems.map(aiPersonalItem) : [],
    gapPreferences: input.permissions.readGapPreferences ? input.gapPreferences : null,
    routingPreferences: input.permissions.readRoutingPreferences
      ? aiRoutingPreferences(input.preferences)
      : null,
  };
}

export function aiSnapshotFingerprint(input: Parameters<typeof aiSnapshotContent>[0]): string {
  return JSON.stringify(aiSnapshotContent(input));
}

export function buildAiSnapshot(
  revision: number,
  input: Parameters<typeof aiSnapshotContent>[0],
): AiSnapshot {
  return {
    schemaVersion: 1,
    revision,
    generatedAt: new Date().toISOString(),
    ...aiSnapshotContent(input),
  };
}

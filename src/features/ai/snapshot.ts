import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { planGapAssessment } from "@/features/gaps/assess-gap";
import type { GapPreferences } from "@/features/gaps/types";
import { createScheduleTransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import { findGaps } from "@/lib/gaps";
import { availableScheduleTerms } from "@/lib/personal-scheduler";
import type { PersonalItem } from "@/lib/personal-types";
import { isAssessmentWindow, type Meeting } from "@/lib/timetable-types";
import { normalizeAiPermissions, type AiPermissions, type AiSnapshot } from "./types";

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
    isReservedAssessmentWindow: isAssessmentWindow(meeting),
  };
  if (meeting.locationType) result.locationType = meeting.locationType;
  if (meeting.dateRange) result.dateRange = { ...meeting.dateRange };
  if (meeting.excludedDates) result.excludedDates = [...meeting.excludedDates];
  if (meeting.recurrenceIntervalWeeks !== undefined) {
    result.recurrenceIntervalWeeks = meeting.recurrenceIntervalWeeks;
  }
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

function aiGapPlans(input: {
  meetings: Meeting[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  permissions: AiPermissions;
}): AiSnapshot["gapPlans"] {
  if (!input.permissions.readGapPlans) return [];

  // Personal Items are retired. Gap boundaries are the same academic commitments the live
  // timetable uses; reserved assessment placeholders are already ignored by findGaps.
  const planTransition = createScheduleTransitionPlanner(UTM_ROUTING_GRAPH, input.meetings);

  return availableScheduleTerms(input.meetings).flatMap((term) =>
    findGaps(input.meetings, term).map((gap) => {
      const { assessment } = planGapAssessment(
        gap,
        input.preferences,
        input.gapPreferences,
        planTransition,
      );
      return {
        id: gap.id,
        term: gap.term,
        weekday: gap.weekday,
        startTime: gap.startTime,
        endTime: gap.endTime,
        durationMinutes: gap.durationMinutes,
        previousMeetingId: gap.previous.id,
        nextMeetingId: gap.next.id,
        assessment,
      };
    }),
  );
}

export function aiSnapshotContent(input: {
  meetings: Meeting[];
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  permissions: AiPermissions;
}) {
  const permissions = normalizeAiPermissions(input.permissions);
  return {
    permissions,
    schedule: input.meetings.map(aiMeeting),
    // Schema-v1 compatibility field. Personal Items are retired and are no longer delegated.
    personalItems: [] as AiSnapshot["personalItems"],
    gapPlans: aiGapPlans({
      meetings: input.meetings,
      preferences: input.preferences,
      gapPreferences: input.gapPreferences,
      permissions,
    }),
    gapPreferences: permissions.readGapPreferences ? input.gapPreferences : null,
    routingPreferences: permissions.readRoutingPreferences
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
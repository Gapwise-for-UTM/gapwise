import type { Meeting } from "@/lib/timetable-types";
import { requireSupabaseClient, type Json } from "@/lib/supabase";
import { deserializeSchedule, serializeSchedule } from "./schedule-serialization";
import { sanitizeUserPreferences, type UserPreferences } from "./preferences";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";

async function currentUserId(): Promise<string> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in before using cloud sync.");
  return data.user.id;
}

export async function saveSchedule(meetings: Meeting[]): Promise<void> {
  if (isEncryptedPrivateCloudAuthoritative) {
    throw new Error("Use encrypted private-data sync on this deployment.");
  }
  const supabase = requireSupabaseClient();
  const userId = await currentUserId();
  const { error } = await supabase.from("user_schedules").upsert({
    user_id: userId,
    meetings: serializeSchedule(meetings) as unknown as Json,
    schema_version: 1,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export type CloudScheduleRecord = {
  meetings: Meeting[];
  updatedAt: string | null;
  privateData?: PrivateDataPayloadV1;
  storageSource?: "legacy-cloud" | "secure-local" | "encrypted-cloud";
  persistentKeys?: boolean;
};

export async function loadScheduleRecord(
  authenticatedUserId?: string,
  signal?: AbortSignal,
): Promise<CloudScheduleRecord | null> {
  if (isEncryptedPrivateCloudAuthoritative) {
    throw new Error("Legacy plaintext restore is disabled on this deployment.");
  }
  const supabase = requireSupabaseClient();
  const userId = authenticatedUserId ?? (await currentUserId());
  let query = supabase.from("user_schedules").select("meetings, updated_at").eq("user_id", userId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data
    ? { meetings: deserializeSchedule(data.meetings), updatedAt: data.updated_at ?? null }
    : null;
}

export async function loadSchedule(): Promise<Meeting[] | null> {
  return (await loadScheduleRecord())?.meetings ?? null;
}

export async function deleteSchedule(): Promise<void> {
  if (isEncryptedPrivateCloudAuthoritative) return;
  const supabase = requireSupabaseClient();
  const userId = await currentUserId();
  const { error } = await supabase.from("user_schedules").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function deletePreferences(): Promise<void> {
  if (isEncryptedPrivateCloudAuthoritative) return;
  const supabase = requireSupabaseClient();
  const userId = await currentUserId();
  const { error } = await supabase.from("user_preferences").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function savePreferences(preferences: UserPreferences): Promise<void> {
  if (isEncryptedPrivateCloudAuthoritative) {
    throw new Error("Private settings are included in encrypted private-data sync.");
  }
  const supabase = requireSupabaseClient();
  const userId = await currentUserId();
  const value = sanitizeUserPreferences(preferences);
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: userId,
    walking_speed_mps: value.walkingSpeedMps,
    route_mode: value.mode,
    transition_buffer_minutes: value.transitionBufferMinutes,
    avoid_stairs: value.avoidStairs,
    prefer_indoor: value.preferIndoor,
    day_origin: value.dayOrigin,
    residence_building_code: value.residenceBuildingCode,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function loadPreferences(): Promise<UserPreferences | null> {
  if (isEncryptedPrivateCloudAuthoritative) {
    throw new Error("Legacy plaintext settings are disabled on this deployment.");
  }
  const supabase = requireSupabaseClient();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("user_preferences")
    .select(
      "walking_speed_mps, route_mode, transition_buffer_minutes, avoid_stairs, prefer_indoor, day_origin, residence_building_code",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return sanitizeUserPreferences({
    walkingSpeedMps: data.walking_speed_mps,
    mode: data.route_mode as UserPreferences["mode"],
    transitionBufferMinutes: data.transition_buffer_minutes,
    avoidStairs: data.avoid_stairs,
    preferIndoor: data.prefer_indoor,
    dayOrigin: data.day_origin as UserPreferences["dayOrigin"],
    residenceBuildingCode: data.residence_building_code,
  });
}

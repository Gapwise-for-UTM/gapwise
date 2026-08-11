import type { User } from "@supabase/supabase-js";
import { requireSupabaseClient } from "@/lib/supabase";
import { TERMS, WEEKDAYS, type Term, type Weekday } from "@/lib/timetable-types";
import type { FriendConnection, FriendGapOverlap, FriendInvite } from "./types";

const DISPLAY_NAME_LIMIT = 80;

export function sanitizeFriendDisplayName(value: string): string {
  const normalized = [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127 && !(codePoint >= 0x80 && codePoint <= 0x9f);
    })
    .slice(0, DISPLAY_NAME_LIMIT)
    .join("")
    .trim();
  if (!normalized) return "Gapwise friend";
  return normalized;
}

export class FriendOverlapRateLimitError extends Error {
  constructor() {
    super("Friend overlap refresh limit reached.");
  }
}

/** Never uses the Auth email address as a social identifier. */
export function defaultFriendDisplayName(user: User): string {
  const metadata = user.user_metadata ?? {};
  for (const key of ["user_name", "preferred_username", "name", "full_name"]) {
    const candidate = metadata[key];
    if (typeof candidate !== "string") continue;
    const sanitized = sanitizeFriendDisplayName(candidate);
    if (sanitized !== "Gapwise friend" && !sanitized.includes("@")) return sanitized;
  }
  return "Gapwise friend";
}

export async function loadOwnFriendProfile(userId: string): Promise<string | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from("friend_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.display_name ?? null;
}

export async function saveFriendProfile(userId: string, displayName: string): Promise<string> {
  const supabase = requireSupabaseClient();
  const value = sanitizeFriendDisplayName(displayName);
  const { error } = await supabase.from("friend_profiles").upsert({
    user_id: userId,
    display_name: value,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return value;
}

export async function createFriendInvite(): Promise<FriendInvite> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("create_friend_invite");
  if (error) throw error;
  const invite = data?.[0];
  if (!invite) throw new Error("A private friend code could not be created.");
  return { code: invite.invite_code, expiresAt: invite.expires_at };
}

export async function disableFriendInvite(): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.rpc("disable_friend_invite");
  if (error) throw error;
}

export async function submitFriendInviteCode(code: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.rpc("claim_friend_invite", {
    p_invite_code: code.trim(),
  });
  if (error) throw error;
}

export async function loadFriendConnections(userId: string): Promise<FriendConnection[]> {
  const supabase = requireSupabaseClient();
  const { data: relationships, error } = await supabase
    .from("friendships")
    .select("id, user_a_id, user_b_id, requested_by, status, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const friendIds = [
    ...new Set(
      (relationships ?? []).map((relationship) =>
        relationship.user_a_id === userId ? relationship.user_b_id : relationship.user_a_id,
      ),
    ),
  ];
  const profiles = new Map<string, string>();
  if (friendIds.length > 0) {
    const { data, error: profileError } = await supabase
      .from("friend_profiles")
      .select("user_id, display_name")
      .in("user_id", friendIds);
    if (profileError) throw profileError;
    for (const profile of data ?? []) profiles.set(profile.user_id, profile.display_name);
  }

  return (relationships ?? []).flatMap((relationship) => {
    if (relationship.status !== "pending" && relationship.status !== "accepted") return [];
    const friendUserId =
      relationship.user_a_id === userId ? relationship.user_b_id : relationship.user_a_id;
    return [
      {
        id: relationship.id,
        friendUserId,
        displayName: profiles.get(friendUserId) ?? "Gapwise friend",
        status: relationship.status,
        direction:
          relationship.status === "accepted"
            ? "mutual"
            : relationship.requested_by === userId
              ? "outgoing"
              : "incoming",
        updatedAt: relationship.updated_at,
      } satisfies FriendConnection,
    ];
  });
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.rpc("respond_to_friend_request", {
    p_friendship_id: friendshipId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function revokeFriendship(friendshipId: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.rpc("revoke_friendship", {
    p_friendship_id: friendshipId,
  });
  if (error) throw error;
}

export async function loadFriendGapOverlaps(term: Term): Promise<FriendGapOverlap[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("get_friend_gap_overlaps", { p_term: term });
  if (error?.code === "P0001") throw new FriendOverlapRateLimitError();
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    if (
      !TERMS.includes(term) ||
      !WEEKDAYS.includes(row.weekday as Weekday) ||
      !Number.isInteger(row.start_minute) ||
      !Number.isInteger(row.end_minute) ||
      row.start_minute < 0 ||
      row.end_minute > 24 * 60 ||
      row.end_minute <= row.start_minute
    ) {
      return [];
    }
    return [
      {
        friendshipId: row.friendship_id,
        friendDisplayName: row.friend_display_name,
        term,
        weekday: row.weekday as Weekday,
        startMinute: row.start_minute,
        endMinute: row.end_minute,
      } satisfies FriendGapOverlap,
    ];
  });
}

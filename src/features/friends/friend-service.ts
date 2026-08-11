import type { User } from "@supabase/supabase-js";
import { requireSupabaseClient } from "@/lib/supabase";
import { TERMS, WEEKDAYS, type Term, type Weekday } from "@/lib/timetable-types";
import type { FriendConnection, FriendGapOverlap, FriendInvite } from "./types";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import { AVAILABILITY_RESPONSE_CAP } from "@/features/security/availability-capsule";

const DISPLAY_NAME_LIMIT = 80;
const UNSAFE_DISPLAY_CHARACTER = /[\p{Cc}\p{Cf}]/u;

export function sanitizeFriendDisplayName(value: string): string {
  const normalized = [...value]
    .filter((character) => !UNSAFE_DISPLAY_CHARACTER.test(character))
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

export function parseCommonGapResponse(
  value: unknown,
): Array<{ weekday: Weekday; startMinute: number; endMinute: number }> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("windows" in value) ||
    !Array.isArray(value.windows) ||
    value.windows.length > AVAILABILITY_RESPONSE_CAP
  ) {
    throw new Error("Common-gap response is malformed.");
  }
  return value.windows.map((window: unknown) => {
    if (
      typeof window !== "object" ||
      window === null ||
      Array.isArray(window) ||
      Object.keys(window).some((key) => !["weekday", "startMinute", "endMinute"].includes(key))
    ) {
      throw new Error("Common-gap response is malformed.");
    }
    const candidate = window as Record<string, unknown>;
    const weekday = candidate["weekday"];
    const startMinute = candidate["startMinute"];
    const endMinute = candidate["endMinute"];
    if (
      !WEEKDAYS.includes(weekday as Weekday) ||
      !Number.isInteger(startMinute) ||
      !Number.isInteger(endMinute) ||
      (startMinute as number) < 9 * 60 ||
      (endMinute as number) > 18 * 60 ||
      (startMinute as number) % 30 !== 0 ||
      (endMinute as number) % 30 !== 0 ||
      (endMinute as number) - (startMinute as number) < 60
    ) {
      throw new Error("Common-gap response is malformed.");
    }
    return {
      weekday: weekday as Weekday,
      startMinute: startMinute as number,
      endMinute: endMinute as number,
    };
  });
}

async function loadEncryptedFriendGaps(
  connection: FriendConnection,
  term: Term,
  accessToken: string,
): Promise<FriendGapOverlap[]> {
  const response = await fetch("/api/common-gap", {
    method: "POST",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ friendshipId: connection.id, term }),
  });
  if (response.status === 429) throw new FriendOverlapRateLimitError();
  if (!response.ok) throw new Error("Common-gap lookup failed.");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 8 * 1024) {
    throw new Error("Common-gap response is too large.");
  }
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Common-gap response is malformed.");
  }
  return parseCommonGapResponse(body).map((window) => ({
    friendshipId: connection.id,
    friendDisplayName: connection.displayName,
    term,
    ...window,
  }));
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

export async function loadFriendConnections(): Promise<FriendConnection[]> {
  const supabase = requireSupabaseClient();
  const { data: relationships, error } = await supabase.rpc("list_friend_connections");
  if (error) throw error;

  return (relationships ?? []).flatMap((relationship) => {
    if (
      (relationship.status !== "pending" && relationship.status !== "accepted") ||
      (relationship.direction !== "incoming" &&
        relationship.direction !== "outgoing" &&
        relationship.direction !== "mutual")
    ) {
      return [];
    }
    return [
      {
        id: relationship.friendship_id,
        displayName: relationship.friend_display_name,
        status: relationship.status,
        direction: relationship.direction,
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
  if (isEncryptedPrivateCloudAuthoritative) {
    const supabase = requireSupabaseClient();
    const [{ data, error }, allConnections] = await Promise.all([
      supabase.auth.getSession(),
      loadFriendConnections(),
    ]);
    if (error || !data.session) throw new Error("Sign in before checking common gaps.");
    const connections = allConnections.filter(
      (connection) => connection.status === "accepted" && connection.direction === "mutual",
    );
    return (
      await Promise.all(
        connections
          .slice(0, 10)
          .map((connection) =>
            loadEncryptedFriendGaps(connection, term, data.session.access_token),
          ),
      )
    ).flat();
  }
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

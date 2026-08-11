import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { User } from "@supabase/supabase-js";
import {
  defaultFriendDisplayName,
  sanitizeFriendDisplayName,
} from "@/features/friends/friend-service";
import { findGaps } from "@/lib/gaps";
import type { Gap } from "@/lib/timetable-types";
import { meeting } from "./fixtures";

function overlap(left: Gap, right: Gap) {
  if (left.weekday !== right.weekday || left.term !== right.term) return null;
  const startMinute = Math.max(left.startTime, right.startTime);
  const endMinute = Math.min(left.endTime, right.endTime);
  return endMinute > startMinute ? { startMinute, endMinute } : null;
}

describe("friend overlap privacy contract", () => {
  test("keeps same-course LEC and TUT records as separate busy events", () => {
    const first = findGaps(
      [
        meeting({ id: "a-lec", activityType: "LEC", startTime: 600, endTime: 660 }),
        meeting({ id: "a-next", courseCode: "MAT102H5", startTime: 780, endTime: 840 }),
      ],
      "Fall",
    )[0]!;
    const second = findGaps(
      [
        meeting({ id: "b-tut", activityType: "TUT", startTime: 600, endTime: 720 }),
        meeting({ id: "b-next", courseCode: "MAT102H5", startTime: 780, endTime: 840 }),
      ],
      "Fall",
    )[0]!;

    expect(first.startTime).toBe(660);
    expect(second.startTime).toBe(720);
    expect(overlap(first, second)).toEqual({ startMinute: 720, endMinute: 780 });
  });

  test("never derives a social name from the Auth email", () => {
    const emailOnlyUser = {
      id: "user-1",
      email: "private@example.test",
      user_metadata: {},
    } as User;
    expect(defaultFriendDisplayName(emailOnlyUser)).toBe("Gapwise friend");
    expect(
      defaultFriendDisplayName({
        ...emailOnlyUser,
        user_metadata: { user_name: "campus_friend" },
      }),
    ).toBe("campus_friend");
  });

  test("normalizes user-controlled display labels", () => {
    expect(sanitizeFriendDisplayName("  Alex\u0000\n ")).toBe("Alex");
    expect(sanitizeFriendDisplayName("Al\u0085ex")).toBe("Alex");
    expect(sanitizeFriendDisplayName("   ")).toBe("Gapwise friend");
    expect(sanitizeFriendDisplayName("x".repeat(100))).toHaveLength(80);
    expect([...sanitizeFriendDisplayName("🙂".repeat(100))]).toHaveLength(80);
  });

  test("migration preserves owner-only schedules and exposes a fixed derived payload", async () => {
    const sql = await readFile(
      "supabase/migrations/20260811002848_friend_timetable_overlap.sql",
      "utf8",
    );
    const overlapFunction = sql.slice(
      sql.indexOf("create or replace function public.get_friend_gap_overlaps"),
    );
    const returnContract = overlapFunction.slice(0, overlapFunction.indexOf("language plpgsql"));

    expect(sql).not.toMatch(/create policy[\s\S]{0,200}on public\.user_schedules/i);
    expect(sql).toContain("friendship.status = 'accepted'");
    expect(sql).toContain("friendship.recipient_accepted_at is not null");
    expect(sql).toContain("friendship.revoked_at is null");
    expect(returnContract).not.toMatch(
      /course_code|activity_type|section_code|building_code|room|meetings/i,
    );
    expect(overlapFunction).toContain("ranked.privacy_rank <= 3");
    expect(overlapFunction).toContain("interval '1 hour'");
    expect(overlapFunction).toContain("requests_in_window > 30");
    expect(overlapFunction).toContain("* 30 as start_minute");
    expect(overlapFunction).toContain("* 30 as end_minute");
  });

  test("RLS test suite exercises bypass, consent, revocation, mismatch, and deletion", async () => {
    const sql = await readFile("supabase/tests/database/friend_overlap_rls.test.sql", "utf8");
    for (const proof of [
      "crafted direct query cannot read an accepted friend schedule",
      "pending friend receives no overlap result",
      "same-course LEC/TUT mismatch",
      "revocation immediately removes all overlap visibility",
      "account deletion removes every pending, accepted, and revoked relationship",
      "former friends see no relationship trace after account deletion",
    ]) {
      expect(sql).toContain(proof);
    }
  });

  test("scopes cached overlap UI state to the current authenticated account", async () => {
    const gapPlan = await readFile("src/components/GapPlan.tsx", "utf8");
    expect(gapPlan).toContain("friendOverlapState.userId === userId");
    expect(gapPlan).toContain('key={userId ?? "guest"}');
  });

  test("friend lookup uses unguessable codes without an account or email directory", async () => {
    const migration = await readFile(
      "supabase/migrations/20260811002848_friend_timetable_overlap.sql",
      "utf8",
    );
    const service = await readFile("src/features/friends/friend-service.ts", "utf8");
    expect(migration).toContain("extensions.gen_random_bytes(24)");
    expect(migration).toContain("normalized_code !~ '^[0-9a-f]{48}$'");
    expect(service).not.toMatch(/auth\.users|\.email\b|signInWithOtp/i);
  });

  test("rollback removes only friend-overlap objects", async () => {
    const rollback = await readFile(
      "supabase/rollbacks/20260811002848_friend_timetable_overlap.sql",
      "utf8",
    );
    expect(rollback).toContain("drop table if exists public.friendships");
    expect(rollback).toContain("drop function if exists public.get_friend_gap_overlaps(text)");
    expect(rollback).not.toMatch(/drop table if exists public\.user_schedules/i);
  });
});

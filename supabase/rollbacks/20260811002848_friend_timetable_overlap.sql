-- Roll back only the friend-overlap objects introduced by the matching forward
-- migration. The pre-existing owner-only schedule and preference tables remain.

drop function if exists public.get_friend_gap_overlaps(text);
drop function if exists private.schedule_gap_windows(uuid, text);
drop function if exists private.is_valid_schedule_meeting(jsonb, text);
drop function if exists public.revoke_friendship(uuid);
drop function if exists public.respond_to_friend_request(uuid, boolean);
drop function if exists public.claim_friend_invite(text);
drop function if exists public.disable_friend_invite();
drop function if exists public.create_friend_invite();
drop function if exists public.list_friend_connections();

drop table if exists private.friend_overlap_rate_limits;
drop table if exists public.friendships;
drop table if exists public.friend_invites;
drop table if exists public.friend_profiles;
drop function if exists private.is_safe_friend_display_name(text);

-- The private schema may be shared by future migrations, so it is intentionally
-- retained. Drop it manually only after confirming it contains no other objects.

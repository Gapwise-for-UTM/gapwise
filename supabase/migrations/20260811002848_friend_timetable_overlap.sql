-- Friend connections expose only minimal relationship metadata. Full normalized
-- schedules remain owner-only under the existing user_schedules RLS policies.
-- The sole cross-user schedule read happens inside get_friend_gap_overlaps(),
-- which verifies mutual acceptance and returns only bounded, quantized
-- intersections. No meeting, course, activity, room, or non-overlap row is
-- returned by that function.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

create table public.friend_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_profiles_display_name
    check (
      display_name = btrim(display_name)
      and char_length(display_name) between 1 and 80
      and display_name !~ '[[:cntrl:]]'
      and translate(
        display_name,
        chr(173) || chr(1564) || chr(6158) ||
        chr(8203) || chr(8204) || chr(8205) || chr(8206) || chr(8207) ||
        chr(8234) || chr(8235) || chr(8236) || chr(8237) || chr(8238) ||
        chr(8288) || chr(8289) || chr(8290) || chr(8291) || chr(8292) ||
        chr(8294) || chr(8295) || chr(8296) || chr(8297) || chr(8298) ||
        chr(8299) || chr(8300) || chr(8301) || chr(8302) || chr(8303) ||
        chr(65279),
        ''
      ) = display_name
    )
);

create table public.friend_invites (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint friend_invites_future_expiry check (expires_at > created_at)
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  requester_accepted_at timestamptz not null default now(),
  recipient_accepted_at timestamptz null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_canonical_pair check (user_a_id < user_b_id),
  constraint friendships_unique_pair unique (user_a_id, user_b_id),
  constraint friendships_requested_by_participant
    check (requested_by in (user_a_id, user_b_id)),
  constraint friendships_revoked_by_participant
    check (revoked_by is null or revoked_by in (user_a_id, user_b_id)),
  constraint friendships_status check (status in ('pending', 'accepted', 'revoked')),
  constraint friendships_acceptance_pair
    check ((recipient_accepted_at is null) = (accepted_at is null)),
  constraint friendships_state_consistency
    check (
      (
        status = 'pending'
        and recipient_accepted_at is null
        and accepted_at is null
        and revoked_at is null
        and revoked_by is null
      )
      or
      (
        status = 'accepted'
        and recipient_accepted_at is not null
        and accepted_at is not null
        and revoked_at is null
        and revoked_by is null
      )
      or
      (
        status = 'revoked'
        and revoked_at is not null
        and revoked_by is not null
      )
    )
);

create index friendships_user_a_status_idx
  on public.friendships (user_a_id, status)
  where revoked_at is null;
create index friendships_user_b_status_idx
  on public.friendships (user_b_id, status)
  where revoked_at is null;
create index friendships_requested_by_status_idx
  on public.friendships (requested_by, status)
  where status = 'pending' and revoked_at is null;

-- This table is in an unexposed schema and stores only an aggregate request
-- count. It contains no friend identifier, schedule data, or overlap history.
create table private.friend_overlap_rate_limits (
  caller_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  constraint friend_overlap_rate_limits_request_count check (request_count > 0)
);

alter table public.friend_profiles enable row level security;
alter table public.friend_profiles force row level security;
alter table public.friend_invites enable row level security;
alter table public.friend_invites force row level security;
alter table public.friendships enable row level security;
alter table public.friendships force row level security;
alter table private.friend_overlap_rate_limits enable row level security;
alter table private.friend_overlap_rate_limits force row level security;

create policy "friendships_select_current_participants"
  on public.friendships
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) in (user_a_id, user_b_id)
    and status in ('pending', 'accepted')
    and revoked_at is null
  );

create policy "friend_profiles_select_own"
  on public.friend_profiles
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

create policy "friend_profiles_insert_own"
  on public.friend_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "friend_profiles_update_own"
  on public.friend_profiles
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.friend_profiles from public, anon, authenticated;
revoke all on table public.friend_invites from public, anon, authenticated;
revoke all on table public.friendships from public, anon, authenticated;
revoke all on table private.friend_overlap_rate_limits from public, anon, authenticated;

grant select, insert, update on table public.friend_profiles to authenticated;

-- Relationship rows contain participant Auth UUIDs and are never granted to
-- browser roles. This projection is the only friend-list read surface.
create or replace function public.list_friend_connections()
returns table (
  friendship_id uuid,
  status text,
  direction text,
  friend_display_name text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    friendship.id,
    friendship.status,
    case
      when friendship.status = 'accepted' then 'mutual'
      when friendship.requested_by = (select auth.uid()) then 'outgoing'
      else 'incoming'
    end,
    coalesce(profile.display_name, 'Gapwise friend'),
    friendship.updated_at
  from public.friendships as friendship
  left join public.friend_profiles as profile
    on profile.user_id = case
      when friendship.user_a_id = (select auth.uid()) then friendship.user_b_id
      else friendship.user_a_id
    end
  where (select auth.uid()) is not null
    and (select auth.uid()) in (friendship.user_a_id, friendship.user_b_id)
    and friendship.status in ('pending', 'accepted')
    and friendship.revoked_at is null
  order by friendship.updated_at desc
$$;

-- Invitations use 192-bit single-use secrets. Only the hash is stored, and the
-- invite table has no browser-readable policy or grant.
create or replace function public.create_friend_invite()
returns table (invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  token text;
  expiry timestamptz := now() + interval '24 hours';
begin
  if caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.friend_invites as invite (owner_id, token_hash, expires_at)
  values (caller, extensions.digest(token, 'sha256'), expiry)
  on conflict (owner_id) do update
    set token_hash = excluded.token_hash,
        expires_at = excluded.expires_at,
        created_at = now();

  return query select token, expiry;
end;
$$;

create or replace function public.disable_friend_invite()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  delete from public.friend_invites where owner_id = caller;
  return true;
end;
$$;

-- Every syntactically valid or invalid invite submission returns the same
-- result. The secret is unguessable, and neither an email nor an account lookup
-- is exposed. A successful claim sends a pending request; the invite owner must
-- separately accept it before any overlap can be computed.
create or replace function public.claim_friend_invite(p_invite_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  normalized_code text := lower(btrim(coalesce(p_invite_code, '')));
  invite_owner uuid;
  pair_a uuid;
  pair_b uuid;
begin
  if caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if normalized_code !~ '^[0-9a-f]{48}$' then
    perform extensions.digest(left(normalized_code, 128), 'sha256');
    return true;
  end if;

  select invite.owner_id
    into invite_owner
  from public.friend_invites as invite
  where invite.token_hash = extensions.digest(normalized_code, 'sha256')
    and invite.expires_at > now()
  for update;

  if invite_owner is null or invite_owner = caller then
    return true;
  end if;

  delete from public.friend_invites where owner_id = invite_owner;

  pair_a := least(caller, invite_owner);
  pair_b := greatest(caller, invite_owner);

  -- A fresh request never resurrects a revoked row. Deleting the hidden row
  -- first prevents a later reconnection from revealing an old relationship ID
  -- or creation timestamp to either participant.
  delete from public.friendships
  where user_a_id = pair_a
    and user_b_id = pair_b
    and status = 'revoked';

  insert into public.friendships (
    user_a_id,
    user_b_id,
    requested_by,
    status,
    requester_accepted_at,
    recipient_accepted_at,
    accepted_at,
    revoked_at,
    revoked_by,
    updated_at
  )
  values (pair_a, pair_b, caller, 'pending', now(), null, null, null, null, now())
  on conflict (user_a_id, user_b_id) do nothing;

  return true;
end;
$$;

create or replace function public.respond_to_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  relationship public.friendships%rowtype;
begin
  if caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select friendship.*
    into relationship
  from public.friendships as friendship
  where friendship.id = p_friendship_id
    and caller in (friendship.user_a_id, friendship.user_b_id)
  for update;

  if not found
    or relationship.status <> 'pending'
    or relationship.revoked_at is not null
    or relationship.requested_by = caller
  then
    return true;
  end if;

  if coalesce(p_accept, false) then
    update public.friendships
    set status = 'accepted',
        recipient_accepted_at = now(),
        accepted_at = now(),
        updated_at = now()
    where id = relationship.id;
  else
    update public.friendships
    set status = 'revoked',
        revoked_at = now(),
        revoked_by = caller,
        updated_at = now()
    where id = relationship.id;
  end if;

  return true;
end;
$$;

create or replace function public.revoke_friendship(p_friendship_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.friendships
  set status = 'revoked',
      revoked_at = now(),
      revoked_by = caller,
      updated_at = now()
  where id = p_friendship_id
    and caller in (user_a_id, user_b_id)
    and status in ('pending', 'accepted')
    and revoked_at is null;

  return true;
end;
$$;

-- Every normalized meeting remains a distinct busy component keyed by both
-- course code and activity type. In particular, CSC108 LEC and CSC108 TUT/PRA
-- records are never collapsed into one course-only component. The function then
-- merges busy intervals and yields only gaps between them.
create or replace function private.is_valid_schedule_meeting(
  p_meeting jsonb,
  p_term text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    jsonb_typeof(p_meeting) = 'object'
    and p_meeting ->> 'term' = p_term
    and p_meeting ->> 'weekday' in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
    and p_meeting ->> 'activityType' in ('LEC', 'TUT', 'PRA', 'OTHER')
    and btrim(coalesce(p_meeting ->> 'courseCode', '')) <> ''
    and case
      when p_meeting ->> 'startTime' ~ '^\d{1,4}$'
        and p_meeting ->> 'endTime' ~ '^\d{1,4}$'
      then (p_meeting ->> 'startTime')::integer between 0 and 1439
        and (p_meeting ->> 'endTime')::integer between 1 and 1440
        and (p_meeting ->> 'endTime')::integer > (p_meeting ->> 'startTime')::integer
      else false
    end
$$;

create or replace function private.schedule_gap_windows(p_user_id uuid, p_term text)
returns table (weekday text, start_minute integer, end_minute integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  has_term_records boolean;
  has_valid_records boolean;
begin
  select
    bool_or(entry.meeting ->> 'term' = p_term),
    bool_or(private.is_valid_schedule_meeting(entry.meeting, p_term))
  into has_term_records, has_valid_records
  from public.user_schedules as schedule
  cross join lateral jsonb_array_elements(schedule.meetings) as entry(meeting)
  where schedule.user_id = p_user_id;

  if coalesce(has_term_records, false) and not coalesce(has_valid_records, false) then
    raise exception 'Persisted schedule data is invalid.' using errcode = 'P0002';
  end if;

  return query
  with raw_meetings as (
    select entry.meeting
    from public.user_schedules as schedule
    cross join lateral jsonb_array_elements(schedule.meetings) as entry(meeting)
    where schedule.user_id = p_user_id
      and private.is_valid_schedule_meeting(entry.meeting, p_term)
  ),
  parsed_components as (
    select
      meeting ->> 'weekday' as weekday,
      case
        when meeting ->> 'startTime' ~ '^\d{1,4}$'
          then (meeting ->> 'startTime')::integer
        else null
      end as start_minute,
      case
        when meeting ->> 'endTime' ~ '^\d{1,4}$'
          then (meeting ->> 'endTime')::integer
        else null
      end as end_minute,
      upper(btrim(meeting ->> 'courseCode')) as course_code,
      meeting ->> 'activityType' as activity_type
    from raw_meetings
  ),
  distinct_components as (
    select distinct
      component.weekday,
      component.start_minute,
      component.end_minute,
      component.course_code,
      component.activity_type
    from parsed_components as component
    where component.start_minute between 0 and 1439
      and component.end_minute between 1 and 1440
      and component.end_minute > component.start_minute
  ),
  running_busy_intervals as (
    select
      component.weekday,
      component.start_minute,
      max(component.end_minute) over (
        partition by component.weekday
        order by
          component.start_minute,
          component.end_minute,
          component.course_code,
          component.activity_type
        rows between unbounded preceding and current row
      ) as running_end
    from distinct_components as component
  ),
  boundaries as (
    select
      busy_interval.weekday,
      busy_interval.start_minute,
      lag(busy_interval.running_end) over (
        partition by busy_interval.weekday
        order by busy_interval.start_minute, busy_interval.running_end
      ) as previous_end
    from running_busy_intervals as busy_interval
  )
  select boundary.weekday, boundary.previous_end, boundary.start_minute
  from boundaries as boundary
  where boundary.previous_end is not null
    and boundary.start_minute > boundary.previous_end;
end;
$$;

create or replace function public.get_friend_gap_overlaps(p_term text)
returns table (
  friendship_id uuid,
  friend_display_name text,
  weekday text,
  start_minute integer,
  end_minute integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  requests_in_window integer;
begin
  if caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_term not in ('Fall', 'Winter', 'Summer') then
    raise exception 'Unsupported term.' using errcode = '22023';
  end if;

  -- Locks synchronize this read with revoke/decline updates. Once a revocation
  -- commits, a later overlap call cannot observe the former relationship.
  perform 1
  from public.friendships as friendship
  where caller in (friendship.user_a_id, friendship.user_b_id)
    and friendship.status = 'accepted'
    and friendship.requester_accepted_at is not null
    and friendship.recipient_accepted_at is not null
    and friendship.accepted_at is not null
    and friendship.revoked_at is null
  for share;

  insert into private.friend_overlap_rate_limits as rate_limit (
    caller_id,
    window_started_at,
    request_count
  )
  values (caller, now(), 1)
  on conflict (caller_id) do update
    set window_started_at = case
          when rate_limit.window_started_at <= now() - interval '1 hour' then now()
          else rate_limit.window_started_at
        end,
        request_count = case
          when rate_limit.window_started_at <= now() - interval '1 hour' then 1
          else rate_limit.request_count + 1
        end
  returning request_count into requests_in_window;

  if requests_in_window > 30 then
    raise exception 'Overlap lookup temporarily unavailable.' using errcode = 'P0001';
  end if;

  return query
  with active_friends as (
    select
      friendship.id as friendship_id,
      case
        when friendship.user_a_id = caller then friendship.user_b_id
        else friendship.user_a_id
      end as friend_user_id
    from public.friendships as friendship
    where caller in (friendship.user_a_id, friendship.user_b_id)
      and friendship.status = 'accepted'
      and friendship.requester_accepted_at is not null
      and friendship.recipient_accepted_at is not null
      and friendship.accepted_at is not null
      and friendship.revoked_at is null
  ),
  own_gaps as materialized (
    select own_gap.weekday, own_gap.start_minute, own_gap.end_minute
    from private.schedule_gap_windows(caller, p_term) as own_gap
  ),
  raw_overlaps as (
    select
      active_friend.friendship_id,
      coalesce(profile.display_name, 'Gapwise friend') as friend_display_name,
      own_gap.weekday,
      greatest(own_gap.start_minute, friend_gap.start_minute) as raw_start,
      least(own_gap.end_minute, friend_gap.end_minute) as raw_end
    from active_friends as active_friend
    cross join own_gaps as own_gap
    join lateral private.schedule_gap_windows(active_friend.friend_user_id, p_term) as friend_gap
      on friend_gap.weekday = own_gap.weekday
      and greatest(own_gap.start_minute, friend_gap.start_minute)
        < least(own_gap.end_minute, friend_gap.end_minute)
    left join public.friend_profiles as profile
      on profile.user_id = active_friend.friend_user_id
  ),
  quantized_overlaps as (
    select distinct
      raw_overlap.friendship_id,
      raw_overlap.friend_display_name,
      raw_overlap.weekday,
      ((raw_overlap.raw_start + 29) / 30) * 30 as start_minute,
      (raw_overlap.raw_end / 30) * 30 as end_minute
    from raw_overlaps as raw_overlap
  ),
  ranked_overlaps as (
    select
      quantized_overlap.*,
      row_number() over (
        partition by quantized_overlap.friendship_id
        order by
          array_position(
            array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[],
            quantized_overlap.weekday
          ),
          quantized_overlap.start_minute,
          quantized_overlap.end_minute
      ) as privacy_rank
    from quantized_overlaps as quantized_overlap
    where quantized_overlap.end_minute - quantized_overlap.start_minute >= 30
  )
  select
    ranked.friendship_id,
    ranked.friend_display_name,
    ranked.weekday,
    ranked.start_minute,
    ranked.end_minute
  from ranked_overlaps as ranked
  where ranked.privacy_rank <= 3
  order by ranked.friend_display_name, ranked.privacy_rank;
end;
$$;

revoke all on function public.create_friend_invite() from public, anon, authenticated;
revoke all on function public.list_friend_connections() from public, anon, authenticated;
revoke all on function public.disable_friend_invite() from public, anon, authenticated;
revoke all on function public.claim_friend_invite(text) from public, anon, authenticated;
revoke all on function public.respond_to_friend_request(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.revoke_friendship(uuid) from public, anon, authenticated;
revoke all on function public.get_friend_gap_overlaps(text) from public, anon, authenticated;
revoke all on function private.is_valid_schedule_meeting(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.schedule_gap_windows(uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_friend_invite() to authenticated;
grant execute on function public.list_friend_connections() to authenticated;
grant execute on function public.disable_friend_invite() to authenticated;
grant execute on function public.claim_friend_invite(text) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.revoke_friendship(uuid) to authenticated;
grant execute on function public.get_friend_gap_overlaps(text) to authenticated;

comment on table public.friend_profiles is
  'Minimal user-chosen names; direct table reads are owner-only.';
comment on table public.friend_invites is
  'Unexposed hashes of 192-bit, expiring, single-use private friend codes.';
comment on table public.friendships is
  'Unexposed canonical two-party requests; overlap requires both acceptance timestamps and no revocation.';
comment on function public.list_friend_connections() is
  'Returns only opaque relationship state, direction, display label, and update time; never Auth UUIDs.';
comment on function public.get_friend_gap_overlaps(text) is
  'Returns at most three 30-minute-quantized mutual free windows per active friend and no schedule details.';

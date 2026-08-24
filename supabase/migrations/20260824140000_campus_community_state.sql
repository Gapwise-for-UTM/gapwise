-- Privacy-preserving campus community state.
--
-- Crowd reports are deliberately short lived and replace (rather than append
-- to) a reporter's previous observation. Reporter identifiers never leave the
-- private schema. Publisher authority is assigned only by a database operator;
-- authenticated clients cannot grant scopes or mark themselves official.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.campus_crowd_level as enum (
  'quiet', 'seats_available', 'busy', 'full'
);

create table private.campus_crowd_reports (
  place_id text not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  level public.campus_crowd_level not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  primary key (place_id, reporter_id),
  constraint campus_crowd_reports_place_id check (
    place_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(place_id) <= 100
  ),
  constraint campus_crowd_reports_lifetime check (
    expires_at > observed_at and expires_at <= observed_at + interval '2 hours'
  )
);

create index campus_crowd_reports_active_place_idx
  on private.campus_crowd_reports (place_id, expires_at, observed_at desc);

-- Per-account buckets prevent report spam without collecting an IP address or
-- location. Old buckets are operational data and may be periodically deleted.
create table private.campus_crowd_rate_limits (
  reporter_id uuid not null references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count smallint not null,
  primary key (reporter_id, window_started_at),
  constraint campus_crowd_rate_count check (request_count between 1 and 12)
);

create index campus_crowd_rate_limits_expiry_idx
  on private.campus_crowd_rate_limits (window_started_at);

-- Publisher rows and scopes have no browser grants. Verification is an
-- operator-controlled statement about the publisher identity, not a claim in
-- publisher-supplied content.
create table private.campus_publishers (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  verified_by_gapwise boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint campus_publishers_display_name check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 120
    and display_name !~ '[[:cntrl:]]'
  )
);

create table private.campus_publisher_scopes (
  id bigint generated always as identity primary key,
  publisher_id uuid not null references private.campus_publishers(id) on delete cascade,
  entity_kind text not null,
  entity_id text null,
  constraint campus_publisher_scopes_kind check (
    entity_kind in ('place', 'event', 'facility', 'campus_status', 'transit')
  ),
  constraint campus_publisher_scopes_entity check (
    entity_id is null or
    (entity_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(entity_id) <= 100)
  )
);

create unique index campus_publisher_scopes_authority_idx
  on private.campus_publisher_scopes (publisher_id, entity_kind, entity_id) nulls not distinct;

-- One current publisher assertion per entity. Consumers still apply freshness
-- and provenance rules; absence or expiry is never interpreted as a negative.
create table public.campus_publisher_state (
  id uuid primary key default extensions.gen_random_uuid(),
  publisher_id uuid not null references private.campus_publishers(id) on delete restrict,
  entity_kind text not null,
  entity_id text not null,
  state jsonb not null,
  valid_until timestamptz not null,
  published_at timestamptz not null default now(),
  superseded_at timestamptz null,
  constraint campus_publisher_state_kind check (
    entity_kind in ('place', 'event', 'facility', 'campus_status', 'transit')
  ),
  constraint campus_publisher_state_entity check (
    entity_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(entity_id) <= 100
  ),
  constraint campus_publisher_state_payload check (
    jsonb_typeof(state) = 'object'
    and octet_length(state::text) <= 16384
    and state::text !~ '"(official|verified|verifiedOfficial|publisher_id|publisherId)"[[:space:]]*:'
  ),
  constraint campus_publisher_state_expiry check (
    valid_until > published_at and valid_until <= published_at + interval '31 days'
  )
);

create unique index campus_publisher_state_current_idx
  on public.campus_publisher_state (publisher_id, entity_kind, entity_id)
  where superseded_at is null;
create index campus_publisher_state_public_lookup_idx
  on public.campus_publisher_state (entity_kind, entity_id, valid_until desc)
  where superseded_at is null;

create table private.campus_publisher_audit (
  id bigint generated always as identity primary key,
  publisher_id uuid not null references private.campus_publishers(id) on delete restrict,
  state_id uuid not null references public.campus_publisher_state(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action = 'publish'),
  entity_kind text not null,
  entity_id text not null,
  payload_sha256 text not null,
  created_at timestamptz not null default now()
);

create index campus_publisher_audit_publisher_created_idx
  on private.campus_publisher_audit (publisher_id, created_at desc);

alter table private.campus_crowd_reports enable row level security;
alter table private.campus_crowd_reports force row level security;
alter table private.campus_crowd_rate_limits enable row level security;
alter table private.campus_crowd_rate_limits force row level security;
alter table private.campus_publishers enable row level security;
alter table private.campus_publishers force row level security;
alter table private.campus_publisher_scopes enable row level security;
alter table private.campus_publisher_scopes force row level security;
alter table private.campus_publisher_audit enable row level security;
alter table private.campus_publisher_audit force row level security;
alter table public.campus_publisher_state enable row level security;
alter table public.campus_publisher_state force row level security;

revoke all on table private.campus_crowd_reports from public, anon, authenticated;
revoke all on table private.campus_crowd_rate_limits from public, anon, authenticated;
revoke all on table private.campus_publishers from public, anon, authenticated;
revoke all on table private.campus_publisher_scopes from public, anon, authenticated;
revoke all on table private.campus_publisher_audit from public, anon, authenticated;
revoke all on table public.campus_publisher_state from public, anon, authenticated;

-- Public output deliberately contains no reporter IDs or exact per-report
-- timestamps. Fewer than two active reports is returned as unknown to avoid
-- presenting one person's observation as consensus.
create or replace function public.get_campus_crowd_state(p_place_id text)
returns table (
  place_id text,
  level public.campus_crowd_level,
  confidence text,
  sample_size integer,
  freshest_bucket timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with active as (
    select report.level, report.observed_at
    from private.campus_crowd_reports report
    where report.place_id = p_place_id
      and report.expires_at > statement_timestamp()
  ), summary as (
    select
      count(*)::integer as samples,
      max(observed_at) as freshest,
      round(avg(case level
        when 'quiet' then 0 when 'seats_available' then 1
        when 'busy' then 2 when 'full' then 3 end))::integer as score
    from active
  )
  select p_place_id,
    case when samples < 2 then null else
      (array['quiet', 'seats_available', 'busy', 'full']::public.campus_crowd_level[])[score + 1]
    end,
    case when samples < 2 then 'unknown' when samples < 4 then 'low' else 'moderate' end,
    samples,
    case when freshest is null then null
      else date_trunc('minute', freshest) -
        make_interval(mins => extract(minute from freshest)::integer % 15)
    end
  from summary
$$;

create or replace function public.submit_campus_crowd_report(
  p_place_id text,
  p_level public.campus_crowd_level
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  bucket timestamptz := date_bin(interval '10 minutes', statement_timestamp(), timestamptz '2000-01-01');
  used smallint;
begin
  if caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_place_id is null or p_place_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_place_id) > 100 then
    raise exception 'Invalid place identifier.' using errcode = '22023';
  end if;

  insert into private.campus_crowd_rate_limits (reporter_id, window_started_at, request_count)
  values (caller, bucket, 1)
  on conflict (reporter_id, window_started_at) do update
    set request_count = private.campus_crowd_rate_limits.request_count + 1
    where private.campus_crowd_rate_limits.request_count < 6
  returning request_count into used;
  if used is null then
    raise exception 'Crowd report rate limit exceeded.' using errcode = 'P0001';
  end if;

  insert into private.campus_crowd_reports (place_id, reporter_id, level, observed_at, expires_at)
  values (p_place_id, caller, p_level, statement_timestamp(), statement_timestamp() + interval '2 hours')
  on conflict (place_id, reporter_id) do update
    set level = excluded.level, observed_at = excluded.observed_at, expires_at = excluded.expires_at;
end;
$$;

create or replace function public.publish_campus_state(
  p_entity_kind text,
  p_entity_id text,
  p_state jsonb,
  p_valid_until timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  publisher uuid;
  inserted_id uuid;
begin
  select p.id into publisher
  from private.campus_publishers p
  where p.user_id = caller and p.enabled;
  if publisher is null then
    raise exception 'Publisher authorization required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from private.campus_publisher_scopes scope
    where scope.publisher_id = publisher
      and scope.entity_kind = p_entity_kind
      and (scope.entity_id is null or scope.entity_id = p_entity_id)
  ) then
    raise exception 'Publisher scope does not allow this entity.' using errcode = '42501';
  end if;

  -- Constraints validate identifiers, payload size/reserved claims and expiry.
  update public.campus_publisher_state
    set superseded_at = statement_timestamp()
    where publisher_id = publisher and entity_kind = p_entity_kind
      and entity_id = p_entity_id and superseded_at is null;
  insert into public.campus_publisher_state
    (publisher_id, entity_kind, entity_id, state, valid_until)
  values (publisher, p_entity_kind, p_entity_id, p_state, p_valid_until)
  returning id into inserted_id;
  insert into private.campus_publisher_audit
    (publisher_id, state_id, actor_user_id, action, entity_kind, entity_id, payload_sha256)
  values (publisher, inserted_id, caller, 'publish', p_entity_kind, p_entity_id,
    encode(extensions.digest(p_state::text, 'sha256'), 'hex'));
  return inserted_id;
end;
$$;

-- This bounded projection exposes attribution and freshness but no publisher
-- account identity or audit/moderation metadata.
create or replace function public.get_published_campus_state(
  p_entity_kind text,
  p_entity_id text
)
returns table (
  state jsonb,
  publisher_name text,
  gapwise_verified_publisher boolean,
  published_at timestamptz,
  valid_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.state, p.display_name, p.verified_by_gapwise, s.published_at, s.valid_until
  from public.campus_publisher_state s
  join private.campus_publishers p on p.id = s.publisher_id
  where s.entity_kind = p_entity_kind and s.entity_id = p_entity_id
    and s.superseded_at is null and s.valid_until > statement_timestamp()
    and p.enabled
  order by s.published_at desc
  limit 20
$$;

revoke all on function public.get_campus_crowd_state(text) from public, anon, authenticated;
revoke all on function public.submit_campus_crowd_report(text, public.campus_crowd_level) from public, anon, authenticated;
revoke all on function public.publish_campus_state(text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.get_published_campus_state(text, text) from public, anon, authenticated;
grant execute on function public.get_campus_crowd_state(text) to anon, authenticated;
grant execute on function public.submit_campus_crowd_report(text, public.campus_crowd_level) to authenticated;
grant execute on function public.publish_campus_state(text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.get_published_campus_state(text, text) to anon, authenticated;

comment on function public.submit_campus_crowd_report(text, public.campus_crowd_level) is
  'Stores one coarse two-hour observation per authenticated reporter/place; never stores location history.';

-- Operational maturity foundations. This migration is additive and deliberately
-- keeps privileged operational data outside the exposed Data API schema.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.operator_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 3 and 120),
  resource_type text not null check (length(resource_type) between 2 and 80),
  resource_id text check (resource_id is null or length(resource_id) <= 255),
  request_id text check (request_id is null or length(request_id) between 8 and 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists operator_audit_log_created_at_idx
  on private.operator_audit_log (created_at desc);
create index if not exists operator_audit_log_actor_created_at_idx
  on private.operator_audit_log (actor_user_id, created_at desc);

comment on table private.operator_audit_log is
  'Minimal append-only audit metadata for privileged operator actions. Message bodies, timetable data, credentials, and raw tokens must never be stored here.';

create table if not exists private.system_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (length(event_type) between 3 and 120),
  service text not null check (length(service) between 2 and 80),
  severity text not null default 'info' check (severity in ('info', 'warning', 'error')),
  request_id text check (request_id is null or length(request_id) between 8 and 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists system_events_type_created_at_idx
  on private.system_events (event_type, created_at desc);
create index if not exists system_events_service_created_at_idx
  on private.system_events (service, created_at desc);

comment on table private.system_events is
  'Sanitized operational event metadata. Must not contain personal timetable content, precise location, email bodies, secrets, or OAuth tokens.';

create table if not exists public.user_email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  product_updates boolean not null default false,
  security_notices boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_email_preferences enable row level security;
alter table public.user_email_preferences force row level security;

revoke all on table public.user_email_preferences from anon, authenticated;
grant select, insert, update on table public.user_email_preferences to authenticated;

drop policy if exists "users read own email preferences" on public.user_email_preferences;
create policy "users read own email preferences"
  on public.user_email_preferences
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "users create own email preferences" on public.user_email_preferences;
create policy "users create own email preferences"
  on public.user_email_preferences
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "users update own email preferences" on public.user_email_preferences;
create policy "users update own email preferences"
  on public.user_email_preferences
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

comment on table public.user_email_preferences is
  'User-controlled communications preferences. Product updates are explicit opt-in; security notices remain transactional and cannot be treated as marketing consent.';

create table if not exists public.ai_access_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null check (length(client_name) between 1 and 240),
  event_type text not null check (event_type in ('authorized', 'revoked', 'context_read', 'action_queued', 'action_applied', 'action_rejected')),
  capability text check (capability is null or length(capability) <= 120),
  created_at timestamptz not null default now()
);

alter table public.ai_access_events enable row level security;
alter table public.ai_access_events force row level security;

revoke all on table public.ai_access_events from anon, authenticated;
grant select on table public.ai_access_events to authenticated;

drop policy if exists "users read own ai access history" on public.ai_access_events;
create policy "users read own ai access history"
  on public.ai_access_events
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create index if not exists ai_access_events_user_created_at_idx
  on public.ai_access_events (user_id, created_at desc);

comment on table public.ai_access_events is
  'Minimal user-visible AI access history. Never store tool payloads, timetable contents, precise location, credentials, or raw OAuth tokens.';

-- Ensure every account has an explicit preference row without subscribing anyone.
insert into public.user_email_preferences (user_id, product_updates, security_notices)
select id, false, true from auth.users
on conflict (user_id) do nothing;

create or replace function private.initialize_gapwise_email_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_email_preferences (user_id, product_updates, security_notices)
  values (new.id, false, true)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.initialize_gapwise_email_preferences() from public, anon, authenticated;

-- Keep the existing onboarding trigger independent; use a dedicated trigger so a
-- future onboarding refactor cannot silently change communications consent.
drop trigger if exists initialize_gapwise_email_preferences on auth.users;
create trigger initialize_gapwise_email_preferences
  after insert on auth.users
  for each row execute function private.initialize_gapwise_email_preferences();

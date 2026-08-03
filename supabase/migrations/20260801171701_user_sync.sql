-- Gapwise stores only normalized meetings and user-selected route preferences.
-- The original ICS file and calculated gaps/routes never enter Supabase.

create table public.user_schedules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  meetings jsonb not null,
  source_filename text null,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint user_schedules_meetings_is_array
    check (jsonb_typeof(meetings) = 'array')
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  walking_speed_mps numeric not null default 1.35,
  route_mode text not null default 'fastest',
  transition_buffer_minutes integer not null default 5,
  avoid_stairs boolean not null default false,
  prefer_indoor boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint user_preferences_route_mode
    check (route_mode in ('fastest', 'prefer-indoor', 'step-free')),
  constraint user_preferences_walking_speed
    check (walking_speed_mps between 0.5 and 3),
  constraint user_preferences_transition_buffer
    check (transition_buffer_minutes between 0 and 60)
);

alter table public.user_schedules enable row level security;
alter table public.user_preferences enable row level security;

create policy "user_schedules_select_own" on public.user_schedules
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_schedules_insert_own" on public.user_schedules
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_schedules_update_own" on public.user_schedules
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "user_schedules_delete_own" on public.user_schedules
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "user_preferences_select_own" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_preferences_insert_own" on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_preferences_update_own" on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "user_preferences_delete_own" on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.user_schedules from anon;
revoke all on table public.user_preferences from anon;
grant select, insert, update, delete on table public.user_schedules to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;

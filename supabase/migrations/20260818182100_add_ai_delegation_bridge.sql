-- Production migration applied to Gapwise Supabase on 2026-08-18.
-- Additive only: no existing private-cloud table is altered.

create table public.ai_delegations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  revision bigint not null check (revision >= 1),
  permissions jsonb not null check (jsonb_typeof(permissions) = 'object'),
  snapshot_schema_version smallint not null default 1 check (snapshot_schema_version = 1),
  crypto_version smallint not null default 1 check (crypto_version = 1),
  snapshot_ciphertext text not null check (octet_length(snapshot_ciphertext) between 16 and 1048576),
  snapshot_nonce text not null check (length(snapshot_nonce) between 12 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_delegations enable row level security;
revoke all on table public.ai_delegations from public, anon;
grant select, insert, update, delete on table public.ai_delegations to authenticated;

create policy ai_delegations_select_own on public.ai_delegations for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy ai_delegations_insert_own on public.ai_delegations for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy ai_delegations_update_own on public.ai_delegations for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy ai_delegations_delete_own on public.ai_delegations for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create table public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  expected_revision bigint not null check (expected_revision >= 1),
  action_schema_version smallint not null default 1 check (action_schema_version = 1),
  crypto_version smallint not null default 1 check (crypto_version = 1),
  action_ciphertext text not null check (octet_length(action_ciphertext) between 16 and 262144),
  action_nonce text not null check (length(action_nonce) between 12 and 64),
  status text not null default 'queued' check (status in ('queued', 'applied', 'rejected')),
  result_code text null check (result_code is null or length(result_code) <= 64),
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  unique (user_id, idempotency_key),
  check ((status = 'queued' and completed_at is null) or (status in ('applied', 'rejected') and completed_at is not null))
);

create index ai_pending_actions_owner_status_created_idx
on public.ai_pending_actions (user_id, status, created_at);

alter table public.ai_pending_actions enable row level security;
revoke all on table public.ai_pending_actions from public, anon;
grant select, insert, update, delete on table public.ai_pending_actions to authenticated;

create policy ai_pending_actions_select_own on public.ai_pending_actions for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy ai_pending_actions_insert_own on public.ai_pending_actions for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy ai_pending_actions_update_own on public.ai_pending_actions for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy ai_pending_actions_delete_own on public.ai_pending_actions for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

comment on table public.ai_delegations is 'Encrypted, explicitly opt-in AI timetable snapshot metadata. Snapshot plaintext never resides in Postgres.';
comment on table public.ai_pending_actions is 'Encrypted typed AI actions queued for the Gapwise browser to apply against the canonical private state.';

create table public.ai_oauth_clients (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 512),
  client_name text not null check (length(client_name) between 1 and 240),
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

alter table public.ai_oauth_clients enable row level security;
revoke all on table public.ai_oauth_clients from public, anon, authenticated;
grant select, insert, delete on table public.ai_oauth_clients to authenticated;

create policy ai_oauth_clients_select_direct_own
on public.ai_oauth_clients for select to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (select auth.jwt()->>'client_id') is null
);

create policy ai_oauth_clients_insert_direct_own
on public.ai_oauth_clients for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (select auth.jwt()->>'client_id') is null
);

create policy ai_oauth_clients_delete_direct_own
on public.ai_oauth_clients for delete to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (select auth.jwt()->>'client_id') is null
);

create or replace function private.is_approved_ai_oauth_client(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and p_user_id = (select auth.uid())
    and (select auth.jwt()->>'client_id') is not null
    and exists (
      select 1
      from public.ai_oauth_clients as approval
      where approval.user_id = p_user_id
        and approval.client_id = (select auth.jwt()->>'client_id')
    )
$$;

revoke all on function private.is_approved_ai_oauth_client(uuid) from public;
grant execute on function private.is_approved_ai_oauth_client(uuid) to authenticated;

create or replace function private.is_direct_user_session()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select auth.jwt()->>'client_id') is null
$$;

revoke all on function private.is_direct_user_session() from public, authenticated;

revoke all on table public.ai_delegations from authenticated;
grant select, insert, update, delete on table public.ai_delegations to authenticated;
revoke all on table public.ai_pending_actions from authenticated;
grant select, insert, update, delete on table public.ai_pending_actions to authenticated;

create policy ai_delegations_oauth_client_gate
on public.ai_delegations
as restrictive
for all
to authenticated
using (
  (select auth.jwt()->>'client_id') is null
  or private.is_approved_ai_oauth_client(user_id)
)
with check (
  (select auth.jwt()->>'client_id') is null
  or private.is_approved_ai_oauth_client(user_id)
);

create policy ai_pending_actions_oauth_client_gate
on public.ai_pending_actions
as restrictive
for all
to authenticated
using (
  (select auth.jwt()->>'client_id') is null
  or private.is_approved_ai_oauth_client(user_id)
)
with check (
  (select auth.jwt()->>'client_id') is null
  or private.is_approved_ai_oauth_client(user_id)
);

create policy crypto_key_envelopes_direct_session_only
on public.crypto_key_envelopes
as restrictive
for all
to authenticated
using ((select auth.jwt()->>'client_id') is null)
with check ((select auth.jwt()->>'client_id') is null);

create policy encrypted_private_data_direct_session_only
on public.encrypted_private_data
as restrictive
for all
to authenticated
using ((select auth.jwt()->>'client_id') is null)
with check ((select auth.jwt()->>'client_id') is null);

create policy encrypted_friend_availability_direct_session_only
on public.encrypted_friend_availability
as restrictive
for all
to authenticated
using ((select auth.jwt()->>'client_id') is null)
with check ((select auth.jwt()->>'client_id') is null);

create policy friend_profiles_direct_session_only
on public.friend_profiles
as restrictive
for all
to authenticated
using ((select auth.jwt()->>'client_id') is null)
with check ((select auth.jwt()->>'client_id') is null);

create policy friend_invites_direct_session_only
on public.friend_invites
as restrictive
for all
to authenticated
using ((select auth.jwt()->>'client_id') is null)
with check ((select auth.jwt()->>'client_id') is null);

create policy friendships_direct_session_only
on public.friendships
as restrictive
for all
to authenticated
using ((select auth.jwt()->>'client_id') is null)
with check ((select auth.jwt()->>'client_id') is null);

comment on table public.ai_oauth_clients is 'Per-user allowlist of OAuth client IDs approved for the encrypted Gapwise AI bridge. Direct browser sessions manage approvals; OAuth tokens cannot manage this table.';

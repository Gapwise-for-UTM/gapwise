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
    and ((select auth.jwt()) ->> 'client_id') is not null
    and exists (
      select 1
      from public.ai_oauth_clients as approval
      where approval.user_id = p_user_id
        and approval.client_id = ((select auth.jwt()) ->> 'client_id')
    )
$$;

create or replace function private.is_direct_user_session()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and ((select auth.jwt()) ->> 'client_id') is null
$$;

revoke all on function private.is_direct_user_session() from public, authenticated;

drop policy if exists ai_oauth_clients_select_direct_own on public.ai_oauth_clients;
create policy ai_oauth_clients_select_direct_own
on public.ai_oauth_clients for select to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and ((select auth.jwt()) ->> 'client_id') is null
);

drop policy if exists ai_oauth_clients_insert_direct_own on public.ai_oauth_clients;
create policy ai_oauth_clients_insert_direct_own
on public.ai_oauth_clients for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and ((select auth.jwt()) ->> 'client_id') is null
);

drop policy if exists ai_oauth_clients_delete_direct_own on public.ai_oauth_clients;
create policy ai_oauth_clients_delete_direct_own
on public.ai_oauth_clients for delete to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and ((select auth.jwt()) ->> 'client_id') is null
);

drop policy if exists ai_delegations_oauth_client_gate on public.ai_delegations;
create policy ai_delegations_oauth_client_gate
on public.ai_delegations
as restrictive
for all
to authenticated
using (
  ((select auth.jwt()) ->> 'client_id') is null
  or private.is_approved_ai_oauth_client(user_id)
)
with check (
  ((select auth.jwt()) ->> 'client_id') is null
  or private.is_approved_ai_oauth_client(user_id)
);

drop policy if exists ai_pending_actions_oauth_client_gate on public.ai_pending_actions;
create policy ai_pending_actions_oauth_client_gate
on public.ai_pending_actions
as restrictive
for all
to authenticated
using (
  ((select auth.jwt()) ->> 'client_id') is null
  or private.is_approved_ai_oauth_client(user_id)
)
with check (
  ((select auth.jwt()) ->> 'client_id') is null
  or private.is_approved_ai_oauth_client(user_id)
);

drop policy if exists crypto_key_envelopes_direct_session_only on public.crypto_key_envelopes;
create policy crypto_key_envelopes_direct_session_only
on public.crypto_key_envelopes
as restrictive
for all
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null)
with check (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists encrypted_private_data_direct_session_only on public.encrypted_private_data;
create policy encrypted_private_data_direct_session_only
on public.encrypted_private_data
as restrictive
for all
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null)
with check (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists encrypted_friend_availability_direct_session_only on public.encrypted_friend_availability;
create policy encrypted_friend_availability_direct_session_only
on public.encrypted_friend_availability
as restrictive
for all
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null)
with check (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists friend_profiles_direct_session_only on public.friend_profiles;
create policy friend_profiles_direct_session_only
on public.friend_profiles
as restrictive
for all
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null)
with check (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists friend_invites_direct_session_only on public.friend_invites;
create policy friend_invites_direct_session_only
on public.friend_invites
as restrictive
for all
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null)
with check (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists friendships_direct_session_only on public.friendships;
create policy friendships_direct_session_only
on public.friendships
as restrictive
for all
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null)
with check (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists ai_delegations_insert_direct_only on public.ai_delegations;
create policy ai_delegations_insert_direct_only
on public.ai_delegations
as restrictive
for insert
to authenticated
with check (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists ai_delegations_update_direct_only on public.ai_delegations;
create policy ai_delegations_update_direct_only
on public.ai_delegations
as restrictive
for update
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null)
with check (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists ai_delegations_delete_direct_only on public.ai_delegations;
create policy ai_delegations_delete_direct_only
on public.ai_delegations
as restrictive
for delete
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists ai_pending_actions_update_direct_only on public.ai_pending_actions;
create policy ai_pending_actions_update_direct_only
on public.ai_pending_actions
as restrictive
for update
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null)
with check (((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists ai_pending_actions_delete_direct_only on public.ai_pending_actions;
create policy ai_pending_actions_delete_direct_only
on public.ai_pending_actions
as restrictive
for delete
to authenticated
using (((select auth.jwt()) ->> 'client_id') is null);

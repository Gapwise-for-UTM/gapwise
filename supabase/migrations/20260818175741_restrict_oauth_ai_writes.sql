create policy ai_delegations_insert_direct_only
on public.ai_delegations
as restrictive
for insert
to authenticated
with check ((select auth.jwt()->>'client_id') is null);

create policy ai_delegations_update_direct_only
on public.ai_delegations
as restrictive
for update
to authenticated
using ((select auth.jwt()->>'client_id') is null)
with check ((select auth.jwt()->>'client_id') is null);

create policy ai_delegations_delete_direct_only
on public.ai_delegations
as restrictive
for delete
to authenticated
using ((select auth.jwt()->>'client_id') is null);

create policy ai_pending_actions_update_direct_only
on public.ai_pending_actions
as restrictive
for update
to authenticated
using ((select auth.jwt()->>'client_id') is null)
with check ((select auth.jwt()->>'client_id') is null);

create policy ai_pending_actions_delete_direct_only
on public.ai_pending_actions
as restrictive
for delete
to authenticated
using ((select auth.jwt()->>'client_id') is null);

create or replace function private.enforce_ai_action_queue_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) >= 50
    from public.ai_pending_actions as action
    where action.user_id = new.user_id
      and action.status = 'queued'
  ) then
    raise exception 'AI action queue is full.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_ai_action_queue_cap() from public, anon, authenticated;

drop trigger if exists ai_pending_actions_queue_cap on public.ai_pending_actions;
create trigger ai_pending_actions_queue_cap
before insert on public.ai_pending_actions
for each row execute function private.enforce_ai_action_queue_cap();

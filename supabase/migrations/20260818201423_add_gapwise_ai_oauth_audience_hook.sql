-- Bind Supabase OAuth tokens to the Gapwise AI MCP resource only after the
-- exact user/client pair has been explicitly approved in Gapwise.
create or replace function public.gapwise_ai_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event->'claims', '{}'::jsonb);
  oauth_client_id text := nullif(claims->>'client_id', '');
  event_user_id uuid;
  approved boolean := false;
begin
  begin
    event_user_id := nullif(event->>'user_id', '')::uuid;
  exception when invalid_text_representation then
    event_user_id := null;
  end;

  if oauth_client_id is not null and event_user_id is not null then
    select exists (
      select 1
      from public.ai_oauth_clients as approved_client
      where approved_client.user_id = event_user_id
        and approved_client.client_id = oauth_client_id
    ) into approved;
  end if;

  if approved then
    claims := jsonb_set(
      claims,
      '{aud}',
      to_jsonb('https://ai.gapwise.ca/api/mcp'::text),
      true
    );
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

comment on function public.gapwise_ai_access_token_hook(jsonb) is
  'Supabase custom access-token hook: binds only explicitly approved Gapwise AI OAuth clients to the canonical MCP audience.';

revoke all on function public.gapwise_ai_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.gapwise_ai_access_token_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on table public.ai_oauth_clients to supabase_auth_admin;

drop policy if exists ai_oauth_clients_auth_hook_select on public.ai_oauth_clients;
create policy ai_oauth_clients_auth_hook_select
on public.ai_oauth_clients
as permissive
for select
to supabase_auth_admin
using (true);

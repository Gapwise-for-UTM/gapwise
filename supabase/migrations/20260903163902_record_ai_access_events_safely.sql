create or replace function public.record_ai_access_event(
  p_event_type text,
  p_client_name text default null,
  p_capability text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  v_client_name text;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_event_type not in ('authorized', 'revoked', 'context_read', 'action_queued', 'action_applied', 'action_rejected') then
    raise exception 'unsupported event type';
  end if;
  if p_capability is not null and length(p_capability) > 120 then
    raise exception 'capability too long';
  end if;

  if v_client_id is not null then
    if p_event_type in ('authorized', 'revoked') then
      raise exception 'delegated sessions cannot change authorization history';
    end if;
    select c.client_name
      into v_client_name
      from public.ai_oauth_clients as c
     where c.user_id = v_user_id
       and c.client_id = v_client_id
     limit 1;
    if v_client_name is null then
      raise exception 'oauth client is not approved';
    end if;
  else
    if p_event_type not in ('authorized', 'revoked', 'action_applied', 'action_rejected') then
      raise exception 'direct sessions cannot claim delegated reads';
    end if;
    v_client_name := btrim(coalesce(p_client_name, ''));
    if length(v_client_name) < 1 or length(v_client_name) > 240 then
      raise exception 'invalid client name';
    end if;
  end if;

  insert into public.ai_access_events (user_id, client_name, event_type, capability)
  values (v_user_id, v_client_name, p_event_type, nullif(btrim(coalesce(p_capability, '')), ''));
end;
$$;

revoke all on function public.record_ai_access_event(text, text, text) from public, anon;
grant execute on function public.record_ai_access_event(text, text, text) to authenticated;
comment on function public.record_ai_access_event(text, text, text) is
  'Records minimal caller-owned AI access metadata. Delegated sessions derive client identity from the JWT client_id and an existing approved-client row; direct sessions may only record authorization/revocation or browser-completed action outcomes.';

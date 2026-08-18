create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := event->'claims';
  oauth_client_id text := event->'claims'->>'client_id';
begin
  if claims is null or jsonb_typeof(claims) <> 'object' then
    return event;
  end if;

  -- Only OAuth client tokens carry client_id. Keep ordinary Gapwise browser
  -- session tokens unchanged, including Supabase's normal authenticated aud.
  if oauth_client_id is not null and btrim(oauth_client_id) <> '' then
    claims := jsonb_set(
      claims,
      '{resource}',
      to_jsonb('https://ai.gapwise.ca/api/mcp'::text),
      true
    );
    event := jsonb_set(event, '{claims}', claims, true);
  end if;

  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

comment on function public.custom_access_token_hook(jsonb) is
  'Supabase Auth custom access-token hook: resource-binds OAuth client tokens to the canonical Gapwise MCP endpoint without changing direct browser-session tokens.';

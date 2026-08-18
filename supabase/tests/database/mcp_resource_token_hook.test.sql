begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function(
  'public',
  'custom_access_token_hook',
  array['jsonb'],
  'MCP custom access-token hook exists'
);

select is(
  public.custom_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000201","claims":{"sub":"00000000-0000-4000-8000-000000000201","aud":"authenticated","client_id":"chatgpt-client"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb
  )->'claims'->>'resource',
  'https://ai.gapwise.ca/api/mcp',
  'OAuth client tokens are bound to the canonical Gapwise MCP resource'
);

select is(
  public.custom_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000201","claims":{"sub":"00000000-0000-4000-8000-000000000201","aud":"authenticated","client_id":"chatgpt-client"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb
  )->'claims'->>'aud',
  'authenticated',
  'OAuth resource binding preserves Supabase normal audience'
);

select is(
  public.custom_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000201","claims":{"sub":"00000000-0000-4000-8000-000000000201","aud":"authenticated"},"authentication_method":"password"}'::jsonb
  )->'claims'->>'resource',
  null,
  'ordinary Gapwise browser tokens are not MCP resource-bound'
);

select is(
  public.custom_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000201","claims":{"sub":"00000000-0000-4000-8000-000000000201","aud":"authenticated","client_id":"claude-client","resource":"https://wrong.example/api/mcp"},"authentication_method":"token_refresh"}'::jsonb
  )->'claims'->>'resource',
  'https://ai.gapwise.ca/api/mcp',
  'OAuth refresh issuance cannot retain a stale or attacker-selected resource claim'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

select has_function(
  'public',
  'gapwise_ai_access_token_hook',
  array['jsonb'],
  'approved-client Gapwise AI access-token hook exists'
);

select ok(
  to_regprocedure('public.custom_access_token_hook(jsonb)') is null,
  'unsafe generic MCP resource hook is absent'
);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000201', 'mcp-hook-owner@example.test');

insert into public.ai_oauth_clients (user_id, client_id, client_name)
values (
  '00000000-0000-4000-8000-000000000201',
  'approved-ai-client',
  'Approved test AI client'
);

set local role supabase_auth_admin;

select is(
  public.gapwise_ai_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000201","claims":{"sub":"00000000-0000-4000-8000-000000000201","aud":"authenticated","client_id":"approved-ai-client"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb
  )->'claims'->>'aud',
  'https://ai.gapwise.ca/api/mcp',
  'approved OAuth client token is bound to the canonical Gapwise MCP audience'
);

select is(
  public.gapwise_ai_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000201","claims":{"sub":"00000000-0000-4000-8000-000000000201","aud":"authenticated","client_id":"unapproved-ai-client"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb
  )->'claims'->>'aud',
  'authenticated',
  'unapproved OAuth client does not receive the Gapwise MCP audience'
);

select is(
  public.gapwise_ai_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000201","claims":{"sub":"00000000-0000-4000-8000-000000000201","aud":"authenticated"},"authentication_method":"password"}'::jsonb
  )->'claims'->>'aud',
  'authenticated',
  'ordinary Gapwise browser token keeps the normal Supabase audience'
);

select is(
  public.gapwise_ai_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000202","claims":{"sub":"00000000-0000-4000-8000-000000000202","aud":"authenticated","client_id":"approved-ai-client"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb
  )->'claims'->>'aud',
  'authenticated',
  'approval is bound to the exact user and cannot be reused by another user'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function(
  'public',
  'gapwise_ai_access_token_hook',
  array['jsonb'],
  'approved-client MCP audience hook exists'
);

select hasnt_function(
  'public',
  'custom_access_token_hook',
  array['jsonb'],
  'obsolete generic OAuth hook is absent'
);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000211', 'ai-hook-owner@example.test');

select is(
  public.gapwise_ai_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000211","claims":{"sub":"00000000-0000-4000-8000-000000000211","aud":"authenticated","client_id":"unapproved-client"}}'::jsonb
  )->'claims'->>'aud',
  'authenticated',
  'unapproved OAuth clients keep the normal Supabase audience'
);

insert into public.ai_oauth_clients (user_id, client_id, client_name)
values (
  '00000000-0000-4000-8000-000000000211',
  'approved-client',
  'Approved test client'
);

select is(
  public.gapwise_ai_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000211","claims":{"sub":"00000000-0000-4000-8000-000000000211","aud":"authenticated","client_id":"approved-client"}}'::jsonb
  )->'claims'->>'aud',
  'https://ai.gapwise.ca/api/mcp',
  'approved OAuth clients receive the exact MCP audience'
);

select is(
  public.gapwise_ai_access_token_hook(
    '{"user_id":"00000000-0000-4000-8000-000000000211","claims":{"sub":"00000000-0000-4000-8000-000000000211","aud":"authenticated"}}'::jsonb
  )->'claims'->>'aud',
  'authenticated',
  'ordinary Gapwise browser sessions keep the normal audience'
);

select * from finish();
rollback;

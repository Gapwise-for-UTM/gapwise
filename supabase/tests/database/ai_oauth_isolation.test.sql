begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'ai_delegations', 'AI delegation table exists');
select has_table('public', 'ai_pending_actions', 'AI action queue exists');
select has_table('public', 'ai_oauth_clients', 'AI OAuth approval table exists');

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.ai_delegations'::regclass),
  'AI delegations have forced RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.ai_pending_actions'::regclass),
  'AI pending actions have forced RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.ai_oauth_clients'::regclass),
  'AI OAuth approvals have forced RLS'
);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000201', 'ai-oauth-owner@example.test');

insert into public.crypto_key_envelopes (
  user_id,
  subject_id,
  private_data_key_id,
  private_data_wrapped_dek,
  private_data_wrap_nonce,
  friend_availability_key_id,
  friend_availability_wrapped_dek,
  friend_availability_wrap_nonce,
  kek_version
)
values (
  '00000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000201',
  '20000000-0000-4000-8000-000000000201',
  decode(repeat('61', 48), 'hex'),
  decode(repeat('62', 12), 'hex'),
  '30000000-0000-4000-8000-000000000201',
  decode(repeat('63', 48), 'hex'),
  decode(repeat('64', 12), 'hex'),
  1
);

insert into public.encrypted_private_data (
  user_id, subject_id, record_id, key_id, ciphertext, nonce
)
values (
  '00000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000201',
  '40000000-0000-4000-8000-000000000201',
  '20000000-0000-4000-8000-000000000201',
  decode(repeat('65', 32), 'hex'),
  decode(repeat('66', 12), 'hex')
);

insert into public.ai_delegations (
  user_id,
  enabled,
  revision,
  permissions,
  snapshot_schema_version,
  crypto_version,
  snapshot_ciphertext,
  snapshot_nonce
)
values (
  '00000000-0000-4000-8000-000000000201',
  true,
  1,
  '{"readSchedule":true,"readPersonal":false,"writePersonal":false,"readGapPlans":false,"readGapPreferences":false,"writeGapPreferences":false,"readRoutingPreferences":false}',
  1,
  1,
  'aaaaaaaaaaaaaaaa',
  'bbbbbbbbbbbb'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated","client_id":"unapproved-ai-client"}';

select is(
  (select count(*) from public.ai_delegations),
  0::bigint,
  'unapproved OAuth client cannot read even its owner AI delegation'
);
select is(
  (select count(*) from public.encrypted_private_data),
  0::bigint,
  'OAuth client cannot read primary encrypted timetable data'
);
select is(
  (select count(*) from public.crypto_key_envelopes),
  0::bigint,
  'OAuth client cannot read wrapped primary private-data keys'
);
select is(
  (select count(*) from public.ai_oauth_clients),
  0::bigint,
  'OAuth client cannot inspect or manage its approval allowlist'
);

select throws_ok(
  $$select * from public.create_friend_invite()$$,
  '42501',
  'Authentication required.',
  'OAuth client cannot invoke privileged friend mutation RPCs'
);

reset role;
insert into public.ai_oauth_clients (user_id, client_id, client_name)
values (
  '00000000-0000-4000-8000-000000000201',
  'approved-ai-client',
  'Approved test AI client'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated","client_id":"approved-ai-client"}';

select is(
  (select count(*) from public.ai_delegations),
  1::bigint,
  'approved OAuth client can read its explicitly delegated AI row'
);
select is(
  (select count(*) from public.encrypted_private_data),
  0::bigint,
  'approved OAuth client still cannot read primary encrypted timetable data'
);
select is(
  (select count(*) from public.crypto_key_envelopes),
  0::bigint,
  'approved OAuth client still cannot read wrapped primary keys'
);
select is(
  (select count(*) from public.ai_oauth_clients),
  0::bigint,
  'approved OAuth client still cannot read the approval allowlist'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated"}';

select is(
  (select count(*) from public.encrypted_private_data),
  1::bigint,
  'direct Gapwise browser session retains primary encrypted-data access'
);
select is(
  (select count(*) from public.ai_oauth_clients),
  1::bigint,
  'direct Gapwise browser session can read its OAuth approval records'
);

select * from finish();
rollback;

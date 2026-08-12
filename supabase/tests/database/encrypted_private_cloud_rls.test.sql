begin;

create extension if not exists pgtap with schema extensions;
select plan(36);

select has_table('public', 'crypto_key_envelopes', 'key envelope table exists');
select has_table('public', 'encrypted_private_data', 'encrypted private-data table exists');
select has_table('public', 'encrypted_friend_availability', 'encrypted friend capsule table exists');
select has_table('private', 'friend_capsule_rate_limits', 'private capsule rate limit exists');

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.crypto_key_envelopes'::regclass),
  'key envelopes have forced RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.encrypted_private_data'::regclass),
  'encrypted private data has forced RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.encrypted_friend_availability'::regclass),
  'encrypted friend availability has forced RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.crypto_key_envelopes', 'select'),
  'authenticated owners can read their RLS-scoped wrapped keys'
);
select ok(
  has_table_privilege('authenticated', 'public.crypto_key_envelopes', 'insert'),
  'authenticated owners can bootstrap their own envelope'
);
select is(
  has_table_privilege('authenticated', 'public.crypto_key_envelopes', 'update'),
  false,
  'browser roles cannot directly rewrite key envelopes'
);
select is(
  has_table_privilege('anon', 'public.crypto_key_envelopes', 'select'),
  false,
  'anonymous users cannot read wrapped keys'
);
select ok(
  has_table_privilege('authenticated', 'public.encrypted_friend_availability', 'select'),
  'authenticated owners can read only their RLS-scoped capsule'
);
select ok(
  has_function_privilege('authenticated', 'public.get_friend_capsule_material(uuid,text)', 'execute'),
  'authenticated users may call the narrow encrypted-material RPC'
);
select is(
  has_function_privilege('anon', 'public.get_friend_capsule_material(uuid,text)', 'execute'),
  false,
  'anonymous users cannot call the friend-material RPC'
);
select ok(
  not exists (
    select 1
    from pg_proc as procedure
    cross join lateral aclexplode(procedure.proacl) as privilege
    where procedure.oid = 'public.get_friend_capsule_material(uuid,text)'::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot call the friend-material RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.rotate_own_key_envelope(integer,integer,bytea,bytea,bytea,bytea)',
    'execute'
  ),
  'authenticated users may call the owner-only rotation RPC'
);
select is(
  has_function_privilege(
    'anon',
    'public.rotate_own_key_envelope(integer,integer,bytea,bytea,bytea,bytea)',
    'execute'
  ),
  false,
  'anonymous users cannot rotate key envelopes'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000101', 'encrypted-a@example.test'),
  ('00000000-0000-4000-8000-000000000102', 'encrypted-b@example.test'),
  ('00000000-0000-4000-8000-000000000103', 'encrypted-c@example.test'),
  ('00000000-0000-4000-8000-000000000104', 'encrypted-d@example.test');

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
values
  (
    '00000000-0000-4000-8000-000000000101',
    '10000000-0000-4000-8000-000000000101',
    '20000000-0000-4000-8000-000000000101',
    decode(repeat('01', 48), 'hex'),
    decode(repeat('02', 12), 'hex'),
    '30000000-0000-4000-8000-000000000101',
    decode(repeat('03', 48), 'hex'),
    decode(repeat('04', 12), 'hex'),
    1
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '10000000-0000-4000-8000-000000000102',
    '20000000-0000-4000-8000-000000000102',
    decode(repeat('11', 48), 'hex'),
    decode(repeat('12', 12), 'hex'),
    '30000000-0000-4000-8000-000000000102',
    decode(repeat('13', 48), 'hex'),
    decode(repeat('14', 12), 'hex'),
    1
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '10000000-0000-4000-8000-000000000103',
    '20000000-0000-4000-8000-000000000103',
    decode(repeat('21', 48), 'hex'),
    decode(repeat('22', 12), 'hex'),
    '30000000-0000-4000-8000-000000000103',
    decode(repeat('23', 48), 'hex'),
    decode(repeat('24', 12), 'hex'),
    1
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    '10000000-0000-4000-8000-000000000104',
    '20000000-0000-4000-8000-000000000104',
    decode(repeat('31', 48), 'hex'),
    decode(repeat('32', 12), 'hex'),
    '30000000-0000-4000-8000-000000000104',
    decode(repeat('33', 48), 'hex'),
    decode(repeat('34', 12), 'hex'),
    1
  );

insert into public.encrypted_private_data (user_id, subject_id, record_id, key_id, ciphertext, nonce)
select
  envelope.user_id,
  envelope.subject_id,
  case envelope.user_id
    when '00000000-0000-4000-8000-000000000101' then '40000000-0000-4000-8000-000000000101'::uuid
    when '00000000-0000-4000-8000-000000000102' then '40000000-0000-4000-8000-000000000102'::uuid
    when '00000000-0000-4000-8000-000000000103' then '40000000-0000-4000-8000-000000000103'::uuid
    else '40000000-0000-4000-8000-000000000104'::uuid
  end,
  envelope.private_data_key_id,
  decode(repeat('41', 32), 'hex'),
  decode(repeat('42', 12), 'hex')
from public.crypto_key_envelopes as envelope;

insert into public.encrypted_friend_availability (
  user_id,
  subject_id,
  capsule_id,
  key_id,
  ciphertext,
  nonce
)
select
  envelope.user_id,
  envelope.subject_id,
  case envelope.user_id
    when '00000000-0000-4000-8000-000000000101' then '50000000-0000-4000-8000-000000000101'::uuid
    when '00000000-0000-4000-8000-000000000102' then '50000000-0000-4000-8000-000000000102'::uuid
    when '00000000-0000-4000-8000-000000000103' then '50000000-0000-4000-8000-000000000103'::uuid
    else '50000000-0000-4000-8000-000000000104'::uuid
  end,
  envelope.friend_availability_key_id,
  decode(repeat('51', 32), 'hex'),
  decode(repeat('52', 12), 'hex')
from public.crypto_key_envelopes as envelope;

insert into public.friendships (
  id,
  user_a_id,
  user_b_id,
  requested_by,
  status,
  requester_accepted_at,
  recipient_accepted_at,
  accepted_at,
  revoked_at,
  revoked_by
)
values
  (
    '60000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000101',
    'accepted', now(), now(), now(), null, null
  ),
  (
    '60000000-0000-4000-8000-000000000902',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000101',
    'pending', now(), null, null, null, null
  ),
  (
    '60000000-0000-4000-8000-000000000903',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000101',
    'revoked', now(), null, null, now(), '00000000-0000-4000-8000-000000000104'
  );

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is((select count(*) from public.crypto_key_envelopes), 1::bigint, 'user A sees only its own key envelope');
select is(
  (select count(*) from public.crypto_key_envelopes where user_id = '00000000-0000-4000-8000-000000000102'),
  0::bigint,
  'user A cannot select user B wrapped keys'
);
select is((select count(*) from public.encrypted_private_data), 1::bigint, 'user A sees only its own encrypted private payload');
select is(
  (select count(*) from public.encrypted_friend_availability where user_id = '00000000-0000-4000-8000-000000000102'),
  0::bigint,
  'an accepted friend cannot direct-select another user capsule'
);
select results_eq(
  $$
    update public.encrypted_private_data
    set ciphertext = decode(repeat('71', 32), 'hex'), revision = 2
    where user_id = '00000000-0000-4000-8000-000000000102'
    returning 1
  $$,
  array[]::integer[],
  'user A cannot mutate user B encrypted private payload'
);
select is(
  public.rotate_own_key_envelope(
    1,
    2,
    decode(repeat('91', 48), 'hex'),
    decode(repeat('92', 12), 'hex'),
    decode(repeat('93', 48), 'hex'),
    decode(repeat('94', 12), 'hex')
  ),
  true,
  'owner rotation succeeds with the expected KEK version'
);
select is((select kek_version from public.crypto_key_envelopes), 2, 'rotation stores the newer KEK version');
select is(
  public.rotate_own_key_envelope(
    1,
    3,
    decode(repeat('a1', 48), 'hex'),
    decode(repeat('a2', 12), 'hex'),
    decode(repeat('a3', 48), 'hex'),
    decode(repeat('a4', 12), 'hex')
  ),
  false,
  'stale rotation cannot overwrite a newer envelope'
);
select is(
  (select count(*) from public.get_friend_capsule_material('60000000-0000-4000-8000-000000000901', 'Fall')),
  2::bigint,
  'mutual friendship returns exactly two encrypted material rows'
);
select set_eq(
  $$ select participant from public.get_friend_capsule_material('60000000-0000-4000-8000-000000000901', 'Fall') $$,
  array['caller', 'friend'],
  'material roles are fixed and reveal no participant Auth UUID'
);
select ok(
  pg_get_function_result('public.get_friend_capsule_material(uuid,text)'::regprocedure)
    !~* '(user_id|schedule|meeting|course|room|building|busy)',
  'friend-material contract excludes identities and timetable details'
);
select is(
  (select count(*) from public.get_friend_capsule_material('60000000-0000-4000-8000-000000000902', 'Fall')),
  0::bigint,
  'pending friendship returns no encrypted material'
);
select is(
  (select count(*) from public.get_friend_capsule_material('60000000-0000-4000-8000-000000000903', 'Fall')),
  0::bigint,
  'revoked friendship returns no encrypted material'
);
select is(
  (select count(*) from public.get_friend_capsule_material('60000000-0000-4000-8000-000000000999', 'Fall')),
  0::bigint,
  'unknown friendship returns no encrypted material'
);

reset role;
delete from auth.users where id = '00000000-0000-4000-8000-000000000101';

select is(
  (select count(*) from public.crypto_key_envelopes where user_id = '00000000-0000-4000-8000-000000000101'),
  0::bigint,
  'account deletion cascades key envelopes'
);
select is(
  (select count(*) from public.encrypted_private_data where user_id = '00000000-0000-4000-8000-000000000101'),
  0::bigint,
  'account deletion cascades encrypted private data'
);
select is(
  (select count(*) from public.encrypted_friend_availability where user_id = '00000000-0000-4000-8000-000000000101'),
  0::bigint,
  'account deletion cascades encrypted availability'
);
select is(
  (select count(*) from public.friendships where user_a_id = '00000000-0000-4000-8000-000000000101' or user_b_id = '00000000-0000-4000-8000-000000000101'),
  0::bigint,
  'account deletion cascades friendships'
);
select is(
  (select count(*) from private.friend_capsule_rate_limits where caller_id = '00000000-0000-4000-8000-000000000101'),
  0::bigint,
  'account deletion cascades capsule rate-limit state'
);

select * from finish();
rollback;

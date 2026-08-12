begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

select has_table('public', 'friend_profiles', 'friend profiles table exists');
select has_table('public', 'friend_invites', 'private-code hash table exists');
select has_table('public', 'friendships', 'friendships table exists');
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.friend_profiles'::regclass),
  'friend profiles use forced RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.friend_invites'::regclass),
  'friend invites use forced RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.friendships'::regclass),
  'friendships use forced RLS'
);
select is(
  has_table_privilege('authenticated', 'public.friend_invites', 'select'),
  false,
  'authenticated clients cannot read invite hashes'
);
select is(
  has_table_privilege('authenticated', 'public.friendships', 'select'),
  false,
  'authenticated clients cannot read participant Auth UUIDs directly'
);
select is(
  has_function_privilege('anon', 'public.list_friend_connections()', 'execute'),
  false,
  'anonymous users cannot list friend connections'
);
select ok(
  has_function_privilege('authenticated', 'public.list_friend_connections()', 'execute'),
  'authenticated users may call the bounded friend-list projection'
);
select ok(
  has_function_privilege('authenticated', 'public.claim_friend_invite(text)', 'execute'),
  'authenticated users may submit opaque invite codes'
);
select is(
  has_function_privilege('anon', 'public.claim_friend_invite(text)', 'execute'),
  false,
  'anonymous users cannot submit friend invite codes'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'a@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'b@example.test'),
  ('00000000-0000-4000-8000-000000000003', 'c@example.test'),
  ('00000000-0000-4000-8000-000000000004', 'd@example.test');

insert into public.friend_profiles (user_id, display_name)
values
  ('00000000-0000-4000-8000-000000000001', 'Alex'),
  ('00000000-0000-4000-8000-000000000002', 'Blair'),
  ('00000000-0000-4000-8000-000000000003', 'Casey'),
  ('00000000-0000-4000-8000-000000000004', 'Devon');

select throws_like(
  $$
    update public.friend_profiles
    set display_name = 'Al' || chr(8238) || 'ex'
    where user_id = '00000000-0000-4000-8000-000000000001'
  $$,
  '%friend_profiles_display_name%',
  'the database rejects bidirectional display-name controls'
);

insert into public.friendships (
  id,
  user_a_id,
  user_b_id,
  requested_by,
  status,
  requester_accepted_at,
  recipient_accepted_at,
  accepted_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'accepted', now(), now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'pending', now(), null, null
  );

create temporary table captured_invite (code text not null) on commit drop;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000001';

select lives_ok(
  $$
    update public.friend_profiles
    set display_name = 'Alex Safe'
    where user_id = '00000000-0000-4000-8000-000000000001'
  $$,
  'owners can update their safe friend display name'
);
select is(
  (select count(*) from public.friend_profiles),
  1::bigint,
  'direct profile reads expose only the caller row'
);
select is(
  (select count(*) from public.friend_profiles where user_id = '00000000-0000-4000-8000-000000000002'),
  0::bigint,
  'a caller cannot direct-read another user profile'
);
select is(
  (select count(*) from public.list_friend_connections()),
  2::bigint,
  'friend-list RPC returns only the caller current relationships'
);
select is(
  (select count(*) from public.list_friend_connections() where status = 'accepted' and direction = 'mutual'),
  1::bigint,
  'accepted relationships are reported as mutual'
);
select is(
  (select count(*) from public.list_friend_connections() where status = 'pending' and direction = 'outgoing'),
  1::bigint,
  'requester sees a pending request only as outgoing'
);
select is(
  public.revoke_friendship('10000000-0000-4000-8000-000000000001'),
  true,
  'either participant can revoke an accepted friendship'
);
select is(
  (select count(*) from public.list_friend_connections() where friendship_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'revoked relationships immediately disappear from friend-list output'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.list_friend_connections() where status = 'pending' and direction = 'incoming'),
  1::bigint,
  'recipient sees the request only as incoming'
);
select is(
  public.respond_to_friend_request('10000000-0000-4000-8000-000000000002', true),
  true,
  'recipient can explicitly accept a pending request'
);
select is(
  (select count(*) from public.list_friend_connections() where status = 'accepted' and direction = 'mutual'),
  1::bigint,
  'acceptance becomes mutual for the recipient'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000004';
select is(
  public.claim_friend_invite('not-a-real-code'),
  true,
  'invalid invite submissions receive the same non-enumerating success shape'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000002';
insert into captured_invite (code)
select invite_code from public.create_friend_invite();
select ok(
  (select code ~ '^[0-9a-f]{48}$' from captured_invite),
  'generated friend codes contain 192 bits encoded as 48 hex characters'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000004';
select is(
  public.claim_friend_invite((select code from captured_invite)),
  true,
  'valid invite claim uses the same response shape as an invalid claim'
);
select is(
  (select count(*) from public.list_friend_connections() where status = 'pending' and direction = 'outgoing'),
  1::bigint,
  'claiming a valid private code creates only a pending outgoing request'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.list_friend_connections() where status = 'pending' and direction = 'incoming'),
  1::bigint,
  'invite owner sees the claimed request only as incoming'
);
select is(
  public.respond_to_friend_request(
    (select friendship_id from public.list_friend_connections() where status = 'pending' and direction = 'incoming' limit 1),
    true
  ),
  true,
  'invite owner must explicitly accept before the relationship becomes mutual'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.list_friend_connections() where status = 'accepted' and direction = 'mutual'),
  1::bigint,
  'private-code connection is mutual only after explicit acceptance'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000002';
select is(public.disable_friend_invite(), true, 'disabling an invite is safe even after single-use claim');

reset role;
delete from auth.users where id = '00000000-0000-4000-8000-000000000002';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.list_friend_connections()),
  0::bigint,
  'deleting an account cascades every relationship involving that account'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
select plan(41);

select has_table('public', 'friend_profiles', 'friend profiles table exists');
select has_table('public', 'friend_invites', 'private-code hash table exists');
select has_table('public', 'friendships', 'friendships table exists');

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.user_schedules'::regclass
  ),
  'full schedules remain protected by RLS'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.friendships'::regclass
  ),
  'friendships are protected by RLS'
);
select is(
  has_table_privilege('authenticated', 'public.friend_invites', 'select'),
  false,
  'authenticated clients cannot read invite hashes'
);
select is(
  has_table_privilege('authenticated', 'public.friendships', 'select'),
  false,
  'authenticated clients cannot read participant Auth UUIDs from friendships'
);
select is(
  has_function_privilege(
    'authenticated',
    'private.schedule_gap_windows(uuid,text)',
    'execute'
  ),
  false,
  'authenticated clients cannot call the raw gap helper'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'a@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'b@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'c@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'd@example.test');

insert into public.friend_profiles (user_id, display_name)
values
  ('00000000-0000-0000-0000-000000000001', 'Alex'),
  ('00000000-0000-0000-0000-000000000002', 'Blair'),
  ('00000000-0000-0000-0000-000000000003', 'Casey'),
  ('00000000-0000-0000-0000-000000000004', 'Devon');

select throws_like(
  $$
    update public.friend_profiles
    set display_name = 'Al' || chr(8238) || 'ex'
    where user_id = '00000000-0000-0000-0000-000000000001'
  $$,
  '%friend_profiles_display_name%',
  'the database rejects bidirectional display-name controls'
);

insert into public.user_schedules (user_id, meetings)
values
  (
    '00000000-0000-0000-0000-000000000001',
    '[
      {"id":"a-mon-lec","courseCode":"CSC108H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":540,"endTime":600,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"a-mon-tut","courseCode":"MAT102H5","activityType":"TUT","sectionCode":"0101","courseName":"Synthetic","startTime":720,"endTime":780,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"a-wed-lec","courseCode":"CSC108H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":600,"endTime":660,"weekday":"Wednesday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"a-wed-next","courseCode":"MAT102H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":780,"endTime":840,"weekday":"Wednesday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"a-win-1","courseCode":"CSC101H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":540,"endTime":570,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false},
      {"id":"a-win-2","courseCode":"CSC102H5","activityType":"TUT","sectionCode":"0101","courseName":"Synthetic","startTime":600,"endTime":630,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false},
      {"id":"a-win-3","courseCode":"CSC103H5","activityType":"PRA","sectionCode":"0101","courseName":"Synthetic","startTime":660,"endTime":690,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false},
      {"id":"a-win-4","courseCode":"CSC104H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":720,"endTime":750,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false},
      {"id":"a-win-5","courseCode":"CSC105H5","activityType":"TUT","sectionCode":"0101","courseName":"Synthetic","startTime":780,"endTime":810,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false}
    ]'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '[
      {"id":"b-mon-tut","courseCode":"CSC108H5","activityType":"TUT","sectionCode":"0101","courseName":"Synthetic","startTime":570,"endTime":630,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"b-mon-next","courseCode":"MAT102H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":750,"endTime":810,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"b-wed-tut","courseCode":"CSC108H5","activityType":"TUT","sectionCode":"0101","courseName":"Synthetic","startTime":600,"endTime":720,"weekday":"Wednesday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"b-wed-next","courseCode":"MAT102H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":780,"endTime":840,"weekday":"Wednesday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"b-win-1","courseCode":"CSC101H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":540,"endTime":570,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false},
      {"id":"b-win-2","courseCode":"CSC102H5","activityType":"TUT","sectionCode":"0101","courseName":"Synthetic","startTime":600,"endTime":630,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false},
      {"id":"b-win-3","courseCode":"CSC103H5","activityType":"PRA","sectionCode":"0101","courseName":"Synthetic","startTime":660,"endTime":690,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false},
      {"id":"b-win-4","courseCode":"CSC104H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":720,"endTime":750,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false},
      {"id":"b-win-5","courseCode":"CSC105H5","activityType":"TUT","sectionCode":"0101","courseName":"Synthetic","startTime":780,"endTime":810,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Winter","locationUnknown":false}
    ]'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '[
      {"id":"c-mon-lec","courseCode":"CSC148H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":540,"endTime":600,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"c-mon-next","courseCode":"MAT102H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":720,"endTime":780,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false}
    ]'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '[
      {"id":"d-mon-lec","courseCode":"CSC108H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":540,"endTime":600,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false},
      {"id":"d-mon-next","courseCode":"MAT102H5","activityType":"LEC","sectionCode":"0101","courseName":"Synthetic","startTime":720,"endTime":780,"weekday":"Monday","buildingCode":"MN","room":"1000","term":"Fall","locationUnknown":false}
    ]'::jsonb
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
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'accepted',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'pending',
    now(),
    null,
    null
  );

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from public.user_schedules),
  1::bigint,
  'a direct schedule query returns only the caller row'
);
select is(
  (
    select count(*)
    from public.user_schedules
    where user_id = '00000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'a crafted direct query cannot read an accepted friend schedule'
);
select is(
  (select count(*) from public.friend_profiles),
  1::bigint,
  'direct profile reads expose only the caller row and never friend Auth UUIDs'
);
select is(
  (select count(*) from public.list_friend_connections()),
  2::bigint,
  'the connection RPC returns only the caller current relationships'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
select is(
  (select count(*) from public.get_friend_gap_overlaps('Fall')),
  0::bigint,
  'a pending friend receives no overlap result'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.get_friend_gap_overlaps('Fall')),
  2::bigint,
  'an explicitly mutual friend receives the bounded overlaps'
);
select results_eq(
  $$
    select start_minute, end_minute
    from public.get_friend_gap_overlaps('Fall')
    where weekday = 'Monday'
  $$,
  $$ values (630, 720) $$,
  'Monday exposes only the quantized mutual-free intersection'
);
select results_eq(
  $$
    select start_minute, end_minute
    from public.get_friend_gap_overlaps('Fall')
    where weekday = 'Wednesday'
  $$,
  $$ values (720, 780) $$,
  'a same-course LEC/TUT mismatch stays busy until both users are truly free'
);
select ok(
  (select count(*) = 3 from public.get_friend_gap_overlaps('Winter')),
  'four mutual windows are capped to exactly three results per friend and term'
);
select ok(
  (
    select bool_and(
      not (
        to_jsonb(overlap_row)
        ?| array[
          'friend_user_id',
          'user_id',
          'course_code',
          'activity_type',
          'section_code',
          'building_code',
          'room',
          'meetings'
        ]
      )
    )
    from public.get_friend_gap_overlaps('Fall') as overlap_row
  ),
  'the RPC payload contains no timetable or event fields'
);
select is(
  public.revoke_friendship('10000000-0000-0000-0000-000000000001'),
  true,
  'either accepted participant can revoke immediately'
);
select is(
  (select count(*) from public.get_friend_gap_overlaps('Fall')),
  0::bigint,
  'revocation immediately removes all overlap visibility'
);
select is(
  (
    select count(*)
    from public.list_friend_connections()
    where friendship_id = '10000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'revoked relationship history is hidden from former friends'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
select is(
  public.respond_to_friend_request(
    '10000000-0000-0000-0000-000000000002',
    false
  ),
  true,
  'the recipient can decline a pending request'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.list_friend_connections()),
  0::bigint,
  'declined request history is hidden from both participants'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select is(
  public.claim_friend_invite('not-a-real-code'),
  true,
  'invalid invite codes receive the same generic submission result'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
create temporary table captured_invite (invite_code text not null);
insert into captured_invite (invite_code)
select invite.invite_code from public.create_friend_invite() as invite;
select matches(
  (select invite_code from captured_invite),
  '^[0-9a-f]{48}$',
  'private invite codes contain 192 bits of random material'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select is(
  public.claim_friend_invite((select invite_code from captured_invite)),
  true,
  'claiming a valid code submits a request without exposing account lookup data'
);
select is(
  (
    select count(*)
    from public.list_friend_connections()
    where status = 'pending'
      and direction = 'outgoing'
  ),
  1::bigint,
  'claiming a code records only one-sided requester consent'
);
select is(
  (select count(*) from public.get_friend_gap_overlaps('Fall')),
  0::bigint,
  'one-sided invite consent never enables overlap'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
select is(
  public.respond_to_friend_request(
    (
      select friendship_id
      from public.list_friend_connections()
      where direction = 'incoming'
    ),
    true
  ),
  true,
  'the invite owner must explicitly accept the request'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select ok(
  (select count(*) > 0 from public.get_friend_gap_overlaps('Fall')),
  'overlap becomes available only after both users accept'
);
select is(
  public.revoke_friendship(
    (
      select friendship_id
      from public.list_friend_connections()
      where status = 'accepted'
    )
  ),
  true,
  'either participant can later remove the friendship'
);
select is(
  (select count(*) from public.get_friend_gap_overlaps('Fall')),
  0::bigint,
  'a removed friend cannot continue querying overlap'
);

reset role;

update public.user_schedules
set meetings = '[
  {"term":"Fall","weekday":"Monday","courseCode":"CSC148H5","activityType":"LEC","startTime":"invalid","endTime":660}
]'::jsonb
where user_id = '00000000-0000-0000-0000-000000000003';

select throws_like(
  $$
    select *
    from private.schedule_gap_windows(
      '00000000-0000-0000-0000-000000000003',
      'Fall'
    )
  $$,
  '%Persisted schedule data is invalid%',
  'an all-invalid persisted term fails closed instead of implying free time'
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
values (
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'accepted',
  now(),
  now(),
  now()
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
do $$
begin
  perform * from public.create_friend_invite();
end;
$$;
reset role;

select is(
  (
    select count(*)
    from private.friend_overlap_rate_limits
    where caller_id = '00000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'the deletion fixture contains private overlap rate-limit state before deletion'
);

delete from auth.users where id = '00000000-0000-0000-0000-000000000002';

select is(
  (
    select count(*)
    from public.friendships
    where '00000000-0000-0000-0000-000000000002' in (user_a_id, user_b_id)
  ),
  0::bigint,
  'account deletion removes every pending, accepted, and revoked relationship'
);
select is(
  (
    select count(*)
    from public.user_schedules
    where user_id = '00000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'account deletion cascades through the full normalized schedule'
);
select is(
  (
    select count(*)
    from public.friend_profiles
    where user_id = '00000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'account deletion removes the friend-list profile'
);
select is(
  (
    select count(*)
    from public.friend_invites
    where owner_id = '00000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'account deletion removes every private invite code'
);
select is(
  (
    select count(*)
    from private.friend_overlap_rate_limits
    where caller_id = '00000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'account deletion removes private overlap rate-limit state'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.list_friend_connections()),
  0::bigint,
  'former friends see no relationship trace after account deletion'
);

reset role;

select * from finish();
rollback;

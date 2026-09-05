begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

select has_table('private', 'campus_crowd_reports', 'crowd reports are private');
select has_table('private', 'campus_publishers', 'publisher authority is private');
select has_table('private', 'campus_publisher_audit', 'publisher audit is private');
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'private.campus_crowd_reports'::regclass),
  'crowd reports use forced RLS'
);
select is(has_table_privilege('authenticated', 'private.campus_crowd_reports', 'select'), false,
  'clients cannot read reporter identities');
select is(has_table_privilege('authenticated', 'private.campus_publishers', 'insert'), false,
  'clients cannot create publisher authority');
select is(has_table_privilege('authenticated', 'public.campus_publisher_state', 'insert'), false,
  'publishers cannot bypass the scoped RPC');
select is(has_function_privilege('anon', 'public.submit_campus_crowd_report(text,public.campus_crowd_level)', 'execute'), false,
  'anonymous crowd reports are rejected');
select ok(has_function_privilege('authenticated', 'public.submit_campus_crowd_report(text,public.campus_crowd_level)', 'execute'),
  'authenticated users can submit coarse reports');

insert into auth.users (id, email) values
  ('70000000-0000-4000-8000-000000000001', 'reporter-a@example.test'),
  ('70000000-0000-4000-8000-000000000002', 'reporter-b@example.test'),
  ('70000000-0000-4000-8000-000000000003', 'publisher@example.test'),
  ('70000000-0000-4000-8000-000000000004', 'outsider@example.test');

set local role authenticated;
set local "request.jwt.claim.sub" = '70000000-0000-4000-8000-000000000001';
select lives_ok($$ select public.submit_campus_crowd_report('davis-study', 'quiet') $$,
  'an authenticated user can report a coarse state');
select is((select confidence from public.get_campus_crowd_state('davis-study')), 'unknown',
  'one report remains unknown rather than fake consensus');
select throws_like($$ select public.submit_campus_crowd_report('../bad', 'busy') $$, '%Invalid place%',
  'invalid place identifiers are rejected');

set local "request.jwt.claim.sub" = '70000000-0000-4000-8000-000000000002';
select lives_ok($$ select public.submit_campus_crowd_report('davis-study', 'seats_available') $$,
  'a second reporter can contribute');
select is((select sample_size from public.get_campus_crowd_state('davis-study')), 2,
  'aggregate exposes only a sample count');
select is((select level::text from public.get_campus_crowd_state('davis-study')), 'seats_available',
  'aggregate deterministically rounds the coarse mean');

reset role;
insert into private.campus_publishers (id, user_id, display_name, verified_by_gapwise) values
  ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000003', 'Test Library', false);
insert into private.campus_publisher_scopes (publisher_id, entity_kind, entity_id) values
  ('71000000-0000-4000-8000-000000000001', 'place', 'library');

set local role authenticated;
set local "request.jwt.claim.sub" = '70000000-0000-4000-8000-000000000004';
select throws_like(
  $$ select public.publish_campus_state('place', 'library', '{"status":"open"}', now() + interval '1 hour') $$,
  '%Publisher authorization required%', 'ordinary users cannot publish');

set local "request.jwt.claim.sub" = '70000000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.publish_campus_state('facility', 'library', '{"status":"open"}', now() + interval '1 hour') $$,
  '%scope does not allow%', 'publisher category scope is enforced');
select throws_like(
  $$ select public.publish_campus_state('place', 'library', '{"official":true}', now() + interval '1 hour') $$,
  '%campus_publisher_state_payload%', 'publisher payload cannot claim official status');
select lives_ok(
  $$ select public.publish_campus_state('place', 'library', '{"status":"open"}', now() + interval '1 hour') $$,
  'scoped publisher may write the assigned entity');
select is((select count(*) from public.get_published_campus_state('place', 'library')), 1::bigint,
  'public projection returns current publisher state');

reset role;
select * from finish();
rollback;

begin;
select plan(4);

select has_table('public', 'user_onboarding', 'onboarding table exists');
select has_trigger(
  'auth',
  'users',
  'initialize_gapwise_user_onboarding',
  'new auth users receive onboarding state'
);
select policies_are(
  'public',
  'user_onboarding',
  array['users read own onboarding', 'users update own onboarding'],
  'onboarding is own-row only'
);
select table_privs_are(
  'public',
  'user_onboarding',
  'authenticated',
  array['SELECT', 'UPDATE'],
  'authenticated users have only the required onboarding privileges'
);

select * from finish();
rollback;

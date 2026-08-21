begin;
select plan(10);

select has_table('public', 'stripe_checkout_sessions', 'checkout ledger exists');
select has_table('public', 'stripe_webhook_events', 'webhook ledger exists');
select table_privs_are(
  'public',
  'stripe_checkout_sessions',
  'service_role',
  array['SELECT', 'INSERT', 'UPDATE'],
  'service_role has only required checkout-ledger privileges'
);
select table_privs_are(
  'public',
  'stripe_webhook_events',
  'service_role',
  array['SELECT', 'INSERT', 'UPDATE'],
  'service_role has only required webhook-ledger privileges'
);
select table_privs_are(
  'public',
  'stripe_checkout_sessions',
  'anon',
  array[]::text[],
  'anon cannot access the checkout ledger'
);
select table_privs_are(
  'public',
  'stripe_checkout_sessions',
  'authenticated',
  array[]::text[],
  'authenticated cannot access the checkout ledger'
);
select table_privs_are(
  'public',
  'stripe_webhook_events',
  'anon',
  array[]::text[],
  'anon cannot access the webhook ledger'
);
select table_privs_are(
  'public',
  'stripe_webhook_events',
  'authenticated',
  array[]::text[],
  'authenticated cannot access the webhook ledger'
);
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

select * from finish();
rollback;

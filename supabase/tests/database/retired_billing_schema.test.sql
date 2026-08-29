begin;
select plan(3);

select hasnt_table(
  'public',
  'user_entitlements',
  'retired entitlement table stays absent from the current schema'
);
select hasnt_table(
  'public',
  'stripe_checkout_sessions',
  'retired Stripe checkout ledger stays absent from the current schema'
);
select hasnt_table(
  'public',
  'stripe_webhook_events',
  'retired Stripe webhook ledger stays absent from the current schema'
);

select * from finish();
rollback;

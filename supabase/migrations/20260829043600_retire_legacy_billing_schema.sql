-- Gapwise is fully free. Billing-era entitlement and Stripe ledger objects are
-- no longer used by any runtime path. Production already has no Stripe ledger
-- tables and the remaining entitlement table contains no rows, but fresh
-- migration replays must reach the same fully-free schema.
--
-- Keep historical migrations intact and retire their live objects through this
-- forward migration. Intentionally do not use CASCADE: if a future or divergent
-- environment introduced an unexpected dependency, fail closed for explicit
-- review instead of deleting that dependency implicitly.

drop table if exists public.stripe_checkout_sessions;
drop table if exists public.stripe_webhook_events;
drop table if exists public.user_entitlements;

-- Gapwise is fully free. The billing-era entitlement table is no longer used by
-- any runtime path and production contains no rows. Keep historical migrations
-- intact, but retire the live schema object through a forward migration.
-- This changes only the current schema; it does not rewrite migration history.
--
-- Intentionally do not use CASCADE: if a future or divergent environment has
-- introduced a dependency, fail closed and require an explicit review instead
-- of deleting that dependency implicitly.

drop table if exists public.user_entitlements;

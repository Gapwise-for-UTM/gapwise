-- Gapwise is fully free. Billing-era entitlement and Stripe ledger objects are
-- no longer used by any runtime path. Production already has no Stripe ledger
-- tables and the remaining entitlement table contains no rows; this migration
-- makes a clean replay of historical migrations converge on that current schema.
--
-- Some production environments predate the historical mixed onboarding/billing
-- migration. Preserve the still-required account onboarding state here without
-- recreating any retired payment objects. All statements are safe to replay.

create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;
alter table public.user_onboarding force row level security;
revoke all on public.user_onboarding from anon, authenticated;
grant select, update on public.user_onboarding to authenticated;

drop policy if exists "users read own onboarding" on public.user_onboarding;
create policy "users read own onboarding" on public.user_onboarding
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users update own onboarding" on public.user_onboarding;
create policy "users update own onboarding" on public.user_onboarding
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.initialize_gapwise_user_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_onboarding (user_id, completed_at)
  values (new.id, null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.initialize_gapwise_user_onboarding() from public, anon, authenticated;

drop trigger if exists initialize_gapwise_user_onboarding on auth.users;
create trigger initialize_gapwise_user_onboarding
after insert on auth.users
for each row execute function public.initialize_gapwise_user_onboarding();

-- Existing accounts predate this onboarding state in environments where the
-- historical mixed migration never ran. Backfill them complete so they are not
-- mistaken for brand-new accounts; concurrent signups remain pending via the
-- trigger and ON CONFLICT preserves that state.
insert into public.user_onboarding (user_id, completed_at)
select id, now()
from auth.users
on conflict (user_id) do nothing;

comment on table public.user_onboarding is
  'Non-sensitive account-first-run state. Existing accounts are backfilled complete; new auth users begin pending.';

-- Keep historical migrations intact and retire their live payment objects through
-- this forward migration. Intentionally do not use CASCADE: if a future or
-- divergent environment introduced an unexpected dependency, fail closed for
-- explicit review instead of deleting that dependency implicitly.
drop table if exists public.stripe_checkout_sessions;
drop table if exists public.stripe_webhook_events;
drop table if exists public.user_entitlements;

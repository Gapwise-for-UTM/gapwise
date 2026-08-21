create table public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;
alter table public.user_onboarding force row level security;
revoke all on public.user_onboarding from anon, authenticated;
grant select, update on public.user_onboarding to authenticated;

create policy "users read own onboarding" on public.user_onboarding
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users update own onboarding" on public.user_onboarding
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Existing accounts predate account onboarding and must never be mistaken for
-- newly-created users on another device.
insert into public.user_onboarding (user_id, completed_at)
select id, now()
from auth.users
on conflict (user_id) do nothing;

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

create table public.stripe_checkout_sessions (
  session_id text primary key check (length(session_id) between 8 and 255),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null check (length(term) between 1 and 32),
  amount_total integer not null check (amount_total > 0),
  currency text not null check (currency = lower(currency) and length(currency) = 3),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'failed', 'refunded', 'disputed')),
  checkout_url text not null check (length(checkout_url) between 8 and 2048),
  expires_at timestamptz not null,
  entitlement_expires_at timestamptz not null,
  payment_intent_id text unique,
  customer_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stripe_checkout_sessions_user_term_status_idx
  on public.stripe_checkout_sessions (user_id, term, status, created_at desc);
create index stripe_checkout_sessions_payment_intent_idx
  on public.stripe_checkout_sessions (payment_intent_id)
  where payment_intent_id is not null;

alter table public.stripe_checkout_sessions enable row level security;
alter table public.stripe_checkout_sessions force row level security;
revoke all on public.stripe_checkout_sessions from anon, authenticated;

create table public.stripe_webhook_events (
  event_id text primary key check (length(event_id) between 8 and 255),
  event_type text not null check (length(event_type) between 1 and 128),
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;

comment on table public.user_onboarding is
  'Non-sensitive account-first-run state. Existing accounts are backfilled complete; new auth users begin pending.';
comment on table public.stripe_checkout_sessions is
  'Server-only Stripe Checkout ledger used to bind paid sessions to authenticated Gapwise users and terms.';
comment on table public.stripe_webhook_events is
  'Server-only idempotency ledger for verified Stripe webhook event IDs; event payloads are not stored.';

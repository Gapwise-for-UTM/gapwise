create table public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('pro', 'founder')),
  source text not null default 'admin' check (length(source) between 1 and 64),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_never_expires check (tier <> 'founder' or expires_at is null)
);
alter table public.user_entitlements enable row level security;
alter table public.user_entitlements force row level security;
revoke all on public.user_entitlements from anon, authenticated;
grant select on public.user_entitlements to authenticated;
create policy "users read own entitlement" on public.user_entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

comment on table public.user_entitlements is
  'Trusted Gapwise access state. Absence means free; writes are service/admin only.';

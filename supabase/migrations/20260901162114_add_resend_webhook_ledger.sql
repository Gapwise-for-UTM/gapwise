create table if not exists public.resend_webhook_events (
  svix_id text primary key check (length(svix_id) between 8 and 255),
  event_type text not null check (length(event_type) between 3 and 120),
  resend_email_id text check (resend_email_id is null or length(resend_email_id) between 1 and 255),
  template_id text check (template_id is null or length(template_id) between 1 and 255),
  category text check (category is null or length(category) between 1 and 120),
  event_created_at timestamptz,
  received_at timestamptz not null default now()
);

create index if not exists resend_webhook_events_event_created_at_idx
  on public.resend_webhook_events (event_created_at desc nulls last);

alter table public.resend_webhook_events enable row level security;
alter table public.resend_webhook_events force row level security;

revoke all on table public.resend_webhook_events from anon, authenticated;
grant select, insert on table public.resend_webhook_events to service_role;

create or replace function public.get_resend_webhook_signing_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'resend_webhook_signing_secret'
  order by created_at desc
  limit 1;
$$;

revoke all on function public.get_resend_webhook_signing_secret() from public, anon, authenticated;
grant execute on function public.get_resend_webhook_signing_secret() to service_role;

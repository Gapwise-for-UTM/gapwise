create table if not exists public.resend_email_messages (
  resend_email_id text primary key check (length(resend_email_id) between 1 and 255),
  direction text not null check (direction in ('inbound', 'outbound')),
  message_id text check (message_id is null or length(message_id) between 1 and 998),
  from_address text check (from_address is null or length(from_address) between 1 and 998),
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  subject text check (subject is null or length(subject) <= 998),
  mailbox text check (mailbox is null or mailbox in ('support', 'security', 'hello', 'general', 'test', 'other')),
  template_id text check (template_id is null or length(template_id) between 1 and 255),
  category text check (category is null or length(category) between 1 and 120),
  attachment_metadata jsonb not null default '[]'::jsonb,
  text_body text,
  html_body text,
  headers jsonb,
  content_fetched_at timestamptz,
  latest_event_type text not null check (length(latest_event_type) between 3 and 120),
  event_created_at timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resend_email_messages_direction_updated_at_idx
  on public.resend_email_messages (direction, updated_at desc);

create index if not exists resend_email_messages_mailbox_updated_at_idx
  on public.resend_email_messages (mailbox, updated_at desc)
  where mailbox is not null;

create index if not exists resend_email_messages_message_id_idx
  on public.resend_email_messages (message_id)
  where message_id is not null;

alter table public.resend_email_messages enable row level security;
alter table public.resend_email_messages force row level security;

revoke all on table public.resend_email_messages from anon, authenticated;
grant select, insert, update on table public.resend_email_messages to service_role;

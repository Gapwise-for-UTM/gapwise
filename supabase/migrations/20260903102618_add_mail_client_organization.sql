create table if not exists public.mail_thread_state (
  thread_id text primary key,
  folder text not null default 'inbox' check (folder in ('inbox', 'archive', 'trash')),
  is_read boolean not null default false,
  starred boolean not null default false,
  labels text[] not null default '{}',
  snoozed_until timestamptz,
  trashed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists mail_thread_state_folder_idx on public.mail_thread_state (folder, updated_at desc);
create index if not exists mail_thread_state_starred_idx on public.mail_thread_state (starred, updated_at desc) where starred;
alter table public.mail_thread_state enable row level security;
alter table public.mail_thread_state force row level security;
revoke all on public.mail_thread_state from anon, authenticated;
grant select, insert, update, delete on public.mail_thread_state to service_role;
create table if not exists public.mail_drafts (
  id uuid primary key default gen_random_uuid(),
  mailbox text not null check (mailbox in ('support', 'security', 'hello', 'general', 'test')),
  thread_id text,
  recipient text,
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists mail_drafts_thread_unique_idx on public.mail_drafts (thread_id) where thread_id is not null;
create index if not exists mail_drafts_mailbox_updated_idx on public.mail_drafts (mailbox, updated_at desc);
alter table public.mail_drafts enable row level security;
alter table public.mail_drafts force row level security;
revoke all on public.mail_drafts from anon, authenticated;
grant select, insert, update, delete on public.mail_drafts to service_role;

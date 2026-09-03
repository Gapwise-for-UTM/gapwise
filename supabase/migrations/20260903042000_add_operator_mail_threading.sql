create table if not exists public.email_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.email_operators enable row level security;
alter table public.email_operators force row level security;
revoke all on table public.email_operators from anon, authenticated;
grant select, insert, update, delete on table public.email_operators to service_role;

alter table public.resend_email_messages
  add column if not exists thread_id uuid,
  add column if not exists in_reply_to text,
  add column if not exists reference_message_ids text[] not null default '{}',
  add column if not exists reply_to_address text;

update public.resend_email_messages
set thread_id = gen_random_uuid()
where thread_id is null;

alter table public.resend_email_messages
  alter column thread_id set default gen_random_uuid(),
  alter column thread_id set not null;

create index if not exists resend_email_messages_thread_updated_at_idx
  on public.resend_email_messages (thread_id, updated_at asc);

create index if not exists resend_email_messages_in_reply_to_idx
  on public.resend_email_messages (in_reply_to)
  where in_reply_to is not null;

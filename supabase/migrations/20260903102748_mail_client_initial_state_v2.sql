insert into public.mail_thread_state (thread_id, folder, is_read, starred, labels, updated_at)
select distinct thread_id, 'inbox', false, false, '{}'::text[], now()
from public.resend_email_messages
where thread_id is not null
on conflict (thread_id) do nothing;

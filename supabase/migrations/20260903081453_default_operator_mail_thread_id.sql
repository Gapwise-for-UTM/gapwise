alter table public.resend_email_messages alter column thread_id set default gen_random_uuid();

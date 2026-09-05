begin;

alter table public.resend_email_messages
  drop constraint if exists resend_email_messages_mailbox_check;

alter table public.resend_email_messages
  add constraint resend_email_messages_mailbox_check
  check (mailbox is null or mailbox in ('support', 'security', 'hello', 'general', 'dmarc', 'test', 'other'));

alter table public.mail_drafts
  drop constraint if exists mail_drafts_mailbox_check;

alter table public.mail_drafts
  add constraint mail_drafts_mailbox_check
  check (mailbox in ('support', 'security', 'hello', 'general', 'dmarc', 'test'));

commit;

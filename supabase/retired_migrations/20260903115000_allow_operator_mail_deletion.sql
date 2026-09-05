-- Allow the private operator mail service to permanently remove messages.
-- The mail-organizer Edge Function authorizes the operator before using the
-- service-role client, but the original message-ledger migration omitted DELETE.

grant delete on table public.resend_email_messages to service_role;

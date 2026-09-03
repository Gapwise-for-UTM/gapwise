-- Make service-only table boundaries explicit without weakening RLS.
-- These tables are written/read only through trusted service-role paths. Client
-- roles remain denied; the explicit policies also document that intent for the
-- Supabase security advisor.

create policy "deny client access"
  on private.friend_capsule_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "deny client access"
  on private.friend_overlap_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "deny client access"
  on public.email_operators
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "deny client access"
  on public.mail_drafts
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "deny client access"
  on public.mail_thread_state
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "deny client access"
  on public.resend_email_messages
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "deny client access"
  on public.resend_webhook_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

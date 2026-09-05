-- Reconcile the operator-mail DELETE privilege through forward migration history.
-- Production already has this privilege even though the older local-only
-- 20260903115000 migration was never recorded there. GRANT is idempotent, so
-- this safely converges clean replays and production without rewriting history.

grant delete on table public.resend_email_messages to service_role;

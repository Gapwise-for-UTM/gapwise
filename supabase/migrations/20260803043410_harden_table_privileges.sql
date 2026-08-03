-- Supabase's default table grants include privileges the browser client does
-- not need. RLS protects row operations, but least privilege also removes
-- table-wide TRUNCATE, REFERENCES, and TRIGGER capabilities.
--
-- Recovery: grant the removed privilege explicitly to the intended role only
-- if a future trusted server-side workflow demonstrates that it needs one.

revoke all on table public.user_schedules from anon, authenticated;
revoke all on table public.user_preferences from anon, authenticated;

grant select, insert, update, delete on table public.user_schedules to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;

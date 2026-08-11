-- This additive rollback intentionally leaves every legacy plaintext table and
-- function untouched. Run only before encrypted storage becomes authoritative.
-- WARNING: this permanently deletes all encrypted records and key envelopes.

begin;

drop function if exists public.get_friend_capsule_material(uuid, text);
drop trigger if exists encrypted_friend_availability_revision_guard
  on public.encrypted_friend_availability;
drop trigger if exists encrypted_private_data_revision_guard
  on public.encrypted_private_data;
drop function if exists private.enforce_encrypted_record_update();
drop table if exists private.friend_capsule_rate_limits;
drop table if exists public.encrypted_friend_availability;
drop table if exists public.encrypted_private_data;
drop table if exists public.crypto_key_envelopes;

alter table public.user_schedules no force row level security;
alter table public.user_preferences no force row level security;

commit;

begin;

-- Gate 6 is intentionally fail-closed. A legacy owner may be retired only when the
-- encrypted private record, wrapped keys, and encrypted friend-availability capsule
-- all exist for the same auth user. The migration never needs or receives the KEK.
do $$
begin
  if exists (
    select 1
    from public.user_schedules as legacy
    left join public.encrypted_private_data as private_data
      on private_data.user_id = legacy.user_id
    left join public.crypto_key_envelopes as envelope
      on envelope.user_id = legacy.user_id
    left join public.encrypted_friend_availability as availability
      on availability.user_id = legacy.user_id
    where private_data.user_id is null
       or envelope.user_id is null
       or availability.user_id is null
  ) then
    raise exception 'Gate 6 refused: a legacy schedule owner lacks a complete encrypted replacement.';
  end if;

  if exists (
    select 1
    from public.user_preferences as legacy
    left join public.encrypted_private_data as private_data
      on private_data.user_id = legacy.user_id
    left join public.crypto_key_envelopes as envelope
      on envelope.user_id = legacy.user_id
    where private_data.user_id is null
       or envelope.user_id is null
  ) then
    raise exception 'Gate 6 refused: a legacy preference owner lacks an encrypted replacement.';
  end if;
end
$$;

-- The encrypted availability path superseded the legacy security-definer overlap
-- implementation. Drop the public entry point before removing its plaintext source.
drop function if exists public.get_friend_gap_overlaps(text);
drop function if exists private.schedule_gap_windows(uuid, text);
drop function if exists private.is_valid_schedule_meeting(jsonb, text);

-- These tables contain the final plaintext rollback copies. Their encrypted
-- replacements were verified before authoritative cutover and are rechecked above.
drop table public.user_preferences;
drop table public.user_schedules;

commit;

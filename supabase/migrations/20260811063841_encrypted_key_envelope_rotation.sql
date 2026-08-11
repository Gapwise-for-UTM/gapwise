-- The authenticated browser role still has no table UPDATE privilege. This
-- function changes only the caller's wrapped-key bytes after an optimistic
-- KEK-version comparison, which is the narrow operation the Vercel broker needs
-- for rotation. The broker verifies the new wraps cryptographically first.
create or replace function public.rotate_own_key_envelope(
  p_expected_kek_version integer,
  p_new_kek_version integer,
  p_private_data_wrapped_dek bytea,
  p_private_data_wrap_nonce bytea,
  p_friend_availability_wrapped_dek bytea,
  p_friend_availability_wrap_nonce bytea
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  changed_rows integer;
begin
  if caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_expected_kek_version is null
    or p_new_kek_version is null
    or p_expected_kek_version < 1
    or p_new_kek_version <= p_expected_kek_version
  then
    raise exception 'Invalid KEK rotation version.' using errcode = '22023';
  end if;

  if octet_length(p_private_data_wrapped_dek) <> 48
    or octet_length(p_private_data_wrap_nonce) <> 12
    or octet_length(p_friend_availability_wrapped_dek) <> 48
    or octet_length(p_friend_availability_wrap_nonce) <> 12
  then
    raise exception 'Invalid wrapped key material.' using errcode = '22023';
  end if;

  update public.crypto_key_envelopes
  set private_data_wrapped_dek = p_private_data_wrapped_dek,
      private_data_wrap_nonce = p_private_data_wrap_nonce,
      friend_availability_wrapped_dek = p_friend_availability_wrapped_dek,
      friend_availability_wrap_nonce = p_friend_availability_wrap_nonce,
      kek_version = p_new_kek_version,
      updated_at = now()
  where user_id = caller
    and kek_version = p_expected_kek_version;

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

revoke all on function public.rotate_own_key_envelope(
  integer,
  integer,
  bytea,
  bytea,
  bytea,
  bytea
) from public, anon, authenticated;
grant execute on function public.rotate_own_key_envelope(
  integer,
  integer,
  bytea,
  bytea,
  bytea,
  bytea
) to authenticated;

comment on function public.rotate_own_key_envelope(
  integer,
  integer,
  bytea,
  bytea,
  bytea,
  bytea
) is
  'Compare-and-swaps only the authenticated caller key wraps to a higher KEK version.';

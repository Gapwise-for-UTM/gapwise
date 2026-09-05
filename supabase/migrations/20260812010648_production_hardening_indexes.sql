-- Cover foreign keys used by encrypted-row integrity checks and account-deletion cascades.
-- These indexes are additive and contain only opaque identifiers/UUIDs.

create index if not exists encrypted_private_data_context_idx
  on public.encrypted_private_data (user_id, subject_id, key_id);

create index if not exists encrypted_friend_availability_context_idx
  on public.encrypted_friend_availability (user_id, subject_id, key_id);

create index if not exists friendships_revoked_by_idx
  on public.friendships (revoked_by);

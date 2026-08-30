-- PRIVATE_DATA_SCHEMA_VERSION is now 2 because encrypted private state includes
-- academic planning data. Keep schema version 1 readable for existing ciphertext:
-- schema_version participates in AEAD associated data, so old rows must not be
-- rewritten in place.

alter table public.encrypted_private_data
  drop constraint if exists encrypted_private_data_schema_version;

alter table public.encrypted_private_data
  add constraint encrypted_private_data_schema_version
  check (schema_version in (1, 2));

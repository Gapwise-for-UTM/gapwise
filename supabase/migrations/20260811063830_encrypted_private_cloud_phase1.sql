-- Phase 1 is additive. Legacy plaintext schedule/preference storage remains in
-- place until every encrypted row has been migrated and independently verified.
-- The Vercel KEK never enters this database.

create table public.crypto_key_envelopes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subject_id uuid not null default gen_random_uuid() unique,
  private_data_key_id uuid not null default gen_random_uuid() unique,
  private_data_wrapped_dek bytea not null,
  private_data_wrap_nonce bytea not null,
  friend_availability_key_id uuid not null default gen_random_uuid() unique,
  friend_availability_wrapped_dek bytea not null,
  friend_availability_wrap_nonce bytea not null,
  crypto_version smallint not null default 1,
  key_version smallint not null default 1,
  kek_version integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_key_envelopes_private_wrap_size
    check (octet_length(private_data_wrapped_dek) = 48),
  constraint crypto_key_envelopes_private_nonce_size
    check (octet_length(private_data_wrap_nonce) = 12),
  constraint crypto_key_envelopes_availability_wrap_size
    check (octet_length(friend_availability_wrapped_dek) = 48),
  constraint crypto_key_envelopes_availability_nonce_size
    check (octet_length(friend_availability_wrap_nonce) = 12),
  constraint crypto_key_envelopes_crypto_version check (crypto_version = 1),
  constraint crypto_key_envelopes_key_version check (key_version = 1),
  constraint crypto_key_envelopes_kek_version check (kek_version >= 1),
  constraint crypto_key_envelopes_private_context
    unique (user_id, subject_id, private_data_key_id),
  constraint crypto_key_envelopes_availability_context
    unique (user_id, subject_id, friend_availability_key_id)
);

create table public.encrypted_private_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subject_id uuid not null,
  record_id uuid not null default gen_random_uuid() unique,
  key_id uuid not null,
  ciphertext bytea not null,
  nonce bytea not null,
  crypto_version smallint not null default 1,
  schema_version smallint not null default 1,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint encrypted_private_data_context_fkey
    foreign key (user_id, subject_id, key_id)
    references public.crypto_key_envelopes (user_id, subject_id, private_data_key_id)
    on delete cascade,
  constraint encrypted_private_data_ciphertext_size
    check (octet_length(ciphertext) between 16 and 262160),
  constraint encrypted_private_data_nonce_size check (octet_length(nonce) = 12),
  constraint encrypted_private_data_crypto_version check (crypto_version = 1),
  constraint encrypted_private_data_schema_version check (schema_version = 1),
  constraint encrypted_private_data_revision check (revision >= 1)
);

create table public.encrypted_friend_availability (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subject_id uuid not null,
  capsule_id uuid not null default gen_random_uuid() unique,
  key_id uuid not null,
  ciphertext bytea not null,
  nonce bytea not null,
  crypto_version smallint not null default 1,
  schema_version smallint not null default 1,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint encrypted_friend_availability_context_fkey
    foreign key (user_id, subject_id, key_id)
    references public.crypto_key_envelopes (user_id, subject_id, friend_availability_key_id)
    on delete cascade,
  constraint encrypted_friend_availability_ciphertext_size
    check (octet_length(ciphertext) between 16 and 8208),
  constraint encrypted_friend_availability_nonce_size check (octet_length(nonce) = 12),
  constraint encrypted_friend_availability_crypto_version check (crypto_version = 1),
  constraint encrypted_friend_availability_schema_version check (schema_version = 1),
  constraint encrypted_friend_availability_revision check (revision >= 1)
);

-- Only an aggregate caller counter is retained. No friendship ID, target ID,
-- query history, term, or result is stored.
create table private.friend_capsule_rate_limits (
  caller_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  constraint friend_capsule_rate_limits_request_count check (request_count > 0)
);

alter table public.crypto_key_envelopes enable row level security;
alter table public.crypto_key_envelopes force row level security;
alter table public.encrypted_private_data enable row level security;
alter table public.encrypted_private_data force row level security;
alter table public.encrypted_friend_availability enable row level security;
alter table public.encrypted_friend_availability force row level security;
alter table private.friend_capsule_rate_limits enable row level security;
alter table private.friend_capsule_rate_limits force row level security;

-- Existing owner-only tables are also forced as defense in depth. This does not
-- broaden access and remains compatible with their existing policies.
alter table public.user_schedules force row level security;
alter table public.user_preferences force row level security;

create policy "crypto_key_envelopes_select_own"
  on public.crypto_key_envelopes
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "crypto_key_envelopes_insert_own"
  on public.crypto_key_envelopes
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "encrypted_private_data_select_own"
  on public.encrypted_private_data
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "encrypted_private_data_insert_own"
  on public.encrypted_private_data
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "encrypted_private_data_update_own"
  on public.encrypted_private_data
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "encrypted_private_data_delete_own"
  on public.encrypted_private_data
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "encrypted_friend_availability_select_own"
  on public.encrypted_friend_availability
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "encrypted_friend_availability_insert_own"
  on public.encrypted_friend_availability
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "encrypted_friend_availability_update_own"
  on public.encrypted_friend_availability
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "encrypted_friend_availability_delete_own"
  on public.encrypted_friend_availability
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- The immutable context and exact +1 revision rule prevent stale clients from
-- silently overwriting a newer ciphertext, even if they bypass application UI.
create or replace function private.enforce_encrypted_record_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.subject_id is distinct from old.subject_id
    or new.key_id is distinct from old.key_id
    or new.crypto_version is distinct from old.crypto_version
    or new.schema_version is distinct from old.schema_version
  then
    raise exception 'Encrypted record context is immutable.' using errcode = '22023';
  end if;

  if tg_table_name = 'encrypted_private_data' then
    if new.record_id is distinct from old.record_id then
      raise exception 'Encrypted record context is immutable.' using errcode = '22023';
    end if;
  elsif tg_table_name = 'encrypted_friend_availability' then
    if new.capsule_id is distinct from old.capsule_id then
      raise exception 'Encrypted record context is immutable.' using errcode = '22023';
    end if;
  else
    raise exception 'Unexpected encrypted record table.' using errcode = '22023';
  end if;

  if new.revision <> old.revision + 1 then
    raise exception 'Encrypted record revision conflict.' using errcode = '40001';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger encrypted_private_data_revision_guard
before update on public.encrypted_private_data
for each row execute function private.enforce_encrypted_record_update();

create trigger encrypted_friend_availability_revision_guard
before update on public.encrypted_friend_availability
for each row execute function private.enforce_encrypted_record_update();

-- The browser can call this RPC directly, but receives only ciphertext and
-- KEK-wrapped availability keys. Without the Vercel KEK the output is not
-- decryptable. Auth UUIDs and private schedule material are never returned.
create or replace function public.get_friend_capsule_material(
  p_friendship_id uuid,
  p_term text
)
returns table (
  participant text,
  subject_id uuid,
  key_id uuid,
  wrapped_dek bytea,
  wrap_nonce bytea,
  kek_version integer,
  key_version smallint,
  crypto_version smallint,
  capsule_id uuid,
  capsule_ciphertext bytea,
  capsule_nonce bytea,
  capsule_schema_version smallint,
  capsule_revision bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  relationship public.friendships%rowtype;
  requests_in_window integer;
begin
  if caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_term not in ('Fall', 'Winter', 'Summer') then
    raise exception 'Unsupported term.' using errcode = '22023';
  end if;

  insert into private.friend_capsule_rate_limits as rate_limit (
    caller_id,
    window_started_at,
    request_count
  )
  values (caller, now(), 1)
  on conflict (caller_id) do update
    set window_started_at = case
          when rate_limit.window_started_at <= now() - interval '1 hour' then now()
          else rate_limit.window_started_at
        end,
        request_count = case
          when rate_limit.window_started_at <= now() - interval '1 hour' then 1
          else rate_limit.request_count + 1
        end
  returning request_count into requests_in_window;

  if requests_in_window > 30 then
    raise exception 'Common-gap lookup temporarily unavailable.' using errcode = 'P0001';
  end if;

  select friendship.*
    into relationship
  from public.friendships as friendship
  where friendship.id = p_friendship_id
    and caller in (friendship.user_a_id, friendship.user_b_id)
  for share;

  if not found
    or relationship.status <> 'accepted'
    or relationship.requester_accepted_at is null
    or relationship.recipient_accepted_at is null
    or relationship.accepted_at is null
    or relationship.revoked_at is not null
  then
    return;
  end if;

  return query
  with participants(label, user_id, sort_order) as (
    values
      ('caller'::text, caller, 1),
      (
        'friend'::text,
        case
          when relationship.user_a_id = caller then relationship.user_b_id
          else relationship.user_a_id
        end,
        2
      )
  ),
  material as (
    select
      party.label,
      envelope.subject_id,
      envelope.friend_availability_key_id,
      envelope.friend_availability_wrapped_dek,
      envelope.friend_availability_wrap_nonce,
      envelope.kek_version,
      envelope.key_version,
      envelope.crypto_version,
      capsule.capsule_id,
      capsule.ciphertext,
      capsule.nonce,
      capsule.schema_version,
      capsule.revision,
      party.sort_order
    from participants as party
    join public.crypto_key_envelopes as envelope on envelope.user_id = party.user_id
    join public.encrypted_friend_availability as capsule
      on capsule.user_id = party.user_id
      and capsule.subject_id = envelope.subject_id
      and capsule.key_id = envelope.friend_availability_key_id
  )
  select
    material.label,
    material.subject_id,
    material.friend_availability_key_id,
    material.friend_availability_wrapped_dek,
    material.friend_availability_wrap_nonce,
    material.kek_version,
    material.key_version,
    material.crypto_version,
    material.capsule_id,
    material.ciphertext,
    material.nonce,
    material.schema_version,
    material.revision
  from material
  where (select count(*) from material) = 2
  order by material.sort_order;
end;
$$;

revoke all on table public.crypto_key_envelopes from public, anon, authenticated;
revoke all on table public.encrypted_private_data from public, anon, authenticated;
revoke all on table public.encrypted_friend_availability from public, anon, authenticated;
revoke all on table private.friend_capsule_rate_limits from public, anon, authenticated;

grant select, insert on table public.crypto_key_envelopes to authenticated;
grant select, insert, update, delete on table public.encrypted_private_data to authenticated;
grant select, insert, update, delete on table public.encrypted_friend_availability to authenticated;

revoke all on function private.enforce_encrypted_record_update()
  from public, anon, authenticated;
revoke all on function public.get_friend_capsule_material(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_friend_capsule_material(uuid, text) to authenticated;

comment on table public.crypto_key_envelopes is
  'Per-user private-data and availability DEKs wrapped by a Vercel-held versioned KEK.';
comment on table public.encrypted_private_data is
  'One current application-encrypted private payload per user; no plaintext fallback.';
comment on table public.encrypted_friend_availability is
  'One current encrypted, bounded, deliberately lossy availability capsule per user.';
comment on function public.get_friend_capsule_material(uuid, text) is
  'Returns only two encrypted capsules and KEK-wrapped availability DEKs after mutual-friend authorization.';

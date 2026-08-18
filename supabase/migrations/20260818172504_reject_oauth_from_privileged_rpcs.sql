create or replace function public.create_friend_invite()
returns table(invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  token text;
  expiry timestamptz := now() + interval '24 hours';
begin
  if not private.is_direct_user_session() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.friend_invites as invite (owner_id, token_hash, expires_at)
  values (caller, extensions.digest(token, 'sha256'), expiry)
  on conflict (owner_id) do update
    set token_hash = excluded.token_hash,
        expires_at = excluded.expires_at,
        created_at = now();
  return query select token, expiry;
end;
$$;

create or replace function public.disable_friend_invite()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := (select auth.uid());
begin
  if not private.is_direct_user_session() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  delete from public.friend_invites where owner_id = caller;
  return true;
end;
$$;

create or replace function public.claim_friend_invite(p_invite_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  normalized_code text := lower(btrim(coalesce(p_invite_code, '')));
  invite_owner uuid;
  pair_a uuid;
  pair_b uuid;
begin
  if not private.is_direct_user_session() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if normalized_code !~ '^[0-9a-f]{48}$' then
    perform extensions.digest(left(normalized_code, 128), 'sha256');
    return true;
  end if;
  select invite.owner_id into invite_owner
  from public.friend_invites as invite
  where invite.token_hash = extensions.digest(normalized_code, 'sha256')
    and invite.expires_at > now()
  for update;
  if invite_owner is null or invite_owner = caller then return true; end if;
  delete from public.friend_invites where owner_id = invite_owner;
  pair_a := least(caller, invite_owner);
  pair_b := greatest(caller, invite_owner);
  delete from public.friendships
  where user_a_id = pair_a and user_b_id = pair_b and status = 'revoked';
  insert into public.friendships (
    user_a_id, user_b_id, requested_by, status,
    requester_accepted_at, recipient_accepted_at, accepted_at,
    revoked_at, revoked_by, updated_at
  ) values (pair_a, pair_b, caller, 'pending', now(), null, null, null, null, now())
  on conflict (user_a_id, user_b_id) do nothing;
  return true;
end;
$$;

create or replace function public.list_friend_connections()
returns table(friendship_id uuid, status text, direction text, friend_display_name text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    friendship.id,
    friendship.status,
    case
      when friendship.status = 'accepted' then 'mutual'
      when friendship.requested_by = (select auth.uid()) then 'outgoing'
      else 'incoming'
    end,
    coalesce(profile.display_name, 'Gapwise friend'),
    friendship.updated_at
  from public.friendships as friendship
  left join public.friend_profiles as profile
    on profile.user_id = case
      when friendship.user_a_id = (select auth.uid()) then friendship.user_b_id
      else friendship.user_a_id
    end
  where private.is_direct_user_session()
    and (select auth.uid()) in (friendship.user_a_id, friendship.user_b_id)
    and friendship.status in ('pending', 'accepted')
    and friendship.revoked_at is null
  order by friendship.updated_at desc
$$;

create or replace function public.respond_to_friend_request(p_friendship_id uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  relationship public.friendships%rowtype;
begin
  if not private.is_direct_user_session() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  select friendship.* into relationship
  from public.friendships as friendship
  where friendship.id = p_friendship_id
    and caller in (friendship.user_a_id, friendship.user_b_id)
  for update;
  if not found
    or relationship.status <> 'pending'
    or relationship.revoked_at is not null
    or relationship.requested_by = caller
  then return true; end if;
  if coalesce(p_accept, false) then
    update public.friendships
    set status = 'accepted', recipient_accepted_at = now(), accepted_at = now(), updated_at = now()
    where id = relationship.id;
  else
    update public.friendships
    set status = 'revoked', revoked_at = now(), revoked_by = caller, updated_at = now()
    where id = relationship.id;
  end if;
  return true;
end;
$$;

create or replace function public.revoke_friendship(p_friendship_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := (select auth.uid());
begin
  if not private.is_direct_user_session() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  update public.friendships
  set status = 'revoked', revoked_at = now(), revoked_by = caller, updated_at = now()
  where id = p_friendship_id
    and caller in (user_a_id, user_b_id)
    and status in ('pending', 'accepted')
    and revoked_at is null;
  return true;
end;
$$;

create or replace function public.get_friend_capsule_material(p_friendship_id uuid, p_term text)
returns table(participant text, subject_id uuid, key_id uuid, wrapped_dek bytea, wrap_nonce bytea, kek_version integer, key_version smallint, crypto_version smallint, capsule_id uuid, capsule_ciphertext bytea, capsule_nonce bytea, capsule_schema_version smallint, capsule_revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  relationship public.friendships%rowtype;
  requests_in_window integer;
begin
  if not private.is_direct_user_session() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_term not in ('Fall', 'Winter', 'Summer') then
    raise exception 'Unsupported term.' using errcode = '22023';
  end if;
  insert into private.friend_capsule_rate_limits as rate_limit (caller_id, window_started_at, request_count)
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
  select friendship.* into relationship
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
  then return; end if;
  return query
  with participants(label, user_id, sort_order) as (
    values
      ('caller'::text, caller, 1),
      ('friend'::text,
        case when relationship.user_a_id = caller then relationship.user_b_id else relationship.user_a_id end,
        2)
  ), material as (
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
  if not private.is_direct_user_session() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_expected_kek_version is null
    or p_new_kek_version is null
    or p_expected_kek_version < 1
    or p_new_kek_version <= p_expected_kek_version
  then raise exception 'Invalid KEK rotation version.' using errcode = '22023'; end if;
  if octet_length(p_private_data_wrapped_dek) <> 48
    or octet_length(p_private_data_wrap_nonce) <> 12
    or octet_length(p_friend_availability_wrapped_dek) <> 48
    or octet_length(p_friend_availability_wrap_nonce) <> 12
  then raise exception 'Invalid wrapped key material.' using errcode = '22023'; end if;
  update public.crypto_key_envelopes
  set private_data_wrapped_dek = p_private_data_wrapped_dek,
      private_data_wrap_nonce = p_private_data_wrap_nonce,
      friend_availability_wrapped_dek = p_friend_availability_wrapped_dek,
      friend_availability_wrap_nonce = p_friend_availability_wrap_nonce,
      kek_version = p_new_kek_version,
      updated_at = now()
  where user_id = caller and kek_version = p_expected_kek_version;
  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

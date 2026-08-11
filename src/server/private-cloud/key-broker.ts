import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "../../lib/database.types.js";
import {
  CRYPTO_VERSION,
  KEY_VERSION,
  type CryptoPurpose,
} from "../../features/security/crypto-context.js";
import {
  AES_KEY_BYTES,
  unwrapDataEncryptionKey,
  wrapDataEncryptionKey,
} from "../../features/security/envelope-crypto.js";
import {
  importDevicePublicKey,
  validateDevicePublicJwk,
  wrapRawDataKeyForDevice,
} from "../../features/security/device-keys.js";
import { bytesToBase64Url, bytesToByteaHex, equalBytes } from "../../features/security/encoding.js";
import type { AuthenticatedRequest } from "./auth.js";
import { ApiError, requireExactObject } from "./http.js";
import {
  loadKek,
  readActiveKekVersion,
  unwrapStoredDataKey,
  type KekLoader,
  type KeyEnvelopeRow,
} from "./kek.js";

export type DeviceKeyBundle = {
  cryptoVersion: number;
  friendAvailability: { keyId: string; wrappedDek: string };
  keyVersion: number;
  privateData: { keyId: string; wrappedDek: string };
  subjectId: string;
};

export type RotatedKeyWraps = {
  friendAvailabilityWrapNonce: string;
  friendAvailabilityWrappedDek: string;
  newKekVersion: number;
  privateDataWrapNonce: string;
  privateDataWrappedDek: string;
};

async function readOwnEnvelope(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<KeyEnvelopeRow | null> {
  const { data, error } = await client
    .from("crypto_key_envelopes")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Key envelope lookup failed.");
  return data;
}

function randomDataKey(): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(AES_KEY_BYTES)));
}

async function wrapNewEnvelopeKey(
  rawDek: Uint8Array<ArrayBuffer>,
  kek: CryptoKey,
  purpose: CryptoPurpose,
  subjectId: string,
  keyId: string,
  kekVersion: number,
  cryptoVersion: number = CRYPTO_VERSION,
  keyVersion: number = KEY_VERSION,
) {
  return wrapDataEncryptionKey(kek, rawDek, {
    cryptoVersion,
    purpose,
    subjectId,
    keyId,
    keyVersion,
    kekVersion,
  });
}

async function createOwnEnvelope(client: SupabaseClient<Database>, userId: string): Promise<void> {
  const subjectId = globalThis.crypto.randomUUID();
  const privateDataKeyId = globalThis.crypto.randomUUID();
  const friendAvailabilityKeyId = globalThis.crypto.randomUUID();
  const kekVersion = readActiveKekVersion();
  const kek = await loadKek(kekVersion);
  const privateDataDek = randomDataKey();
  const friendAvailabilityDek = randomDataKey();

  try {
    const [privateData, friendAvailability] = await Promise.all([
      wrapNewEnvelopeKey(
        privateDataDek,
        kek,
        "private-data",
        subjectId,
        privateDataKeyId,
        kekVersion,
      ),
      wrapNewEnvelopeKey(
        friendAvailabilityDek,
        kek,
        "friend-availability",
        subjectId,
        friendAvailabilityKeyId,
        kekVersion,
      ),
    ]);
    const row: TablesInsert<"crypto_key_envelopes"> = {
      user_id: userId,
      subject_id: subjectId,
      private_data_key_id: privateDataKeyId,
      private_data_wrapped_dek: bytesToByteaHex(privateData.ciphertext),
      private_data_wrap_nonce: bytesToByteaHex(privateData.nonce),
      friend_availability_key_id: friendAvailabilityKeyId,
      friend_availability_wrapped_dek: bytesToByteaHex(friendAvailability.ciphertext),
      friend_availability_wrap_nonce: bytesToByteaHex(friendAvailability.nonce),
      crypto_version: CRYPTO_VERSION,
      key_version: KEY_VERSION,
      kek_version: kekVersion,
    };
    const { error } = await client.from("crypto_key_envelopes").insert(row);
    if (error && error.code !== "23505") throw new Error("Key envelope creation failed.");
  } finally {
    privateDataDek.fill(0);
    friendAvailabilityDek.fill(0);
  }
}

async function verifyRotatedWrap(
  kek: CryptoKey,
  rawDek: Uint8Array<ArrayBuffer>,
  wrapped: Awaited<ReturnType<typeof wrapDataEncryptionKey>>,
  envelope: KeyEnvelopeRow,
  purpose: CryptoPurpose,
  keyId: string,
  newKekVersion: number,
): Promise<void> {
  const verified = await unwrapDataEncryptionKey(kek, wrapped, {
    cryptoVersion: envelope.crypto_version,
    purpose,
    subjectId: envelope.subject_id,
    keyId,
    keyVersion: envelope.key_version,
    kekVersion: newKekVersion,
  });
  try {
    if (!equalBytes(verified, rawDek)) throw new Error("Rotated key verification failed.");
  } finally {
    verified.fill(0);
  }
}

export async function rewrapEnvelopeToKek(
  envelope: KeyEnvelopeRow,
  newKekVersion: number,
  kekLoader: KekLoader = loadKek,
): Promise<RotatedKeyWraps> {
  if (!Number.isSafeInteger(newKekVersion) || newKekVersion <= envelope.kek_version) {
    throw new Error("KEK rotation must move to a higher version.");
  }

  let privateDataDek: Uint8Array<ArrayBuffer> | null = null;
  let friendAvailabilityDek: Uint8Array<ArrayBuffer> | null = null;
  try {
    privateDataDek = await unwrapStoredDataKey(envelope, "private-data", kekLoader);
    friendAvailabilityDek = await unwrapStoredDataKey(envelope, "friend-availability", kekLoader);
    const newKek = await kekLoader(newKekVersion);
    const [privateData, friendAvailability] = await Promise.all([
      wrapNewEnvelopeKey(
        privateDataDek,
        newKek,
        "private-data",
        envelope.subject_id,
        envelope.private_data_key_id,
        newKekVersion,
        envelope.crypto_version,
        envelope.key_version,
      ),
      wrapNewEnvelopeKey(
        friendAvailabilityDek,
        newKek,
        "friend-availability",
        envelope.subject_id,
        envelope.friend_availability_key_id,
        newKekVersion,
        envelope.crypto_version,
        envelope.key_version,
      ),
    ]);
    await verifyRotatedWrap(
      newKek,
      privateDataDek,
      privateData,
      envelope,
      "private-data",
      envelope.private_data_key_id,
      newKekVersion,
    );
    await verifyRotatedWrap(
      newKek,
      friendAvailabilityDek,
      friendAvailability,
      envelope,
      "friend-availability",
      envelope.friend_availability_key_id,
      newKekVersion,
    );
    return {
      privateDataWrappedDek: bytesToByteaHex(privateData.ciphertext),
      privateDataWrapNonce: bytesToByteaHex(privateData.nonce),
      friendAvailabilityWrappedDek: bytesToByteaHex(friendAvailability.ciphertext),
      friendAvailabilityWrapNonce: bytesToByteaHex(friendAvailability.nonce),
      newKekVersion,
    };
  } finally {
    privateDataDek?.fill(0);
    friendAvailabilityDek?.fill(0);
  }
}

export function confirmRotatedEnvelope(
  current: KeyEnvelopeRow | null,
  activeKekVersion: number,
  rpcError: unknown,
): KeyEnvelopeRow {
  if (current?.kek_version === activeKekVersion) return current;
  throw new Error(
    rpcError ? "Key envelope rotation failed." : "Key envelope rotation was not confirmed.",
  );
}

async function rotateEnvelopeIfNeeded(
  authenticated: AuthenticatedRequest,
  envelope: KeyEnvelopeRow,
): Promise<KeyEnvelopeRow> {
  const activeKekVersion = readActiveKekVersion();
  if (envelope.kek_version === activeKekVersion) return envelope;
  if (envelope.kek_version > activeKekVersion) {
    throw new Error("Active KEK version is older than the stored envelope.");
  }

  const rotated = await rewrapEnvelopeToKek(envelope, activeKekVersion);
  const { error } = await authenticated.client.rpc("rotate_own_key_envelope", {
    p_expected_kek_version: envelope.kek_version,
    p_new_kek_version: rotated.newKekVersion,
    p_private_data_wrapped_dek: rotated.privateDataWrappedDek,
    p_private_data_wrap_nonce: rotated.privateDataWrapNonce,
    p_friend_availability_wrapped_dek: rotated.friendAvailabilityWrappedDek,
    p_friend_availability_wrap_nonce: rotated.friendAvailabilityWrapNonce,
  });

  const current = await readOwnEnvelope(authenticated.client, authenticated.userId);
  return confirmRotatedEnvelope(current, activeKekVersion, error);
}

export async function wrapEnvelopeKeysForDevice(
  envelope: KeyEnvelopeRow,
  publicJwk: unknown,
  kekLoader: KekLoader = loadKek,
): Promise<DeviceKeyBundle> {
  const publicKey = await importDevicePublicKey(validateDevicePublicJwk(publicJwk));
  let privateDataDek: Uint8Array<ArrayBuffer> | null = null;
  let friendAvailabilityDek: Uint8Array<ArrayBuffer> | null = null;
  try {
    privateDataDek = await unwrapStoredDataKey(envelope, "private-data", kekLoader);
    friendAvailabilityDek = await unwrapStoredDataKey(envelope, "friend-availability", kekLoader);
    const [privateDataWrapped, friendAvailabilityWrapped] = await Promise.all([
      wrapRawDataKeyForDevice(privateDataDek, publicKey),
      wrapRawDataKeyForDevice(friendAvailabilityDek, publicKey),
    ]);
    return {
      cryptoVersion: envelope.crypto_version,
      keyVersion: envelope.key_version,
      subjectId: envelope.subject_id,
      privateData: {
        keyId: envelope.private_data_key_id,
        wrappedDek: bytesToBase64Url(privateDataWrapped),
      },
      friendAvailability: {
        keyId: envelope.friend_availability_key_id,
        wrappedDek: bytesToBase64Url(friendAvailabilityWrapped),
      },
    };
  } finally {
    privateDataDek?.fill(0);
    friendAvailabilityDek?.fill(0);
  }
}

export async function issueDeviceKeyBundle(
  authenticated: AuthenticatedRequest,
  publicJwk: unknown,
): Promise<DeviceKeyBundle> {
  validateDevicePublicJwk(publicJwk);
  let envelope = await readOwnEnvelope(authenticated.client, authenticated.userId);
  if (!envelope) {
    await createOwnEnvelope(authenticated.client, authenticated.userId);
    envelope = await readOwnEnvelope(authenticated.client, authenticated.userId);
  }
  if (!envelope) throw new Error("Key envelope was not persisted.");
  envelope = await rotateEnvelopeIfNeeded(authenticated, envelope);
  return wrapEnvelopeKeysForDevice(envelope, publicJwk);
}

export function parseKeyBrokerBody(value: unknown): JsonWebKey {
  const body = requireExactObject(value, ["devicePublicKey"]);
  try {
    return validateDevicePublicJwk(body["devicePublicKey"]);
  } catch {
    throw new ApiError(400, "Device public key is invalid.");
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "../../lib/database.types";
import {
  CRYPTO_VERSION,
  KEY_VERSION,
  type CryptoPurpose,
} from "../../features/security/crypto-context";
import { AES_KEY_BYTES, wrapDataEncryptionKey } from "../../features/security/envelope-crypto";
import {
  importDevicePublicKey,
  validateDevicePublicJwk,
  wrapRawDataKeyForDevice,
} from "../../features/security/device-keys";
import { bytesToBase64Url, bytesToByteaHex } from "../../features/security/encoding";
import type { AuthenticatedRequest } from "./auth";
import { ApiError, requireExactObject } from "./http";
import {
  loadKek,
  readActiveKekVersion,
  unwrapStoredDataKey,
  type KekLoader,
  type KeyEnvelopeRow,
} from "./kek";

export type DeviceKeyBundle = {
  cryptoVersion: number;
  friendAvailability: { keyId: string; wrappedDek: string };
  keyVersion: number;
  privateData: { keyId: string; wrappedDek: string };
  subjectId: string;
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
) {
  return wrapDataEncryptionKey(kek, rawDek, {
    cryptoVersion: CRYPTO_VERSION,
    purpose,
    subjectId,
    keyId,
    keyVersion: KEY_VERSION,
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

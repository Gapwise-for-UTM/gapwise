import process from "node:process";
import type { Tables } from "../../lib/database.types.js";
import {
  assertCurrentCryptoVersion,
  importAes256Key,
  unwrapDataEncryptionKey,
  type EncryptedBytes,
} from "../../features/security/envelope-crypto.js";
import { KEY_VERSION, type CryptoPurpose } from "../../features/security/crypto-context.js";
import { base64UrlToBytes, byteaHexToBytes } from "../../features/security/encoding.js";

export type KeyEnvelopeRow = Tables<"crypto_key_envelopes">;
export type KekLoader = (version: number) => Promise<CryptoKey>;
export type WrappedDataKeyMaterial = {
  cryptoVersion: number;
  ciphertext: string;
  kekVersion: number;
  keyId: string;
  keyVersion: number;
  nonce: string;
  subjectId: string;
};

export function readActiveKekVersion(
  environment: Record<string, string | undefined> = process.env,
): number {
  const value = environment["GAPWISE_ACTIVE_KEK_VERSION"] ?? "";
  if (!/^[1-9][0-9]*$/u.test(value)) throw new Error("Active KEK version is invalid.");
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version > 2_147_483_647) {
    throw new Error("Active KEK version is invalid.");
  }
  return version;
}

export async function loadKek(
  version: number,
  environment: Record<string, string | undefined> = process.env,
): Promise<CryptoKey> {
  if (!Number.isSafeInteger(version) || version < 1 || version > 2_147_483_647) {
    throw new Error("KEK version is invalid.");
  }
  const encoded = environment[`GAPWISE_KEK_V${version}`];
  if (!encoded || encoded.trim() !== encoded) throw new Error("Requested KEK is unavailable.");
  const raw = base64UrlToBytes(encoded, 32);
  if (raw.byteLength !== 32) throw new Error("Requested KEK is invalid.");
  try {
    return await importAes256Key(raw, false);
  } finally {
    raw.fill(0);
  }
}

function materialFromEnvelope(
  envelope: KeyEnvelopeRow,
  purpose: CryptoPurpose,
): WrappedDataKeyMaterial {
  const privateData = purpose === "private-data";
  return {
    cryptoVersion: envelope.crypto_version,
    ciphertext: privateData
      ? envelope.private_data_wrapped_dek
      : envelope.friend_availability_wrapped_dek,
    kekVersion: envelope.kek_version,
    keyId: privateData ? envelope.private_data_key_id : envelope.friend_availability_key_id,
    keyVersion: envelope.key_version,
    nonce: privateData ? envelope.private_data_wrap_nonce : envelope.friend_availability_wrap_nonce,
    subjectId: envelope.subject_id,
  };
}

export async function unwrapStoredDataKeyMaterial(
  material: WrappedDataKeyMaterial,
  purpose: CryptoPurpose,
  kekLoader: KekLoader = loadKek,
): Promise<Uint8Array<ArrayBuffer>> {
  assertCurrentCryptoVersion(material.cryptoVersion);
  if (material.keyVersion !== KEY_VERSION) throw new Error("Unsupported key version.");
  const encrypted: EncryptedBytes = {
    ciphertext: byteaHexToBytes(material.ciphertext, 48),
    nonce: byteaHexToBytes(material.nonce, 12),
  };
  if (encrypted.ciphertext.byteLength !== 48 || encrypted.nonce.byteLength !== 12) {
    throw new Error("Stored key envelope is malformed.");
  }
  const kek = await kekLoader(material.kekVersion);
  return unwrapDataEncryptionKey(kek, encrypted, {
    cryptoVersion: material.cryptoVersion,
    purpose,
    subjectId: material.subjectId,
    keyId: material.keyId,
    keyVersion: material.keyVersion,
    kekVersion: material.kekVersion,
  });
}

export async function unwrapStoredDataKey(
  envelope: KeyEnvelopeRow,
  purpose: CryptoPurpose,
  kekLoader: KekLoader = loadKek,
): Promise<Uint8Array<ArrayBuffer>> {
  return unwrapStoredDataKeyMaterial(materialFromEnvelope(envelope, purpose), purpose, kekLoader);
}

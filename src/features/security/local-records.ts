import {
  AVAILABILITY_SCHEMA_VERSION,
  CRYPTO_VERSION,
  PRIVATE_DATA_SCHEMA_VERSION,
} from "./crypto-context";
import { decryptJsonRecord, encryptJsonRecord, type EncryptedBytes } from "./envelope-crypto";
import {
  MAX_CAPSULE_PLAINTEXT_BYTES,
  validateAvailabilityCapsule,
  type AvailabilityCapsuleV1,
} from "./availability-capsule";
import { validatePrivateDataPayload, type PrivateDataPayloadV1 } from "./private-data";
import type { StoredCapsuleRecord, StoredDataKeys, StoredPrivateRecord } from "./security-store";

const MAX_PRIVATE_DATA_PLAINTEXT_BYTES = 256 * 1024;

function uuid(): string {
  return crypto.randomUUID();
}

function requireRevision(value: number) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("Invalid encrypted record revision.");
}

export async function sealPrivateData(input: {
  userId: string;
  keys: StoredDataKeys;
  payload: PrivateDataPayloadV1;
  revision: number;
  recordId?: string;
  updatedAt?: string;
}): Promise<StoredPrivateRecord> {
  requireRevision(input.revision);
  if (input.keys.userId !== input.userId) throw new Error("Encryption key owner mismatch.");
  const recordId = input.recordId ?? uuid();
  const encrypted = await encryptJsonRecord(input.keys.privateData.key, input.payload, {
    cryptoVersion: CRYPTO_VERSION,
    schemaVersion: PRIVATE_DATA_SCHEMA_VERSION,
    purpose: "private-data",
    subjectId: input.keys.subjectId,
    recordId,
    keyId: input.keys.privateData.keyId,
    revision: input.revision,
  });
  return {
    userId: input.userId,
    purpose: "private-data",
    cryptoVersion: CRYPTO_VERSION,
    schemaVersion: PRIVATE_DATA_SCHEMA_VERSION,
    subjectId: input.keys.subjectId,
    recordId,
    keyId: input.keys.privateData.keyId,
    revision: input.revision,
    encrypted,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export async function openPrivateData(
  keys: StoredDataKeys,
  record: StoredPrivateRecord,
): Promise<PrivateDataPayloadV1> {
  if (
    keys.userId !== record.userId ||
    keys.subjectId !== record.subjectId ||
    keys.privateData.keyId !== record.keyId
  ) {
    throw new Error("Encrypted private data context mismatch.");
  }
  return decryptJsonRecord(
    keys.privateData.key,
    record.encrypted,
    {
      cryptoVersion: record.cryptoVersion,
      schemaVersion: record.schemaVersion,
      purpose: "private-data",
      subjectId: record.subjectId,
      recordId: record.recordId,
      keyId: record.keyId,
      revision: record.revision,
    },
    validatePrivateDataPayload,
    MAX_PRIVATE_DATA_PLAINTEXT_BYTES,
  );
}

export async function sealAvailabilityCapsule(input: {
  userId: string;
  keys: StoredDataKeys;
  capsule: AvailabilityCapsuleV1;
  revision: number;
  recordId?: string;
  updatedAt?: string;
}): Promise<StoredCapsuleRecord> {
  requireRevision(input.revision);
  if (input.keys.userId !== input.userId) throw new Error("Encryption key owner mismatch.");
  const recordId = input.recordId ?? uuid();
  const encrypted = await encryptJsonRecord(input.keys.friendAvailability.key, input.capsule, {
    cryptoVersion: CRYPTO_VERSION,
    schemaVersion: AVAILABILITY_SCHEMA_VERSION,
    purpose: "friend-availability",
    subjectId: input.keys.subjectId,
    recordId,
    keyId: input.keys.friendAvailability.keyId,
    revision: input.revision,
  });
  return {
    userId: input.userId,
    purpose: "friend-availability",
    cryptoVersion: CRYPTO_VERSION,
    schemaVersion: AVAILABILITY_SCHEMA_VERSION,
    subjectId: input.keys.subjectId,
    recordId,
    keyId: input.keys.friendAvailability.keyId,
    revision: input.revision,
    encrypted,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export async function openAvailabilityCapsule(
  keys: StoredDataKeys,
  record: StoredCapsuleRecord,
): Promise<AvailabilityCapsuleV1> {
  if (
    keys.userId !== record.userId ||
    keys.subjectId !== record.subjectId ||
    keys.friendAvailability.keyId !== record.keyId
  ) {
    throw new Error("Encrypted availability context mismatch.");
  }
  return decryptJsonRecord(
    keys.friendAvailability.key,
    record.encrypted,
    {
      cryptoVersion: record.cryptoVersion,
      schemaVersion: record.schemaVersion,
      purpose: "friend-availability",
      subjectId: record.subjectId,
      recordId: record.recordId,
      keyId: record.keyId,
      revision: record.revision,
    },
    validateAvailabilityCapsule,
    MAX_CAPSULE_PLAINTEXT_BYTES,
  );
}

export function cloneEncryptedBytes(encrypted: EncryptedBytes): EncryptedBytes {
  return { ciphertext: encrypted.ciphertext.slice(), nonce: encrypted.nonce.slice() };
}

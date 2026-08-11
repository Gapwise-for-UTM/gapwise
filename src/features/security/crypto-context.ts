import { utf8 } from "./encoding.js";

export const CRYPTO_VERSION = 1 as const;
export const PRIVATE_DATA_SCHEMA_VERSION = 1 as const;
export const AVAILABILITY_SCHEMA_VERSION = 1 as const;
export const KEY_VERSION = 1 as const;

export type CryptoPurpose = "private-data" | "friend-availability";

export type KeyEnvelopeContext = {
  cryptoVersion: number;
  purpose: CryptoPurpose;
  subjectId: string;
  keyId: string;
  keyVersion: number;
  kekVersion: number;
};

export type EncryptedRecordContext = {
  cryptoVersion: number;
  schemaVersion: number;
  purpose: CryptoPurpose;
  subjectId: string;
  recordId: string;
  keyId: string;
  revision: number;
};

export class UnsupportedCryptoVersionError extends Error {
  constructor(version: number) {
    super(`Unsupported crypto version: ${version}`);
  }
}

function requireVersion(version: number) {
  if (version !== CRYPTO_VERSION) throw new UnsupportedCryptoVersionError(version);
}

function requirePositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${name}.`);
}

function requireOpaqueId(value: string, name: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new Error(`Invalid ${name}.`);
  }
}

export function keyEnvelopeAad(context: KeyEnvelopeContext): Uint8Array {
  requireVersion(context.cryptoVersion);
  requireOpaqueId(context.subjectId, "subject ID");
  requireOpaqueId(context.keyId, "key ID");
  requirePositiveInteger(context.keyVersion, "key version");
  requirePositiveInteger(context.kekVersion, "KEK version");
  return utf8(
    JSON.stringify([
      "gapwise",
      "key-envelope",
      context.cryptoVersion,
      context.purpose,
      context.subjectId,
      context.keyId,
      context.keyVersion,
      context.kekVersion,
    ]),
  );
}

export function encryptedRecordAad(context: EncryptedRecordContext): Uint8Array {
  requireVersion(context.cryptoVersion);
  requireOpaqueId(context.subjectId, "subject ID");
  requireOpaqueId(context.recordId, "record ID");
  requireOpaqueId(context.keyId, "key ID");
  requirePositiveInteger(context.schemaVersion, "schema version");
  requirePositiveInteger(context.revision, "revision");
  return utf8(
    JSON.stringify([
      "gapwise",
      context.purpose,
      context.cryptoVersion,
      context.schemaVersion,
      context.subjectId,
      context.recordId,
      context.keyId,
      context.revision,
    ]),
  );
}

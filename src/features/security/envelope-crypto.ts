import {
  CRYPTO_VERSION,
  encryptedRecordAad,
  keyEnvelopeAad,
  type EncryptedRecordContext,
  type KeyEnvelopeContext,
} from "./crypto-context.js";
import { decodeUtf8, utf8 } from "./encoding.js";

export const AES_KEY_BYTES = 32;
export const GCM_NONCE_BYTES = 12;
export const GCM_TAG_BITS = 128;

type CryptoRuntime = Pick<Crypto, "getRandomValues" | "subtle">;

function ownedArrayBuffer(value: ArrayBuffer | ArrayBufferView<ArrayBufferLike>): ArrayBuffer {
  const source =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  const copy = new Uint8Array(new ArrayBuffer(source.byteLength));
  copy.set(source);
  return copy.buffer;
}

function runtime(value?: CryptoRuntime): CryptoRuntime {
  const selected = value ?? globalThis.crypto;
  if (!selected?.subtle || !selected.getRandomValues) throw new Error("Web Crypto is unavailable.");
  return selected;
}

function randomNonce(selected: CryptoRuntime): Uint8Array<ArrayBuffer> {
  return selected.getRandomValues(new Uint8Array(new ArrayBuffer(GCM_NONCE_BYTES)));
}

export type EncryptedBytes = {
  ciphertext: Uint8Array<ArrayBuffer>;
  nonce: Uint8Array<ArrayBuffer>;
};

export async function generateDataEncryptionKey(
  extractable = false,
  selected?: CryptoRuntime,
): Promise<CryptoKey> {
  return runtime(selected).subtle.generateKey({ name: "AES-GCM", length: 256 }, extractable, [
    "encrypt",
    "decrypt",
  ]);
}

export async function importAes256Key(
  rawKey: BufferSource,
  extractable = false,
  selected?: CryptoRuntime,
): Promise<CryptoKey> {
  const bytes =
    rawKey instanceof ArrayBuffer
      ? new Uint8Array(rawKey)
      : new Uint8Array(rawKey.buffer, rawKey.byteOffset, rawKey.byteLength);
  if (bytes.byteLength !== AES_KEY_BYTES) throw new Error("AES-256 keys must be exactly 32 bytes.");
  return runtime(selected).subtle.importKey(
    "raw",
    ownedArrayBuffer(bytes),
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: BufferSource,
  additionalData: BufferSource,
  selected?: CryptoRuntime,
): Promise<EncryptedBytes> {
  const cryptoRuntime = runtime(selected);
  const nonce = randomNonce(cryptoRuntime);
  const ciphertext = await cryptoRuntime.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce.buffer,
      additionalData: ownedArrayBuffer(additionalData),
      tagLength: GCM_TAG_BITS,
    },
    key,
    ownedArrayBuffer(plaintext),
  );
  return { ciphertext: new Uint8Array(ciphertext), nonce };
}

export async function decryptBytes(
  key: CryptoKey,
  encrypted: EncryptedBytes,
  additionalData: BufferSource,
  selected?: CryptoRuntime,
): Promise<Uint8Array<ArrayBuffer>> {
  if (encrypted.nonce.byteLength !== GCM_NONCE_BYTES) throw new Error("Invalid AES-GCM nonce.");
  if (encrypted.ciphertext.byteLength < GCM_TAG_BITS / 8) throw new Error("Invalid ciphertext.");
  try {
    const plaintext = await runtime(selected).subtle.decrypt(
      {
        name: "AES-GCM",
        iv: encrypted.nonce.buffer,
        additionalData: ownedArrayBuffer(additionalData),
        tagLength: GCM_TAG_BITS,
      },
      key,
      encrypted.ciphertext.buffer,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error("Encrypted data authentication failed.");
  }
}

export async function encryptJsonRecord(
  key: CryptoKey,
  value: unknown,
  context: EncryptedRecordContext,
  selected?: CryptoRuntime,
): Promise<EncryptedBytes> {
  return encryptBytes(
    key,
    ownedArrayBuffer(utf8(JSON.stringify(value))),
    ownedArrayBuffer(encryptedRecordAad(context)),
    selected,
  );
}

export async function decryptJsonRecord<T>(
  key: CryptoKey,
  encrypted: EncryptedBytes,
  context: EncryptedRecordContext,
  validate: (value: unknown) => T,
  maximumPlaintextBytes = 256 * 1024,
  selected?: CryptoRuntime,
): Promise<T> {
  const plaintext = await decryptBytes(
    key,
    encrypted,
    ownedArrayBuffer(encryptedRecordAad(context)),
    selected,
  );
  if (plaintext.byteLength > maximumPlaintextBytes) throw new Error("Decrypted data is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(plaintext.buffer));
  } catch {
    throw new Error("Decrypted data is malformed.");
  }
  return validate(parsed);
}

export async function wrapDataEncryptionKey(
  kek: CryptoKey,
  rawDek: BufferSource,
  context: KeyEnvelopeContext,
  selected?: CryptoRuntime,
): Promise<EncryptedBytes> {
  const bytes =
    rawDek instanceof ArrayBuffer
      ? new Uint8Array(rawDek)
      : new Uint8Array(rawDek.buffer, rawDek.byteOffset, rawDek.byteLength);
  if (bytes.byteLength !== AES_KEY_BYTES) throw new Error("DEKs must be exactly 32 bytes.");
  return encryptBytes(
    kek,
    ownedArrayBuffer(bytes),
    ownedArrayBuffer(keyEnvelopeAad(context)),
    selected,
  );
}

export async function unwrapDataEncryptionKey(
  kek: CryptoKey,
  encrypted: EncryptedBytes,
  context: KeyEnvelopeContext,
  selected?: CryptoRuntime,
): Promise<Uint8Array<ArrayBuffer>> {
  const rawDek = await decryptBytes(
    kek,
    encrypted,
    ownedArrayBuffer(keyEnvelopeAad(context)),
    selected,
  );
  if (rawDek.byteLength !== AES_KEY_BYTES) throw new Error("Wrapped DEK has an invalid length.");
  return rawDek;
}

export function assertCurrentCryptoVersion(
  version: number,
): asserts version is typeof CRYPTO_VERSION {
  if (version !== CRYPTO_VERSION) throw new Error(`Unsupported crypto version: ${version}`);
}

import { AES_KEY_BYTES } from "./envelope-crypto.js";
import { base64UrlToBytes } from "./encoding.js";

export const DEVICE_RSA_MODULUS_BITS = 2048;
export const DEVICE_RSA_CIPHERTEXT_BYTES = DEVICE_RSA_MODULUS_BITS / 8;

type CryptoRuntime = Pick<Crypto, "subtle">;

function runtime(value?: CryptoRuntime): CryptoRuntime {
  const selected = value ?? globalThis.crypto;
  if (!selected?.subtle) throw new Error("Web Crypto is unavailable.");
  return selected;
}

function ownedBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy.buffer;
}

export type DeviceKeyMaterial = {
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
};

export function validateDevicePublicJwk(value: unknown): JsonWebKey {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Device public key is malformed.");
  }
  if (JSON.stringify(value).length > 2_048) throw new Error("Device public key is too large.");
  const jwk = value as JsonWebKey;
  const modulusEncoded = jwk.n;
  const modulus = typeof modulusEncoded === "string" ? base64UrlToBytes(modulusEncoded, 512) : null;
  if (
    jwk.kty !== "RSA" ||
    jwk.alg !== "RSA-OAEP-256" ||
    jwk.e !== "AQAB" ||
    jwk.ext !== true ||
    !Array.isArray(jwk.key_ops) ||
    jwk.key_ops.length !== 1 ||
    jwk.key_ops[0] !== "encrypt" ||
    (jwk.use !== undefined && jwk.use !== "enc") ||
    !modulus ||
    modulus.byteLength !== DEVICE_RSA_CIPHERTEXT_BYTES ||
    jwk.d !== undefined ||
    jwk.p !== undefined ||
    jwk.q !== undefined ||
    jwk.dp !== undefined ||
    jwk.dq !== undefined ||
    jwk.qi !== undefined ||
    jwk.oth !== undefined
  ) {
    throw new Error("Unsupported device public key.");
  }
  return {
    kty: "RSA",
    alg: "RSA-OAEP-256",
    e: "AQAB",
    n: modulusEncoded!,
    ext: true,
    key_ops: ["encrypt"],
    ...(jwk.use === "enc" ? { use: "enc" } : {}),
  };
}

export async function generateDeviceKeyMaterial(
  selected?: CryptoRuntime,
): Promise<DeviceKeyMaterial> {
  const cryptoRuntime = runtime(selected);
  const pair = (await cryptoRuntime.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: DEVICE_RSA_MODULUS_BITS,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    false,
    ["encrypt", "unwrapKey"],
  )) as CryptoKeyPair;
  if (pair.privateKey.extractable) throw new Error("Device private key must be non-extractable.");
  const publicJwk = validateDevicePublicJwk(
    await cryptoRuntime.subtle.exportKey("jwk", pair.publicKey),
  );
  return { privateKey: pair.privateKey, publicJwk };
}

export async function importDevicePublicKey(
  value: unknown,
  selected?: CryptoRuntime,
): Promise<CryptoKey> {
  const jwk = validateDevicePublicJwk(value);
  return runtime(selected).subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
}

/** Server-side helper: the raw DEK exists only in the narrow broker's memory. */
export async function wrapRawDataKeyForDevice(
  rawDek: Uint8Array,
  publicKey: CryptoKey,
  selected?: CryptoRuntime,
): Promise<Uint8Array<ArrayBuffer>> {
  if (rawDek.byteLength !== AES_KEY_BYTES) throw new Error("DEKs must be exactly 32 bytes.");
  const wrapped = await runtime(selected).subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    ownedBuffer(rawDek),
  );
  return new Uint8Array(wrapped);
}

/** Browser-side helper: unwraps directly into a non-extractable AES CryptoKey. */
export async function unwrapDeviceDataKey(
  wrappedDek: Uint8Array,
  privateKey: CryptoKey,
  selected?: CryptoRuntime,
): Promise<CryptoKey> {
  if (wrappedDek.byteLength !== DEVICE_RSA_CIPHERTEXT_BYTES) {
    throw new Error("Device-wrapped key has an invalid length.");
  }
  let key: CryptoKey;
  try {
    key = await runtime(selected).subtle.unwrapKey(
      "raw",
      ownedBuffer(wrappedDek),
      privateKey,
      { name: "RSA-OAEP" },
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    throw new Error("Device key unwrap failed.");
  }
  if (key.extractable) throw new Error("Unwrapped DEK must be non-extractable.");
  return key;
}

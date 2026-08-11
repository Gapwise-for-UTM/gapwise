const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;
const BYTEA_HEX_PATTERN = /^\\x(?:[0-9a-fA-F]{2})*$/;

export function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function decodeUtf8(value: BufferSource): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(value);
}

export function bytesToBase64Url(value: BufferSource): string {
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function base64UrlToBytes(value: string, maximumBytes = 64 * 1024): Uint8Array {
  if (!BASE64URL_PATTERN.test(value)) throw new Error("Invalid base64url value.");
  const padding = (4 - (value.length % 4)) % 4;
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padding);
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error("Invalid base64url value.");
  }
  if (binary.length > maximumBytes) throw new Error("Decoded value is too large.");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function bytesToByteaHex(value: BufferSource): string {
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return `\\x${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function byteaHexToBytes(value: string, maximumBytes = 64 * 1024): Uint8Array {
  if (!BYTEA_HEX_PATTERN.test(value)) throw new Error("Invalid bytea value.");
  const hex = value.slice(2);
  const length = hex.length / 2;
  if (length > maximumBytes) throw new Error("Decoded value is too large.");
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function equalBytes(left: BufferSource, right: BufferSource): boolean {
  const a =
    left instanceof ArrayBuffer
      ? new Uint8Array(left)
      : new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
  const b =
    right instanceof ArrayBuffer
      ? new Uint8Array(right)
      : new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
  if (a.byteLength !== b.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < a.byteLength; index += 1) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

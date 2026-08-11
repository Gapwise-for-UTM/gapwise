import { describe, expect, test } from "bun:test";
import {
  DEVICE_RSA_CIPHERTEXT_BYTES,
  generateDeviceKeyMaterial,
  importDevicePublicKey,
  unwrapDeviceDataKey,
  validateDevicePublicJwk,
  wrapRawDataKeyForDevice,
} from "@/features/security/device-keys";
import { decryptBytes, encryptBytes } from "@/features/security/envelope-crypto";
import { equalBytes, utf8 } from "@/features/security/encoding";

describe("non-extractable device bootstrap keys", () => {
  test("creates a non-extractable private key and a validated public JWK", async () => {
    const material = await generateDeviceKeyMaterial();
    expect(material.privateKey.extractable).toBe(false);
    expect(material.privateKey.algorithm).toMatchObject({
      name: "RSA-OAEP",
      hash: { name: "SHA-256" },
    });
    expect(material.privateKey.usages).toContain("unwrapKey");
    expect(validateDevicePublicJwk(material.publicJwk)).toEqual(material.publicJwk);
    await expect(crypto.subtle.exportKey("pkcs8", material.privateKey)).rejects.toThrow();
  });

  test("wraps a DEK to the device without returning raw key material to app code", async () => {
    const material = await generateDeviceKeyMaterial();
    const publicKey = await importDevicePublicKey(material.publicJwk);
    const rawDek = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await wrapRawDataKeyForDevice(rawDek, publicKey);
    expect(wrapped).toHaveLength(DEVICE_RSA_CIPHERTEXT_BYTES);

    const dataKey = await unwrapDeviceDataKey(wrapped, material.privateKey);
    expect(dataKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", dataKey)).rejects.toThrow();

    const aad = utf8("device-bootstrap-test");
    const plaintext = utf8("SUPERSECRET_COURSE_123");
    const encrypted = await encryptBytes(dataKey, plaintext, aad);
    expect(equalBytes(await decryptBytes(dataKey, encrypted, aad), plaintext)).toBe(true);
    rawDek.fill(0);
  });

  test("rejects malformed, private, weak, and oversized public JWK input", async () => {
    const material = await generateDeviceKeyMaterial();
    const cases = [
      null,
      { ...material.publicJwk, d: "private-material" },
      { ...material.publicJwk, alg: "RSA-OAEP" },
      { ...material.publicJwk, e: "Aw" },
      { ...material.publicJwk, n: "AQAB" },
      { ...material.publicJwk, key_ops: ["verify"] },
      { ...material.publicJwk, padding: "x".repeat(3_000) },
    ];
    for (const candidate of cases) expect(() => validateDevicePublicJwk(candidate)).toThrow();
  });

  test("fails closed for a corrupted device-wrapped DEK", async () => {
    const material = await generateDeviceKeyMaterial();
    const publicKey = await importDevicePublicKey(material.publicJwk);
    const wrapped = await wrapRawDataKeyForDevice(
      crypto.getRandomValues(new Uint8Array(32)),
      publicKey,
    );
    wrapped[0] ^= 1;
    await expect(unwrapDeviceDataKey(wrapped, material.privateKey)).rejects.toThrow(
      "Device key unwrap failed",
    );
  });
});

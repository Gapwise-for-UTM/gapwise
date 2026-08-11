import { describe, expect, test } from "bun:test";
import {
  AVAILABILITY_SCHEMA_VERSION,
  CRYPTO_VERSION,
  KEY_VERSION,
} from "@/features/security/crypto-context";
import { generateDeviceKeyMaterial, unwrapDeviceDataKey } from "@/features/security/device-keys";
import {
  decryptBytes,
  encryptBytes,
  encryptJsonRecord,
  importAes256Key,
  wrapDataEncryptionKey,
} from "@/features/security/envelope-crypto";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToByteaHex,
  equalBytes,
  utf8,
} from "@/features/security/encoding";
import {
  decryptCommonGapMaterial,
  parseCommonGapBody,
  type FriendCapsuleMaterial,
} from "@/server/private-cloud/common-gap";
import { readBearerToken } from "@/server/private-cloud/auth";
import {
  errorResponse,
  handleJsonPost,
  jsonResponse,
  MAX_API_RESPONSE_BYTES,
} from "@/server/private-cloud/http";
import { loadKek, readActiveKekVersion, type KeyEnvelopeRow } from "@/server/private-cloud/kek";
import {
  confirmRotatedEnvelope,
  rewrapEnvelopeToKek,
  wrapEnvelopeKeysForDevice,
} from "@/server/private-cloud/key-broker";

const SUBJECT_A = "10000000-0000-4000-8000-000000000101";
const SUBJECT_B = "10000000-0000-4000-8000-000000000102";
const PRIVATE_KEY_A = "20000000-0000-4000-8000-000000000101";
const PRIVATE_KEY_B = "20000000-0000-4000-8000-000000000102";
const AVAILABILITY_KEY_A = "30000000-0000-4000-8000-000000000101";
const AVAILABILITY_KEY_B = "30000000-0000-4000-8000-000000000102";
const CAPSULE_A = "40000000-0000-4000-8000-000000000101";
const CAPSULE_B = "40000000-0000-4000-8000-000000000102";
const FRIENDSHIP_ID = "50000000-0000-4000-8000-000000000101";
const KEK_VERSION = 7;

const rawKek = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const nextRawKek = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);
const privateDekA = Uint8Array.from({ length: 32 }, (_, index) => index + 11);
const privateDekB = Uint8Array.from({ length: 32 }, (_, index) => index + 21);
const availabilityDekA = Uint8Array.from({ length: 32 }, (_, index) => index + 31);
const availabilityDekB = Uint8Array.from({ length: 32 }, (_, index) => index + 41);

async function storedEnvelope(
  subjectId: string,
  privateKeyId: string,
  availabilityKeyId: string,
  privateDek: Uint8Array,
  availabilityDek: Uint8Array,
): Promise<KeyEnvelopeRow> {
  const kek = await importAes256Key(rawKek, false);
  const [privateWrapped, availabilityWrapped] = await Promise.all([
    wrapDataEncryptionKey(kek, privateDek, {
      cryptoVersion: CRYPTO_VERSION,
      purpose: "private-data",
      subjectId,
      keyId: privateKeyId,
      keyVersion: KEY_VERSION,
      kekVersion: KEK_VERSION,
    }),
    wrapDataEncryptionKey(kek, availabilityDek, {
      cryptoVersion: CRYPTO_VERSION,
      purpose: "friend-availability",
      subjectId,
      keyId: availabilityKeyId,
      keyVersion: KEY_VERSION,
      kekVersion: KEK_VERSION,
    }),
  ]);
  return {
    user_id: "00000000-0000-4000-8000-000000000101",
    subject_id: subjectId,
    private_data_key_id: privateKeyId,
    private_data_wrapped_dek: bytesToByteaHex(privateWrapped.ciphertext),
    private_data_wrap_nonce: bytesToByteaHex(privateWrapped.nonce),
    friend_availability_key_id: availabilityKeyId,
    friend_availability_wrapped_dek: bytesToByteaHex(availabilityWrapped.ciphertext),
    friend_availability_wrap_nonce: bytesToByteaHex(availabilityWrapped.nonce),
    crypto_version: CRYPTO_VERSION,
    key_version: KEY_VERSION,
    kek_version: KEK_VERSION,
    created_at: "2026-08-11T00:00:00.000Z",
    updated_at: "2026-08-11T00:00:00.000Z",
  };
}

const testKekLoader = async (version: number) => {
  if (version !== KEK_VERSION) throw new Error("Unknown test KEK.");
  return importAes256Key(rawKek, false);
};

const rotationKekLoader = async (version: number) => {
  if (version === KEK_VERSION) return importAes256Key(rawKek, false);
  if (version === KEK_VERSION + 1) return importAes256Key(nextRawKek, false);
  throw new Error("Unknown test KEK.");
};

async function capsuleMaterial(
  participant: "caller" | "friend",
  subjectId: string,
  privateKeyId: string,
  availabilityKeyId: string,
  capsuleId: string,
  privateDek: Uint8Array,
  availabilityDek: Uint8Array,
  windows: Array<{ weekday: "Monday"; startMinute: number; endMinute: number }>,
): Promise<FriendCapsuleMaterial> {
  const envelope = await storedEnvelope(
    subjectId,
    privateKeyId,
    availabilityKeyId,
    privateDek,
    availabilityDek,
  );
  const key = await importAes256Key(availabilityDek, false);
  const capsule = {
    schemaVersion: AVAILABILITY_SCHEMA_VERSION,
    terms: { Fall: windows, Winter: [], Summer: [] },
  };
  const encrypted = await encryptJsonRecord(key, capsule, {
    cryptoVersion: CRYPTO_VERSION,
    schemaVersion: AVAILABILITY_SCHEMA_VERSION,
    purpose: "friend-availability",
    subjectId,
    recordId: capsuleId,
    keyId: availabilityKeyId,
    revision: 1,
  });
  return {
    participant,
    subject_id: subjectId,
    key_id: availabilityKeyId,
    wrapped_dek: envelope.friend_availability_wrapped_dek,
    wrap_nonce: envelope.friend_availability_wrap_nonce,
    kek_version: KEK_VERSION,
    key_version: KEY_VERSION,
    crypto_version: CRYPTO_VERSION,
    capsule_id: capsuleId,
    capsule_ciphertext: bytesToByteaHex(encrypted.ciphertext),
    capsule_nonce: bytesToByteaHex(encrypted.nonce),
    capsule_schema_version: AVAILABILITY_SCHEMA_VERSION,
    capsule_revision: 1,
  };
}

describe("private-cloud Vercel request boundary", () => {
  test("fails closed before emitting an oversized JSON response", async () => {
    const response = jsonResponse({ value: "x".repeat(MAX_API_RESPONSE_BYTES) });
    expect(response.status).toBe(503);
    expect(new TextEncoder().encode(await response.text()).byteLength).toBeLessThanOrEqual(
      MAX_API_RESPONSE_BYTES,
    );
  });

  test("keeps unexpected server errors out of responses and logs", async () => {
    const distinctiveSecret = "DISTINCTIVE-PRIVATE-ERROR-CONTEXT-918";
    const logs: string[] = [];
    const originalError = console.error;
    console.error = (...values: unknown[]) => logs.push(values.map(String).join(" "));
    try {
      const response = errorResponse(new Error(distinctiveSecret));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain(distinctiveSecret);
    } finally {
      console.error = originalError;
    }
    expect(logs.join(" ")).not.toContain(distinctiveSecret);
  });

  test("accepts only a small same-origin JSON POST", async () => {
    const request = new Request("https://gapwise.example/api/test", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://gapwise.example" },
      body: JSON.stringify({ ok: true }),
    });
    const response = await handleJsonPost(request, async (body) => body);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  test("rejects cross-origin, non-JSON, non-POST, and oversized input", async () => {
    const cases = [
      new Request("https://gapwise.example/api/test", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: "{}",
      }),
      new Request("https://gapwise.example/api/test", {
        method: "POST",
        headers: { "content-type": "text/plain", origin: "https://gapwise.example" },
        body: "{}",
      }),
      new Request("https://gapwise.example/api/test", { method: "GET" }),
      new Request("https://gapwise.example/api/test", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://gapwise.example" },
        body: JSON.stringify({ padding: "x".repeat(9_000) }),
      }),
    ];
    for (const request of cases) {
      const response = await handleJsonPost(request, async () => ({ leaked: true }));
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await response.text()).not.toContain("leaked");
    }
  });

  test("requires the fixed common-gap request shape", () => {
    expect(parseCommonGapBody({ friendshipId: FRIENDSHIP_ID, term: "Fall" })).toEqual({
      friendshipId: FRIENDSHIP_ID,
      term: "Fall",
    });
    expect(() =>
      parseCommonGapBody({ friendshipId: FRIENDSHIP_ID, term: "Fall", startMinute: 600 }),
    ).toThrow();
    expect(() => parseCommonGapBody({ friendshipId: FRIENDSHIP_ID, term: "Spring" })).toThrow();
  });

  test("accepts only a strict bearer authorization value", () => {
    expect(
      readBearerToken(
        new Request("https://gapwise.example/api/test", {
          headers: { authorization: "Bearer header.payload.signature" },
        }),
      ),
    ).toBe("header.payload.signature");
    for (const authorization of [
      "",
      "bearer header.payload.signature",
      "Bearer  header.payload.signature",
      `Bearer ${"x".repeat(9_000)}`,
    ]) {
      expect(() =>
        readBearerToken(
          new Request("https://gapwise.example/api/test", { headers: { authorization } }),
        ),
      ).toThrow("Authentication required");
    }
  });
});

describe("versioned Vercel KEK handling", () => {
  test("loads only an exact 256-bit base64url sensitive value", async () => {
    const environment = {
      GAPWISE_ACTIVE_KEK_VERSION: String(KEK_VERSION),
      [`GAPWISE_KEK_V${KEK_VERSION}`]: bytesToBase64Url(rawKek),
    };
    expect(readActiveKekVersion(environment)).toBe(KEK_VERSION);
    const key = await loadKek(KEK_VERSION, environment);
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  });

  test("rejects missing, short, padded, and whitespace-altered KEKs", async () => {
    expect(() => readActiveKekVersion({ GAPWISE_ACTIVE_KEK_VERSION: "0" })).toThrow();
    await expect(loadKek(KEK_VERSION, {})).rejects.toThrow();
    await expect(
      loadKek(KEK_VERSION, { [`GAPWISE_KEK_V${KEK_VERSION}`]: bytesToBase64Url(rawKek.slice(1)) }),
    ).rejects.toThrow();
    await expect(
      loadKek(KEK_VERSION, { [`GAPWISE_KEK_V${KEK_VERSION}`]: `${bytesToBase64Url(rawKek)} ` }),
    ).rejects.toThrow();
    await expect(
      loadKek(KEK_VERSION, { [`GAPWISE_KEK_V${KEK_VERSION}`]: `${bytesToBase64Url(rawKek)}=` }),
    ).rejects.toThrow();
  });
});

describe("key broker cryptographic boundary", () => {
  test("returns only device-wrapped, non-extractable data keys", async () => {
    const envelope = await storedEnvelope(
      SUBJECT_A,
      PRIVATE_KEY_A,
      AVAILABILITY_KEY_A,
      privateDekA,
      availabilityDekA,
    );
    const device = await generateDeviceKeyMaterial();
    const bundle = await wrapEnvelopeKeysForDevice(envelope, device.publicJwk, testKekLoader);
    expect(Object.keys(bundle).sort()).toEqual([
      "cryptoVersion",
      "friendAvailability",
      "keyVersion",
      "privateData",
      "subjectId",
    ]);
    expect(JSON.stringify(bundle)).not.toContain(envelope.private_data_wrapped_dek);
    expect(JSON.stringify(bundle)).not.toContain(envelope.friend_availability_wrapped_dek);

    const privateKey = await unwrapDeviceDataKey(
      base64UrlToBytes(bundle.privateData.wrappedDek),
      device.privateKey,
    );
    const availabilityKey = await unwrapDeviceDataKey(
      base64UrlToBytes(bundle.friendAvailability.wrappedDek),
      device.privateKey,
    );
    expect(privateKey.extractable).toBe(false);
    expect(availabilityKey.extractable).toBe(false);

    const aad = utf8("broker-key-equivalence");
    const plaintext = utf8("SUPERSECRET_COURSE_123");
    const encrypted = await encryptBytes(await importAes256Key(privateDekA), plaintext, aad);
    expect(equalBytes(await decryptBytes(privateKey, encrypted, aad), plaintext)).toBe(true);
  });

  test("fails closed when envelope context is transplanted", async () => {
    const envelope = await storedEnvelope(
      SUBJECT_A,
      PRIVATE_KEY_A,
      AVAILABILITY_KEY_A,
      privateDekA,
      availabilityDekA,
    );
    const device = await generateDeviceKeyMaterial();
    await expect(
      wrapEnvelopeKeysForDevice(
        { ...envelope, subject_id: SUBJECT_B },
        device.publicJwk,
        testKekLoader,
      ),
    ).rejects.toThrow("authentication failed");
  });

  test("verifies higher-version rewraps without changing either DEK", async () => {
    const envelope = await storedEnvelope(
      SUBJECT_A,
      PRIVATE_KEY_A,
      AVAILABILITY_KEY_A,
      privateDekA,
      availabilityDekA,
    );
    const rotated = await rewrapEnvelopeToKek(envelope, KEK_VERSION + 1, rotationKekLoader);
    expect(rotated.newKekVersion).toBe(KEK_VERSION + 1);
    expect(rotated.privateDataWrappedDek).not.toBe(envelope.private_data_wrapped_dek);
    expect(rotated.friendAvailabilityWrappedDek).not.toBe(envelope.friend_availability_wrapped_dek);

    const rotatedEnvelope = {
      ...envelope,
      private_data_wrapped_dek: rotated.privateDataWrappedDek,
      private_data_wrap_nonce: rotated.privateDataWrapNonce,
      friend_availability_wrapped_dek: rotated.friendAvailabilityWrappedDek,
      friend_availability_wrap_nonce: rotated.friendAvailabilityWrapNonce,
      kek_version: rotated.newKekVersion,
    };
    const device = await generateDeviceKeyMaterial();
    const bundle = await wrapEnvelopeKeysForDevice(
      rotatedEnvelope,
      device.publicJwk,
      rotationKekLoader,
    );
    const devicePrivateKey = await unwrapDeviceDataKey(
      base64UrlToBytes(bundle.privateData.wrappedDek),
      device.privateKey,
    );
    const aad = utf8("rotated-broker-key-equivalence");
    const plaintext = utf8("PRIVATE_ROOM_987");
    const encrypted = await encryptBytes(await importAes256Key(privateDekA), plaintext, aad);
    expect(equalBytes(await decryptBytes(devicePrivateKey, encrypted, aad), plaintext)).toBe(true);
  });

  test("never rotates a key envelope backward or in place", async () => {
    const envelope = await storedEnvelope(
      SUBJECT_A,
      PRIVATE_KEY_A,
      AVAILABILITY_KEY_A,
      privateDekA,
      availabilityDekA,
    );
    await expect(rewrapEnvelopeToKek(envelope, KEK_VERSION, rotationKekLoader)).rejects.toThrow(
      "higher version",
    );
    await expect(rewrapEnvelopeToKek(envelope, KEK_VERSION - 1, rotationKekLoader)).rejects.toThrow(
      "higher version",
    );
  });

  test("accepts a concurrent rotation only after the active envelope is confirmed", async () => {
    const envelope = await storedEnvelope(
      SUBJECT_A,
      PRIVATE_KEY_A,
      AVAILABILITY_KEY_A,
      privateDekA,
      availabilityDekA,
    );
    const concurrent = { ...envelope, kek_version: KEK_VERSION + 1 };
    expect(confirmRotatedEnvelope(concurrent, KEK_VERSION + 1, new Error("CAS lost"))).toBe(
      concurrent,
    );
    expect(() => confirmRotatedEnvelope(envelope, KEK_VERSION + 1, new Error("CAS lost"))).toThrow(
      "rotation failed",
    );
  });
});

describe("common-gap cryptographic boundary", () => {
  test("decrypts only two lossy capsules and returns the bounded intersection", async () => {
    const rows = await Promise.all([
      capsuleMaterial(
        "caller",
        SUBJECT_A,
        PRIVATE_KEY_A,
        AVAILABILITY_KEY_A,
        CAPSULE_A,
        privateDekA,
        availabilityDekA,
        [{ weekday: "Monday", startMinute: 630, endMinute: 780 }],
      ),
      capsuleMaterial(
        "friend",
        SUBJECT_B,
        PRIVATE_KEY_B,
        AVAILABILITY_KEY_B,
        CAPSULE_B,
        privateDekB,
        availabilityDekB,
        [{ weekday: "Monday", startMinute: 660, endMinute: 750 }],
      ),
    ]);
    const windows = await decryptCommonGapMaterial(rows, "Fall", testKekLoader);
    expect(windows).toEqual([{ weekday: "Monday", startMinute: 660, endMinute: 750 }]);
    expect(Object.keys(windows[0]!).sort()).toEqual(["endMinute", "startMinute", "weekday"]);
  });

  test("returns no oracle result without exactly two authorized rows", async () => {
    expect(await decryptCommonGapMaterial([], "Fall", testKekLoader)).toEqual([]);
    const caller = await capsuleMaterial(
      "caller",
      SUBJECT_A,
      PRIVATE_KEY_A,
      AVAILABILITY_KEY_A,
      CAPSULE_A,
      privateDekA,
      availabilityDekA,
      [],
    );
    await expect(decryptCommonGapMaterial([caller], "Fall", testKekLoader)).rejects.toThrow(
      "malformed",
    );
  });

  test("rejects capsule ciphertext and AAD tampering", async () => {
    const rows = await Promise.all([
      capsuleMaterial(
        "caller",
        SUBJECT_A,
        PRIVATE_KEY_A,
        AVAILABILITY_KEY_A,
        CAPSULE_A,
        privateDekA,
        availabilityDekA,
        [],
      ),
      capsuleMaterial(
        "friend",
        SUBJECT_B,
        PRIVATE_KEY_B,
        AVAILABILITY_KEY_B,
        CAPSULE_B,
        privateDekB,
        availabilityDekB,
        [],
      ),
    ]);
    const ciphertext = rows[0]!.capsule_ciphertext;
    const tamperedCiphertext = `${ciphertext.slice(0, -1)}${ciphertext.endsWith("0") ? "1" : "0"}`;
    await expect(
      decryptCommonGapMaterial(
        [{ ...rows[0]!, capsule_ciphertext: tamperedCiphertext }, rows[1]!],
        "Fall",
        testKekLoader,
      ),
    ).rejects.toThrow("authentication failed");

    const revisionTamperedRows: FriendCapsuleMaterial[] = [
      rows[0]!,
      { ...rows[1]!, capsule_revision: 2 },
    ];
    await expect(
      decryptCommonGapMaterial(revisionTamperedRows, "Fall", testKekLoader),
    ).rejects.toThrow("authentication failed");
  });
});

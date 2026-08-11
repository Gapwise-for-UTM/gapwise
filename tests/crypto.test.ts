import { describe, expect, test } from "bun:test";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import {
  AVAILABILITY_SCHEMA_VERSION,
  CRYPTO_VERSION,
  KEY_VERSION,
  PRIVATE_DATA_SCHEMA_VERSION,
  UnsupportedCryptoVersionError,
  type EncryptedRecordContext,
  type KeyEnvelopeContext,
} from "@/features/security/crypto-context";
import {
  decryptJsonRecord,
  encryptJsonRecord,
  generateDataEncryptionKey,
  importAes256Key,
  unwrapDataEncryptionKey,
  wrapDataEncryptionKey,
} from "@/features/security/envelope-crypto";
import {
  createPrivateDataPayload,
  validatePrivateDataPayload,
} from "@/features/security/private-data";
import { validateAvailabilityCapsule } from "@/features/security/availability-capsule";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import { equalBytes } from "@/features/security/encoding";
import { meeting } from "./fixtures";

const SUBJECT_ID = "10000000-0000-4000-8000-000000000001";
const RECORD_ID = "20000000-0000-4000-8000-000000000002";
const PRIVATE_KEY_ID = "30000000-0000-4000-8000-000000000003";
const AVAILABILITY_KEY_ID = "40000000-0000-4000-8000-000000000004";

function privateContext(overrides: Partial<EncryptedRecordContext> = {}): EncryptedRecordContext {
  return {
    cryptoVersion: CRYPTO_VERSION,
    schemaVersion: PRIVATE_DATA_SCHEMA_VERSION,
    purpose: "private-data",
    subjectId: SUBJECT_ID,
    recordId: RECORD_ID,
    keyId: PRIVATE_KEY_ID,
    revision: 1,
    ...overrides,
  };
}

function envelopeContext(overrides: Partial<KeyEnvelopeContext> = {}): KeyEnvelopeContext {
  return {
    cryptoVersion: CRYPTO_VERSION,
    purpose: "private-data",
    subjectId: SUBJECT_ID,
    keyId: PRIVATE_KEY_ID,
    keyVersion: KEY_VERSION,
    kekVersion: 1,
    ...overrides,
  };
}

function tamper(value: Uint8Array, index: number): Uint8Array {
  const changed = value.slice();
  changed[index] ^= 1;
  return changed;
}

describe("versioned private-data encryption", () => {
  test("rejects private payload creation above the personal-item cap", () => {
    const personalItem = {
      id: "private-item",
      title: "Private item",
      category: "Personal" as const,
      term: "Fall" as const,
      weekday: "Monday" as const,
      startTime: 780,
      endTime: 840,
      flexibility: { kind: "fixed" as const },
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
    };
    expect(() =>
      createPrivateDataPayload({
        schedule: [meeting()],
        personalItems: Array.from({ length: 201 }, (_, index) => ({
          ...personalItem,
          id: `private-item-${index}`,
        })),
        preferences: DEFAULT_USER_PREFERENCES,
        gapPreferences: DEFAULT_GAP_PREFERENCES,
      }),
    ).toThrow("personal item cap");
  });

  test("roundtrips schedule, private settings, and custom events", async () => {
    const key = await generateDataEncryptionKey();
    const payload = createPrivateDataPayload({
      schedule: [meeting({ courseCode: "SUPERSECRET_COURSE_123", room: "PRIVATE_ROOM_987" })],
      personalItems: [
        {
          id: "private-1",
          title: "SECRET_EVENT_246",
          category: "Personal",
          term: "Fall",
          weekday: "Monday",
          startTime: 780,
          endTime: 840,
          locationBuildingCode: "MN",
          locationRoom: "PRIVATE_ROOM_987",
          notes: "private notes",
          flexibility: { kind: "fixed" },
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z",
        },
      ],
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        dayOrigin: "residence",
        residenceBuildingCode: "OPH",
      },
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const encrypted = await encryptJsonRecord(key, payload, privateContext());
    const restored = await decryptJsonRecord(
      key,
      encrypted,
      privateContext(),
      validatePrivateDataPayload,
    );

    expect(restored).toEqual(payload);
    const storedText = [...encrypted.ciphertext].map((byte) => String.fromCharCode(byte)).join("");
    expect(storedText).not.toContain("SUPERSECRET_COURSE_123");
    expect(storedText).not.toContain("PRIVATE_ROOM_987");
    expect(storedText).not.toContain("SECRET_EVENT_246");
  });

  test("roundtrips a separately encrypted availability capsule", async () => {
    const key = await generateDataEncryptionKey();
    const capsule = {
      schemaVersion: AVAILABILITY_SCHEMA_VERSION,
      terms: {
        Fall: [{ weekday: "Monday" as const, startMinute: 630, endMinute: 720 }],
        Winter: [],
        Summer: [],
      },
    };
    const context = privateContext({
      schemaVersion: AVAILABILITY_SCHEMA_VERSION,
      purpose: "friend-availability",
      keyId: AVAILABILITY_KEY_ID,
    });
    const encrypted = await encryptJsonRecord(key, capsule, context);
    expect(
      await decryptJsonRecord(key, encrypted, context, validateAvailabilityCapsule, 8 * 1024),
    ).toEqual(capsule);
  });

  test("uses a fresh nonce for every encryption", async () => {
    const key = await generateDataEncryptionKey();
    const payload = createPrivateDataPayload({
      schedule: [meeting()],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const first = await encryptJsonRecord(key, payload, privateContext());
    const second = await encryptJsonRecord(key, payload, privateContext());
    expect(equalBytes(first.nonce, second.nonce)).toBe(false);
    expect(equalBytes(first.ciphertext, second.ciphertext)).toBe(false);
  });

  test("rejects ciphertext and authentication-tag tampering", async () => {
    const key = await generateDataEncryptionKey();
    const encrypted = await encryptJsonRecord(key, { value: "secret" }, privateContext());
    await expect(
      decryptJsonRecord(
        key,
        { ...encrypted, ciphertext: tamper(encrypted.ciphertext, 0) },
        privateContext(),
        (value) => value,
      ),
    ).rejects.toThrow("authentication failed");
    await expect(
      decryptJsonRecord(
        key,
        {
          ...encrypted,
          ciphertext: tamper(encrypted.ciphertext, encrypted.ciphertext.length - 1),
        },
        privateContext(),
        (value) => value,
      ),
    ).rejects.toThrow("authentication failed");
  });

  test("rejects a wrong nonce, DEK, AAD purpose, record ID, and key ID", async () => {
    const key = await generateDataEncryptionKey();
    const wrongKey = await generateDataEncryptionKey();
    const encrypted = await encryptJsonRecord(key, { value: "secret" }, privateContext());
    const cases: Array<[CryptoKey, typeof encrypted, EncryptedRecordContext]> = [
      [key, { ...encrypted, nonce: tamper(encrypted.nonce, 0) }, privateContext()],
      [wrongKey, encrypted, privateContext()],
      [key, encrypted, privateContext({ purpose: "friend-availability" })],
      [key, encrypted, privateContext({ recordId: "50000000-0000-4000-8000-000000000005" })],
      [key, encrypted, privateContext({ keyId: AVAILABILITY_KEY_ID })],
    ];
    for (const [candidateKey, candidateEncrypted, context] of cases) {
      await expect(
        decryptJsonRecord(candidateKey, candidateEncrypted, context, (value) => value),
      ).rejects.toThrow();
    }
  });

  test("rejects unsupported crypto versions before decryption", async () => {
    const key = await generateDataEncryptionKey();
    const encrypted = await encryptJsonRecord(key, { value: "secret" }, privateContext());
    await expect(
      decryptJsonRecord(key, encrypted, privateContext({ cryptoVersion: 99 }), (value) => value),
    ).rejects.toBeInstanceOf(UnsupportedCryptoVersionError);
  });
});

describe("versioned KEK envelopes", () => {
  test("roundtrips a 256-bit DEK", async () => {
    const kek = await generateDataEncryptionKey();
    const rawDek = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await wrapDataEncryptionKey(kek, rawDek, envelopeContext());
    expect(await unwrapDataEncryptionKey(kek, wrapped, envelopeContext())).toEqual(rawDek);
  });

  test("rejects the wrong KEK and wrong KEK version", async () => {
    const kek = await generateDataEncryptionKey();
    const wrongKek = await generateDataEncryptionKey();
    const rawDek = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await wrapDataEncryptionKey(kek, rawDek, envelopeContext());
    await expect(unwrapDataEncryptionKey(wrongKek, wrapped, envelopeContext())).rejects.toThrow();
    await expect(
      unwrapDataEncryptionKey(kek, wrapped, envelopeContext({ kekVersion: 2 })),
    ).rejects.toThrow();
  });

  test("rejects envelope transplantation across subject, key, and purpose contexts", async () => {
    const kek = await generateDataEncryptionKey();
    const rawDek = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await wrapDataEncryptionKey(kek, rawDek, envelopeContext());
    const transplanted = [
      envelopeContext({ subjectId: "60000000-0000-4000-8000-000000000006" }),
      envelopeContext({ keyId: AVAILABILITY_KEY_ID }),
      envelopeContext({ purpose: "friend-availability" }),
      envelopeContext({ keyVersion: 2 }),
    ];
    for (const context of transplanted) {
      await expect(unwrapDataEncryptionKey(kek, wrapped, context)).rejects.toThrow();
    }
  });

  test("imports only exactly 256-bit AES keys", async () => {
    await expect(importAes256Key(new Uint8Array(31))).rejects.toThrow("exactly 32 bytes");
  });
});

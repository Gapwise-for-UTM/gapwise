import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { deriveAvailabilityCapsule } from "@/features/security/availability-capsule";
import { CRYPTO_VERSION, KEY_VERSION } from "@/features/security/crypto-context";
import { bytesToBase64Url, bytesToByteaHex } from "@/features/security/encoding";
import { generateDataEncryptionKey } from "@/features/security/envelope-crypto";
import { sealAvailabilityCapsule, sealPrivateData } from "@/features/security/local-records";
import { createPrivateDataPayload } from "@/features/security/private-data";
import { createMemorySecurityStore, type StoredDataKeys } from "@/features/security/security-store";
import {
  encryptedRevisionConflicts,
  parseDeviceKeyBundle,
  restoreEncryptedLocalState,
} from "@/features/sync/encrypted-sync-service";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import { meeting } from "./fixtures";

const USER_ID = "00000000-0000-4000-8000-000000000101";
const SUBJECT_ID = "10000000-0000-4000-8000-000000000101";
const PRIVATE_KEY_ID = "20000000-0000-4000-8000-000000000101";
const AVAILABILITY_KEY_ID = "30000000-0000-4000-8000-000000000101";

async function keys(): Promise<StoredDataKeys> {
  return {
    userId: USER_ID,
    cryptoVersion: CRYPTO_VERSION,
    subjectId: SUBJECT_ID,
    privateData: {
      keyId: PRIVATE_KEY_ID,
      keyVersion: KEY_VERSION,
      key: await generateDataEncryptionKey(),
    },
    friendAvailability: {
      keyId: AVAILABILITY_KEY_ID,
      keyVersion: KEY_VERSION,
      key: await generateDataEncryptionKey(),
    },
    createdAt: "2026-08-11T00:00:00.000Z",
  };
}

describe("encrypted client sync boundary", () => {
  test("restores a complete private payload from local non-extractable keys without networking", async () => {
    const store = createMemorySecurityStore();
    const dataKeys = await keys();
    const payload = createPrivateDataPayload({
      schedule: [meeting({ courseCode: "LOCAL101H5" })],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const capsule = deriveAvailabilityCapsule([]);
    const privateRecord = await sealPrivateData({
      userId: USER_ID,
      keys: dataKeys,
      payload,
      revision: 4,
      cloudRevision: 3,
    });
    const capsuleRecord = await sealAvailabilityCapsule({
      userId: USER_ID,
      keys: dataKeys,
      capsule,
      revision: 4,
      cloudRevision: 3,
    });
    await store.putDataKeys(dataKeys);
    await store.putEncryptedRecords(privateRecord, capsuleRecord);

    const restored = await restoreEncryptedLocalState(store, USER_ID);
    expect(restored?.payload).toEqual(payload);
    expect(restored?.payload.schedule[0]?.courseCode).toBe("LOCAL101H5");
    expect(restored?.cloudSyncEnabled).toBe(false);
    expect(dataKeys.privateData.key.extractable).toBe(false);
  });

  test("database ciphertext representation contains no distinctive private fixture strings", async () => {
    const dataKeys = await keys();
    const secrets = [
      "LEAKPROOF401H5",
      "Distinctive Database Leak Proof Seminar",
      "PRIVATE-ROOM-987",
      "Confidential counselling appointment",
      "Only the student should read this note",
      "Private clinic entrance",
    ];
    const payload = createPrivateDataPayload({
      schedule: [
        meeting({
          id: "private-meeting-246",
          courseCode: secrets[0],
          courseName: secrets[1],
          room: secrets[2],
        }),
      ],
      personalItems: [
        {
          id: "private-item-135",
          title: secrets[3],
          category: "Appointment",
          term: "Fall",
          weekday: "Tuesday",
          startTime: 780,
          endTime: 840,
          locationText: secrets[5],
          notes: secrets[4],
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
    const privateRecord = await sealPrivateData({
      userId: USER_ID,
      keys: dataKeys,
      payload,
      revision: 1,
    });
    const capsuleRecord = await sealAvailabilityCapsule({
      userId: USER_ID,
      keys: dataKeys,
      capsule: deriveAvailabilityCapsule([]),
      revision: 1,
    });

    const databaseRepresentation = JSON.stringify({
      encrypted_private_data: {
        user_id: USER_ID,
        subject_id: privateRecord.subjectId,
        record_id: privateRecord.recordId,
        key_id: privateRecord.keyId,
        crypto_version: privateRecord.cryptoVersion,
        schema_version: privateRecord.schemaVersion,
        revision: privateRecord.revision,
        ciphertext: bytesToByteaHex(privateRecord.encrypted.ciphertext),
        nonce: bytesToByteaHex(privateRecord.encrypted.nonce),
      },
      encrypted_friend_availability: {
        user_id: USER_ID,
        subject_id: capsuleRecord.subjectId,
        capsule_id: capsuleRecord.recordId,
        key_id: capsuleRecord.keyId,
        crypto_version: capsuleRecord.cryptoVersion,
        schema_version: capsuleRecord.schemaVersion,
        revision: capsuleRecord.revision,
        ciphertext: bytesToByteaHex(capsuleRecord.encrypted.ciphertext),
        nonce: bytesToByteaHex(capsuleRecord.encrypted.nonce),
      },
    });
    for (const secret of secrets) expect(databaseRepresentation).not.toContain(secret);
    expect(databaseRepresentation).not.toContain('"residenceBuildingCode":"OPH"');

    const store = createMemorySecurityStore();
    await store.putDataKeys(dataKeys);
    await store.putEncryptedRecords(privateRecord, capsuleRecord);
    expect((await restoreEncryptedLocalState(store, USER_ID))?.payload).toEqual(payload);
  });

  test("fails closed when either local ciphertext record is tampered", async () => {
    const store = createMemorySecurityStore();
    const dataKeys = await keys();
    const payload = createPrivateDataPayload({
      schedule: [meeting()],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const privateRecord = await sealPrivateData({
      userId: USER_ID,
      keys: dataKeys,
      payload,
      revision: 1,
    });
    const capsuleRecord = await sealAvailabilityCapsule({
      userId: USER_ID,
      keys: dataKeys,
      capsule: deriveAvailabilityCapsule([]),
      revision: 1,
    });
    capsuleRecord.encrypted.ciphertext[0] ^= 1;
    await store.putDataKeys(dataKeys);
    await store.putEncryptedRecords(privateRecord, capsuleRecord);
    await expect(restoreEncryptedLocalState(store, USER_ID)).rejects.toThrow(
      "authentication failed",
    );
  });

  test("fails closed instead of restoring an incomplete local record pair", async () => {
    const store = createMemorySecurityStore();
    const dataKeys = await keys();
    const privateRecord = await sealPrivateData({
      userId: USER_ID,
      keys: dataKeys,
      payload: createPrivateDataPayload({
        schedule: [meeting()],
        personalItems: [],
        preferences: DEFAULT_USER_PREFERENCES,
        gapPreferences: DEFAULT_GAP_PREFERENCES,
      }),
      revision: 1,
    });
    await store.putDataKeys(dataKeys);
    await store.putPrivateRecord(privateRecord);
    await expect(restoreEncryptedLocalState(store, USER_ID)).rejects.toThrow("incomplete");
  });

  test("tracks the last verified cloud revision instead of confusing it with local edits", () => {
    expect(encryptedRevisionConflicts({ cloudRevision: 3 }, { revision: 3 })).toBe(false);
    expect(encryptedRevisionConflicts({ cloudRevision: 3 }, { revision: 4 })).toBe(true);
    expect(encryptedRevisionConflicts({ cloudRevision: null }, { revision: 1 })).toBe(true);
    expect(encryptedRevisionConflicts({ cloudRevision: 3 }, null)).toBe(true);
    expect(encryptedRevisionConflicts({ cloudRevision: null }, null)).toBe(false);
  });

  test("preflights only context metadata before the final ciphertext verification read", async () => {
    const source = await readFile("src/features/sync/encrypted-sync-service.ts", "utf8");
    const start = source.indexOf("async function loadCloudMetadata");
    const end = source.indexOf("function validatePrivateMetadata", start);
    const metadataRead = source.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(metadataRead).toContain("crypto_version, schema_version, revision");
    expect(metadataRead).not.toContain("ciphertext");
    expect(metadataRead).not.toContain("nonce");
  });

  test("accepts only the fixed device-wrapped key response contract", () => {
    const wrappedDek = bytesToBase64Url(new Uint8Array(256));
    const bundle = {
      cryptoVersion: CRYPTO_VERSION,
      keyVersion: KEY_VERSION,
      subjectId: SUBJECT_ID,
      privateData: { keyId: PRIVATE_KEY_ID, wrappedDek },
      friendAvailability: { keyId: AVAILABILITY_KEY_ID, wrappedDek },
    };
    expect(parseDeviceKeyBundle(bundle)).toEqual(bundle);
    expect(() => parseDeviceKeyBundle({ ...bundle, rawDek: "forbidden" })).toThrow();
    expect(() =>
      parseDeviceKeyBundle({ ...bundle, privateData: { keyId: PRIVATE_KEY_ID, wrappedDek: "AA" } }),
    ).toThrow();
  });

  test("commits the two local ciphertext records atomically for one owner", async () => {
    const store = createMemorySecurityStore();
    const dataKeys = await keys();
    const payload = createPrivateDataPayload({
      schedule: [meeting()],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const privateRecord = await sealPrivateData({
      userId: USER_ID,
      keys: dataKeys,
      payload,
      revision: 1,
    });
    const capsuleRecord = await sealAvailabilityCapsule({
      userId: USER_ID,
      keys: dataKeys,
      capsule: deriveAvailabilityCapsule([]),
      revision: 1,
    });
    await expect(
      store.putEncryptedRecords(privateRecord, {
        ...capsuleRecord,
        userId: "00000000-0000-4000-8000-000000000999",
      }),
    ).rejects.toThrow("owner mismatch");
    expect(await store.getPrivateRecord(USER_ID)).toBeNull();
    expect(await store.getCapsuleRecord(USER_ID)).toBeNull();
  });
});

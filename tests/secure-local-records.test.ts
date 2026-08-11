import { describe, expect, test } from "bun:test";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { deriveAvailabilityCapsule } from "@/features/security/availability-capsule";
import { CRYPTO_VERSION, KEY_VERSION } from "@/features/security/crypto-context";
import { generateDataEncryptionKey } from "@/features/security/envelope-crypto";
import {
  openAvailabilityCapsule,
  openPrivateData,
  sealAvailabilityCapsule,
  sealPrivateData,
} from "@/features/security/local-records";
import { createPrivateDataPayload } from "@/features/security/private-data";
import { createMemorySecurityStore, type StoredDataKeys } from "@/features/security/security-store";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import { meeting } from "./fixtures";

const USER_A = "user-a";
const USER_B = "user-b";
const SUBJECT_A = "10000000-0000-4000-8000-000000000001";
const SUBJECT_B = "20000000-0000-4000-8000-000000000002";

async function dataKeys(userId = USER_A, subjectId = SUBJECT_A): Promise<StoredDataKeys> {
  return {
    userId,
    cryptoVersion: CRYPTO_VERSION,
    subjectId,
    privateData: {
      keyId: "30000000-0000-4000-8000-000000000003",
      keyVersion: KEY_VERSION,
      key: await generateDataEncryptionKey(),
    },
    friendAvailability: {
      keyId: "40000000-0000-4000-8000-000000000004",
      keyVersion: KEY_VERSION,
      key: await generateDataEncryptionKey(),
    },
    createdAt: "2026-08-11T00:00:00.000Z",
  };
}

describe("encrypted local-first records", () => {
  test("roundtrips private state and availability with non-extractable keys", async () => {
    const keys = await dataKeys();
    const payload = createPrivateDataPayload({
      schedule: [meeting({ courseCode: "SUPERSECRET_COURSE_123" })],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const capsule = deriveAvailabilityCapsule([
      { term: "Fall", weekday: "Monday", startMinute: 540, endMinute: 600 },
      { term: "Fall", weekday: "Monday", startMinute: 720, endMinute: 780 },
    ]);
    const privateRecord = await sealPrivateData({ userId: USER_A, keys, payload, revision: 1 });
    const capsuleRecord = await sealAvailabilityCapsule({
      userId: USER_A,
      keys,
      capsule,
      revision: 1,
    });
    const store = createMemorySecurityStore();
    await store.putDataKeys(keys);
    await store.putPrivateRecord(privateRecord);
    await store.putCapsuleRecord(capsuleRecord);

    expect(await openPrivateData(keys, (await store.getPrivateRecord(USER_A))!)).toEqual(payload);
    expect(await openAvailabilityCapsule(keys, (await store.getCapsuleRecord(USER_A))!)).toEqual(
      capsule,
    );
    expect(keys.privateData.key.extractable).toBe(false);
    expect(keys.friendAvailability.key.extractable).toBe(false);
  });

  test("preserves record ID across revisions and rejects stale context tampering", async () => {
    const keys = await dataKeys();
    const payload = createPrivateDataPayload({
      schedule: [meeting()],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const first = await sealPrivateData({ userId: USER_A, keys, payload, revision: 1 });
    const second = await sealPrivateData({
      userId: USER_A,
      keys,
      payload,
      revision: 2,
      recordId: first.recordId,
    });
    expect(second.recordId).toBe(first.recordId);
    await expect(openPrivateData(keys, { ...second, revision: 1 })).rejects.toThrow();
  });

  test("rejects record/key ownership transplantation", async () => {
    const keys = await dataKeys();
    const payload = createPrivateDataPayload({
      schedule: [meeting()],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const record = await sealPrivateData({ userId: USER_A, keys, payload, revision: 1 });
    const otherKeys = await dataKeys(USER_B, SUBJECT_B);
    await expect(openPrivateData(otherKeys, { ...record, userId: USER_B })).rejects.toThrow(
      "context mismatch",
    );
  });

  test("sign-out cleanup removes one user's keys and ciphertext without erasing guest state", async () => {
    const store = createMemorySecurityStore();
    const userKeys = await dataKeys();
    const guestKeys = await dataKeys("guest", SUBJECT_B);
    const payload = createPrivateDataPayload({
      schedule: [meeting()],
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const capsule = deriveAvailabilityCapsule([]);
    await store.putDataKeys(userKeys);
    await store.putDataKeys(guestKeys);
    await store.putEncryptedRecords(
      await sealPrivateData({ userId: USER_A, keys: userKeys, payload, revision: 1 }),
      await sealAvailabilityCapsule({
        userId: USER_A,
        keys: userKeys,
        capsule,
        revision: 1,
      }),
    );
    await store.putEncryptedRecords(
      await sealPrivateData({ userId: "guest", keys: guestKeys, payload, revision: 1 }),
      await sealAvailabilityCapsule({
        userId: "guest",
        keys: guestKeys,
        capsule,
        revision: 1,
      }),
    );

    await store.clearUser(USER_A);
    expect(await store.getDataKeys(USER_A)).toBeNull();
    expect(await store.getPrivateRecord(USER_A)).toBeNull();
    expect(await store.getCapsuleRecord(USER_A)).toBeNull();
    expect(await store.getDataKeys("guest")).toBe(guestKeys);
    expect(await store.getPrivateRecord("guest")).not.toBeNull();
    expect(await store.getCapsuleRecord("guest")).not.toBeNull();
  });
});

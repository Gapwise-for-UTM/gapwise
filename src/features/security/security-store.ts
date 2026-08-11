import type { EncryptedBytes } from "./envelope-crypto";
import type { AvailabilityCapsuleV1 } from "./availability-capsule";
import type { PrivateDataPayloadV1 } from "./private-data";

const DATABASE_NAME = "gapwise-private-v1";
const DATABASE_VERSION = 1;
const DEVICE_KEYS_STORE = "device-keys";
const DATA_KEYS_STORE = "data-keys";
const PRIVATE_RECORDS_STORE = "private-records";
const CAPSULE_RECORDS_STORE = "capsule-records";
const CRYPTO_PROBE_STORE = "crypto-probe";

export type StoredDeviceKey = {
  userId: string;
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
  createdAt: string;
};

export type StoredDataKeys = {
  userId: string;
  cryptoVersion: number;
  subjectId: string;
  /** True only after a verified cloud save/load; false after explicit cloud deletion. */
  cloudSyncEnabled?: boolean;
  privateData: { keyId: string; keyVersion: number; key: CryptoKey };
  friendAvailability: { keyId: string; keyVersion: number; key: CryptoKey };
  createdAt: string;
};

export type StoredEncryptedRecord<TPurpose extends "private-data" | "friend-availability"> = {
  userId: string;
  purpose: TPurpose;
  cryptoVersion: number;
  schemaVersion: number;
  subjectId: string;
  recordId: string;
  keyId: string;
  revision: number;
  /** Last cloud revision this device observed; null means never verified. */
  cloudRevision: number | null;
  encrypted: EncryptedBytes;
  updatedAt: string;
};

export type StoredPrivateRecord = StoredEncryptedRecord<"private-data">;
export type StoredCapsuleRecord = StoredEncryptedRecord<"friend-availability">;

export type DecryptedLocalState = {
  privateData: PrivateDataPayloadV1;
  capsule: AvailabilityCapsuleV1;
};

export interface SecurityStore {
  getDeviceKey(userId: string): Promise<StoredDeviceKey | null>;
  putDeviceKey(value: StoredDeviceKey): Promise<void>;
  getDataKeys(userId: string): Promise<StoredDataKeys | null>;
  putDataKeys(value: StoredDataKeys): Promise<void>;
  getPrivateRecord(userId: string): Promise<StoredPrivateRecord | null>;
  putPrivateRecord(value: StoredPrivateRecord): Promise<void>;
  getCapsuleRecord(userId: string): Promise<StoredCapsuleRecord | null>;
  putCapsuleRecord(value: StoredCapsuleRecord): Promise<void>;
  putEncryptedRecords(
    privateRecord: StoredPrivateRecord,
    capsuleRecord: StoredCapsuleRecord,
  ): Promise<void>;
  clearUser(userId: string): Promise<void>;
  verifyCryptoKeyPersistence(): Promise<boolean>;
  close(): void;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB failed.")),
      {
        once: true,
      },
    );
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted.")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed.")),
      { once: true },
    );
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener(
      "upgradeneeded",
      () => {
        const database = request.result;
        for (const store of [
          DEVICE_KEYS_STORE,
          DATA_KEYS_STORE,
          PRIVATE_RECORDS_STORE,
          CAPSULE_RECORDS_STORE,
        ]) {
          if (!database.objectStoreNames.contains(store))
            database.createObjectStore(store, { keyPath: "userId" });
        }
        if (!database.objectStoreNames.contains(CRYPTO_PROBE_STORE)) {
          database.createObjectStore(CRYPTO_PROBE_STORE, { keyPath: "id" });
        }
      },
      { once: true },
    );
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB is unavailable.")),
      {
        once: true,
      },
    );
    request.addEventListener("blocked", () => reject(new Error("IndexedDB upgrade is blocked.")), {
      once: true,
    });
  });
}

export async function createIndexedDbSecurityStore(
  factory: IDBFactory | undefined = globalThis.indexedDB,
  cryptoRuntime: Pick<Crypto, "subtle"> | undefined = globalThis.crypto,
): Promise<SecurityStore> {
  if (!factory || !cryptoRuntime?.subtle)
    throw new Error("Secure browser persistence is unavailable.");
  const database = await openDatabase(factory);

  async function get<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    const transaction = database.transaction(storeName, "readonly");
    const result = await requestResult(transaction.objectStore(storeName).get(key));
    await transactionDone(transaction);
    return (result as T | undefined) ?? null;
  }

  async function put<T>(storeName: string, value: T): Promise<void> {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    await transactionDone(transaction);
  }

  async function clearUser(userId: string): Promise<void> {
    const transaction = database.transaction(
      [DEVICE_KEYS_STORE, DATA_KEYS_STORE, PRIVATE_RECORDS_STORE, CAPSULE_RECORDS_STORE],
      "readwrite",
    );
    for (const storeName of [
      DEVICE_KEYS_STORE,
      DATA_KEYS_STORE,
      PRIVATE_RECORDS_STORE,
      CAPSULE_RECORDS_STORE,
    ]) {
      transaction.objectStore(storeName).delete(userId);
    }
    await transactionDone(transaction);
  }

  async function putEncryptedRecords(
    privateRecord: StoredPrivateRecord,
    capsuleRecord: StoredCapsuleRecord,
  ): Promise<void> {
    if (privateRecord.userId !== capsuleRecord.userId) {
      throw new Error("Encrypted local record owner mismatch.");
    }
    const transaction = database.transaction(
      [PRIVATE_RECORDS_STORE, CAPSULE_RECORDS_STORE],
      "readwrite",
    );
    transaction.objectStore(PRIVATE_RECORDS_STORE).put(privateRecord);
    transaction.objectStore(CAPSULE_RECORDS_STORE).put(capsuleRecord);
    await transactionDone(transaction);
  }

  async function verifyCryptoKeyPersistence(): Promise<boolean> {
    const probeId = crypto.randomUUID();
    try {
      const key = await cryptoRuntime.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
        "encrypt",
        "decrypt",
      ]);
      await put(CRYPTO_PROBE_STORE, { id: probeId, key });
      const restored = await get<{ id: string; key: CryptoKey }>(CRYPTO_PROBE_STORE, probeId);
      if (!restored?.key || restored.key.extractable || restored.key.type !== "secret")
        return false;
      try {
        await cryptoRuntime.subtle.exportKey("raw", restored.key);
        return false;
      } catch {
        return true;
      }
    } catch {
      return false;
    } finally {
      try {
        const transaction = database.transaction(CRYPTO_PROBE_STORE, "readwrite");
        transaction.objectStore(CRYPTO_PROBE_STORE).delete(probeId);
        await transactionDone(transaction);
      } catch {
        // The probe is opaque and contains no user data; a failed cleanup is non-fatal.
      }
    }
  }

  return {
    getDeviceKey: (userId) => get(DEVICE_KEYS_STORE, userId),
    putDeviceKey: (value) => put(DEVICE_KEYS_STORE, value),
    getDataKeys: (userId) => get(DATA_KEYS_STORE, userId),
    putDataKeys: (value) => put(DATA_KEYS_STORE, value),
    getPrivateRecord: (userId) => get(PRIVATE_RECORDS_STORE, userId),
    putPrivateRecord: (value) => put(PRIVATE_RECORDS_STORE, value),
    getCapsuleRecord: (userId) => get(CAPSULE_RECORDS_STORE, userId),
    putCapsuleRecord: (value) => put(CAPSULE_RECORDS_STORE, value),
    putEncryptedRecords,
    clearUser,
    verifyCryptoKeyPersistence,
    close: () => database.close(),
  };
}

export function createMemorySecurityStore(): SecurityStore {
  const deviceKeys = new Map<string, StoredDeviceKey>();
  const dataKeys = new Map<string, StoredDataKeys>();
  const privateRecords = new Map<string, StoredPrivateRecord>();
  const capsuleRecords = new Map<string, StoredCapsuleRecord>();
  return {
    getDeviceKey: async (userId) => deviceKeys.get(userId) ?? null,
    putDeviceKey: async (value) => void deviceKeys.set(value.userId, value),
    getDataKeys: async (userId) => dataKeys.get(userId) ?? null,
    putDataKeys: async (value) => void dataKeys.set(value.userId, value),
    getPrivateRecord: async (userId) => privateRecords.get(userId) ?? null,
    putPrivateRecord: async (value) => void privateRecords.set(value.userId, value),
    getCapsuleRecord: async (userId) => capsuleRecords.get(userId) ?? null,
    putCapsuleRecord: async (value) => void capsuleRecords.set(value.userId, value),
    putEncryptedRecords: async (privateRecord, capsuleRecord) => {
      if (privateRecord.userId !== capsuleRecord.userId) {
        throw new Error("Encrypted local record owner mismatch.");
      }
      privateRecords.set(privateRecord.userId, privateRecord);
      capsuleRecords.set(capsuleRecord.userId, capsuleRecord);
    },
    clearUser: async (userId) => {
      deviceKeys.delete(userId);
      dataKeys.delete(userId);
      privateRecords.delete(userId);
      capsuleRecords.delete(userId);
    },
    verifyCryptoKeyPersistence: async () => false,
    close: () => undefined,
  };
}

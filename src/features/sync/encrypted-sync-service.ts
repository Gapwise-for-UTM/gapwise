import type { Tables, TablesInsert, TablesUpdate } from "@/lib/database.types";
import { requireSupabaseClient } from "@/lib/supabase";
import type { PersonalItem } from "@/lib/personal-types";
import {
  AVAILABILITY_SCHEMA_VERSION,
  CRYPTO_VERSION,
  KEY_VERSION,
  PRIVATE_DATA_SCHEMA_VERSION,
} from "@/features/security/crypto-context";
import {
  generateDeviceKeyMaterial,
  unwrapDeviceDataKey,
  validateDevicePublicJwk,
} from "@/features/security/device-keys";
import { base64UrlToBytes, byteaHexToBytes, bytesToByteaHex } from "@/features/security/encoding";
import {
  deriveAvailabilityCapsule,
  type AvailabilityCapsuleV1,
  type BusyEvent,
} from "@/features/security/availability-capsule";
import {
  openAvailabilityCapsule,
  openPrivateData,
  sealAvailabilityCapsule,
  sealPrivateData,
} from "@/features/security/local-records";
import {
  createIndexedDbSecurityStore,
  createMemorySecurityStore,
  type SecurityStore,
  type StoredCapsuleRecord,
  type StoredDataKeys,
  type StoredDeviceKey,
  type StoredPrivateRecord,
} from "@/features/security/security-store";
import {
  createPrivateDataPayload,
  type PrivateDataPayloadV1,
} from "@/features/security/private-data";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import { clearStoredPersonalItems } from "@/features/personal/persistence";
import { clearStoredGapPreferences } from "@/features/gaps/preferences";
import { clearRememberedTimetable } from "@/hooks/use-preferences";
import { clearStoredUserPreferences } from "./preferences";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_BROKER_RESPONSE_BYTES = 8 * 1024;

type EncryptedPrivateRow = Tables<"encrypted_private_data">;
type EncryptedCapsuleRow = Tables<"encrypted_friend_availability">;
type EncryptedPrivateMetadata = Pick<
  EncryptedPrivateRow,
  | "user_id"
  | "subject_id"
  | "record_id"
  | "key_id"
  | "crypto_version"
  | "schema_version"
  | "revision"
>;
type EncryptedCapsuleMetadata = Pick<
  EncryptedCapsuleRow,
  | "user_id"
  | "subject_id"
  | "capsule_id"
  | "key_id"
  | "crypto_version"
  | "schema_version"
  | "revision"
>;

export type PrivateCloudState = Omit<PrivateDataPayloadV1, "schemaVersion">;

export type PrivateCloudRestoration = {
  payload: PrivateDataPayloadV1;
  source: "secure-local" | "cloud";
  updatedAt: string;
  persistentKeys: boolean;
};

type DeviceKeyBundle = {
  cryptoVersion: number;
  friendAvailability: { keyId: string; wrappedDek: string };
  keyVersion: number;
  privateData: { keyId: string; wrappedDek: string };
  subjectId: string;
};

type StoreSelection = { persistent: boolean; store: SecurityStore };

let storeSelectionPromise: Promise<StoreSelection> | null = null;
const optedInUsers = new Set<string>();
const saveQueues = new Map<string, Promise<unknown>>();

function abortIfRequested(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function parseWrappedKey(value: unknown): { keyId: string; wrappedDek: string } {
  if (!isRecord(value) || !exactKeys(value, ["keyId", "wrappedDek"])) {
    throw new Error("Key broker response is malformed.");
  }
  const keyId = value["keyId"];
  const wrappedDek = value["wrappedDek"];
  if (
    typeof keyId !== "string" ||
    !UUID_PATTERN.test(keyId) ||
    typeof wrappedDek !== "string" ||
    base64UrlToBytes(wrappedDek, 256).byteLength !== 256
  ) {
    throw new Error("Key broker response is malformed.");
  }
  return { keyId, wrappedDek };
}

export function parseDeviceKeyBundle(value: unknown): DeviceKeyBundle {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "cryptoVersion",
      "friendAvailability",
      "keyVersion",
      "privateData",
      "subjectId",
    ]) ||
    value["cryptoVersion"] !== CRYPTO_VERSION ||
    value["keyVersion"] !== KEY_VERSION ||
    typeof value["subjectId"] !== "string" ||
    !UUID_PATTERN.test(value["subjectId"])
  ) {
    throw new Error("Key broker response is malformed.");
  }
  return {
    cryptoVersion: CRYPTO_VERSION,
    keyVersion: KEY_VERSION,
    subjectId: value["subjectId"],
    privateData: parseWrappedKey(value["privateData"]),
    friendAvailability: parseWrappedKey(value["friendAvailability"]),
  };
}

async function securityStore(): Promise<StoreSelection> {
  storeSelectionPromise ??= (async () => {
    try {
      const store = await createIndexedDbSecurityStore();
      if (await store.verifyCryptoKeyPersistence()) return { store, persistent: true };
      store.close();
    } catch {
      // Page-lifetime non-extractable keys are the fail-closed fallback.
    }
    return { store: createMemorySecurityStore(), persistent: false };
  })();
  return storeSelectionPromise;
}

function validDataKeys(value: StoredDataKeys | null, userId: string): value is StoredDataKeys {
  const privateAlgorithm = value?.privateData.key.algorithm;
  const availabilityAlgorithm = value?.friendAvailability.key.algorithm;
  return Boolean(
    value &&
    value.userId === userId &&
    value.cryptoVersion === CRYPTO_VERSION &&
    UUID_PATTERN.test(value.subjectId) &&
    value.privateData.keyVersion === KEY_VERSION &&
    UUID_PATTERN.test(value.privateData.keyId) &&
    value.privateData.key.type === "secret" &&
    !value.privateData.key.extractable &&
    privateAlgorithm?.name === "AES-GCM" &&
    value.privateData.key.usages.includes("encrypt") &&
    value.privateData.key.usages.includes("decrypt") &&
    value.friendAvailability.keyVersion === KEY_VERSION &&
    UUID_PATTERN.test(value.friendAvailability.keyId) &&
    value.friendAvailability.key.type === "secret" &&
    !value.friendAvailability.key.extractable &&
    availabilityAlgorithm?.name === "AES-GCM" &&
    value.friendAvailability.key.usages.includes("encrypt") &&
    value.friendAvailability.key.usages.includes("decrypt"),
  );
}

function validDeviceKey(value: StoredDeviceKey | null, userId: string): value is StoredDeviceKey {
  if (
    !value ||
    value.userId !== userId ||
    value.privateKey.type !== "private" ||
    value.privateKey.extractable ||
    !value.privateKey.usages.includes("unwrapKey")
  ) {
    return false;
  }
  try {
    validateDevicePublicJwk(value.publicJwk);
    return true;
  } catch {
    return false;
  }
}

async function sessionForUser(userId: string): Promise<{ accessToken: string }> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) {
    throw new Error("Sign in before using encrypted cloud sync.");
  }
  return { accessToken: data.session.access_token };
}

async function readSmallJson(response: Response): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > MAX_BROKER_RESPONSE_BYTES) {
    throw new Error("Key broker response is too large.");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BROKER_RESPONSE_BYTES) {
    throw new Error("Key broker response is too large.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Key broker response is malformed.");
  }
}

async function deviceKey(store: SecurityStore, userId: string): Promise<StoredDeviceKey> {
  const current = await store.getDeviceKey(userId);
  if (validDeviceKey(current, userId)) return current;
  const generated = await generateDeviceKeyMaterial();
  const value: StoredDeviceKey = {
    userId,
    privateKey: generated.privateKey,
    publicJwk: generated.publicJwk,
    createdAt: new Date().toISOString(),
  };
  await store.putDeviceKey(value);
  return value;
}

async function requestDeviceKeyBundle(
  userId: string,
  device: StoredDeviceKey,
  signal?: AbortSignal,
): Promise<DeviceKeyBundle> {
  const { accessToken } = await sessionForUser(userId);
  abortIfRequested(signal);
  const response = await fetch("/api/key-broker", {
    method: "POST",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
    ...(signal ? { signal } : {}),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ devicePublicKey: device.publicJwk }),
  });
  const body = await readSmallJson(response);
  if (!response.ok) throw new Error("Encrypted key setup is temporarily unavailable.");
  return parseDeviceKeyBundle(body);
}

async function ensureDataKeys(
  store: SecurityStore,
  userId: string,
  signal?: AbortSignal,
): Promise<StoredDataKeys> {
  const current = await store.getDataKeys(userId);
  if (validDataKeys(current, userId)) return current;

  const device = await deviceKey(store, userId);
  const bundle = await requestDeviceKeyBundle(userId, device, signal);
  const [privateDataKey, friendAvailabilityKey] = await Promise.all([
    unwrapDeviceDataKey(base64UrlToBytes(bundle.privateData.wrappedDek, 256), device.privateKey),
    unwrapDeviceDataKey(
      base64UrlToBytes(bundle.friendAvailability.wrappedDek, 256),
      device.privateKey,
    ),
  ]);
  const keys: StoredDataKeys = {
    userId,
    cryptoVersion: bundle.cryptoVersion,
    subjectId: bundle.subjectId,
    cloudSyncEnabled: false,
    privateData: {
      keyId: bundle.privateData.keyId,
      keyVersion: bundle.keyVersion,
      key: privateDataKey,
    },
    friendAvailability: {
      keyId: bundle.friendAvailability.keyId,
      keyVersion: bundle.keyVersion,
      key: friendAvailabilityKey,
    },
    createdAt: new Date().toISOString(),
  };
  if (!validDataKeys(keys, userId)) throw new Error("Device data keys are invalid.");
  await store.putDataKeys(keys);
  return keys;
}

function privateRecordFromRow(userId: string, row: EncryptedPrivateRow): StoredPrivateRecord {
  if (row.user_id !== userId) throw new Error("Encrypted private-data owner mismatch.");
  return {
    userId,
    purpose: "private-data",
    cryptoVersion: row.crypto_version,
    schemaVersion: row.schema_version,
    subjectId: row.subject_id,
    recordId: row.record_id,
    keyId: row.key_id,
    revision: row.revision,
    cloudRevision: row.revision,
    encrypted: {
      ciphertext: byteaHexToBytes(row.ciphertext, 262_160),
      nonce: byteaHexToBytes(row.nonce, 12),
    },
    updatedAt: row.updated_at,
  };
}

function capsuleRecordFromRow(userId: string, row: EncryptedCapsuleRow): StoredCapsuleRecord {
  if (row.user_id !== userId) throw new Error("Encrypted capsule owner mismatch.");
  return {
    userId,
    purpose: "friend-availability",
    cryptoVersion: row.crypto_version,
    schemaVersion: row.schema_version,
    subjectId: row.subject_id,
    recordId: row.capsule_id,
    keyId: row.key_id,
    revision: row.revision,
    cloudRevision: row.revision,
    encrypted: {
      ciphertext: byteaHexToBytes(row.ciphertext, 8_208),
      nonce: byteaHexToBytes(row.nonce, 12),
    },
    updatedAt: row.updated_at,
  };
}

function privateRowFromRecord(record: StoredPrivateRecord): TablesInsert<"encrypted_private_data"> {
  return {
    user_id: record.userId,
    subject_id: record.subjectId,
    record_id: record.recordId,
    key_id: record.keyId,
    ciphertext: bytesToByteaHex(record.encrypted.ciphertext),
    nonce: bytesToByteaHex(record.encrypted.nonce),
    crypto_version: record.cryptoVersion,
    schema_version: record.schemaVersion,
    revision: record.revision,
  };
}

function capsuleRowFromRecord(
  record: StoredCapsuleRecord,
): TablesInsert<"encrypted_friend_availability"> {
  return {
    user_id: record.userId,
    subject_id: record.subjectId,
    capsule_id: record.recordId,
    key_id: record.keyId,
    ciphertext: bytesToByteaHex(record.encrypted.ciphertext),
    nonce: bytesToByteaHex(record.encrypted.nonce),
    crypto_version: record.cryptoVersion,
    schema_version: record.schemaVersion,
    revision: record.revision,
  };
}

export function encryptedRevisionConflicts(
  local: { cloudRevision?: number | null } | null,
  cloud: { revision: number } | null,
): boolean {
  if (cloud) return local?.cloudRevision !== cloud.revision;
  return local?.cloudRevision !== null && local?.cloudRevision !== undefined;
}

async function loadCloudRows(
  userId: string,
  signal?: AbortSignal,
): Promise<{ capsule: EncryptedCapsuleRow | null; privateData: EncryptedPrivateRow | null }> {
  const supabase = requireSupabaseClient();
  let privateQuery = supabase.from("encrypted_private_data").select("*").eq("user_id", userId);
  let capsuleQuery = supabase
    .from("encrypted_friend_availability")
    .select("*")
    .eq("user_id", userId);
  if (signal) {
    privateQuery = privateQuery.abortSignal(signal);
    capsuleQuery = capsuleQuery.abortSignal(signal);
  }
  const [privateResult, capsuleResult] = await Promise.all([
    privateQuery.maybeSingle(),
    capsuleQuery.maybeSingle(),
  ]);
  if (privateResult.error || capsuleResult.error) throw new Error("Encrypted cloud read failed.");
  return { privateData: privateResult.data, capsule: capsuleResult.data };
}

async function loadCloudMetadata(userId: string): Promise<{
  capsule: EncryptedCapsuleMetadata | null;
  privateData: EncryptedPrivateMetadata | null;
}> {
  const supabase = requireSupabaseClient();
  const [privateResult, capsuleResult] = await Promise.all([
    supabase
      .from("encrypted_private_data")
      .select("user_id, subject_id, record_id, key_id, crypto_version, schema_version, revision")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("encrypted_friend_availability")
      .select("user_id, subject_id, capsule_id, key_id, crypto_version, schema_version, revision")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (privateResult.error || capsuleResult.error) throw new Error("Encrypted cloud read failed.");
  return { privateData: privateResult.data, capsule: capsuleResult.data };
}

function validatePrivateMetadata(
  userId: string,
  keys: StoredDataKeys,
  local: StoredPrivateRecord | null,
  cloud: EncryptedPrivateMetadata,
) {
  if (
    cloud.user_id !== userId ||
    cloud.subject_id !== keys.subjectId ||
    cloud.key_id !== keys.privateData.keyId ||
    cloud.crypto_version !== CRYPTO_VERSION ||
    cloud.schema_version !== PRIVATE_DATA_SCHEMA_VERSION ||
    !positiveInteger(cloud.revision) ||
    (local !== null && cloud.record_id !== local.recordId)
  ) {
    throw new Error("Encrypted private-data context mismatch.");
  }
}

function validateCapsuleMetadata(
  userId: string,
  keys: StoredDataKeys,
  local: StoredCapsuleRecord | null,
  cloud: EncryptedCapsuleMetadata,
) {
  if (
    cloud.user_id !== userId ||
    cloud.subject_id !== keys.subjectId ||
    cloud.key_id !== keys.friendAvailability.keyId ||
    cloud.crypto_version !== CRYPTO_VERSION ||
    cloud.schema_version !== AVAILABILITY_SCHEMA_VERSION ||
    !positiveInteger(cloud.revision) ||
    (local !== null && cloud.capsule_id !== local.recordId)
  ) {
    throw new Error("Encrypted availability context mismatch.");
  }
}

export async function loadEncryptedPrivateState(
  userId: string,
  signal?: AbortSignal,
  forceCloud = false,
): Promise<PrivateCloudRestoration | null> {
  abortIfRequested(signal);
  const selection = await securityStore();
  const local = forceCloud ? null : await restoreEncryptedLocalState(selection.store, userId);
  if (local) {
    if (local.cloudSyncEnabled) optedInUsers.add(userId);
    else optedInUsers.delete(userId);
    return {
      payload: local.payload,
      source: "secure-local",
      updatedAt: local.updatedAt,
      persistentKeys: selection.persistent,
    };
  }

  const cloud = await loadCloudRows(userId, signal);
  if (!cloud.privateData && !cloud.capsule) return null;
  if (!cloud.privateData || !cloud.capsule) {
    throw new Error("Encrypted cloud data is incomplete. Sync again from the originating device.");
  }
  const localKeys = await selection.store.getDataKeys(userId);
  const keys = validDataKeys(localKeys, userId)
    ? localKeys
    : await ensureDataKeys(selection.store, userId, signal);
  const privateRecord = privateRecordFromRow(userId, cloud.privateData);
  const capsuleRecord = capsuleRecordFromRow(userId, cloud.capsule);
  const [payload] = await Promise.all([
    openPrivateData(keys, privateRecord),
    openAvailabilityCapsule(keys, capsuleRecord),
  ]);
  await selection.store.putEncryptedRecords(privateRecord, capsuleRecord);
  await selection.store.putDataKeys({ ...keys, cloudSyncEnabled: true });
  optedInUsers.add(userId);
  return {
    payload,
    source: "cloud",
    updatedAt: privateRecord.updatedAt,
    persistentKeys: selection.persistent,
  };
}

export async function restoreEncryptedLocalState(
  store: SecurityStore,
  userId: string,
): Promise<{
  payload: PrivateDataPayloadV1;
  updatedAt: string;
  cloudSyncEnabled: boolean;
} | null> {
  const [keys, privateRecord, capsuleRecord] = await Promise.all([
    store.getDataKeys(userId),
    store.getPrivateRecord(userId),
    store.getCapsuleRecord(userId),
  ]);
  if (!validDataKeys(keys, userId)) return null;
  if (!privateRecord && !capsuleRecord) return null;
  if (!privateRecord || !capsuleRecord) {
    throw new Error("Encrypted local data is incomplete.");
  }
  const payload = await openPrivateData(keys, privateRecord);
  await openAvailabilityCapsule(keys, capsuleRecord);
  return {
    payload,
    updatedAt: privateRecord.updatedAt,
    cloudSyncEnabled: keys.cloudSyncEnabled === true,
  };
}

function busyEvents(payload: PrivateDataPayloadV1): BusyEvent[] {
  const academic = payload.schedule.map((meeting) => ({
    term: meeting.term,
    weekday: meeting.weekday,
    startMinute: meeting.startTime,
    endMinute: meeting.endTime,
  }));
  const personal = payload.personalItems.flatMap((item): BusyEvent[] => {
    if (
      item.flexibility.kind !== "fixed" ||
      item.startTime === undefined ||
      item.endTime === undefined
    )
      return [];
    return [
      {
        term: item.term,
        weekday: item.weekday,
        startMinute: item.startTime,
        endMinute: item.endTime,
      },
    ];
  });
  return [...academic, ...personal];
}

async function writePrivateRecord(
  record: StoredPrivateRecord,
  current: { revision: number } | null,
): Promise<void> {
  const supabase = requireSupabaseClient();
  const row = privateRowFromRecord(record);
  if (!current) {
    const { error } = await supabase.from("encrypted_private_data").insert(row);
    if (error) throw new Error("Encrypted private-data upload failed.");
    return;
  }
  const update: TablesUpdate<"encrypted_private_data"> = { ...row };
  delete update.user_id;
  const { data, error } = await supabase
    .from("encrypted_private_data")
    .update(update)
    .eq("user_id", record.userId)
    .eq("revision", current.revision)
    .select("revision")
    .maybeSingle();
  if (error || data?.revision !== record.revision) {
    throw new Error("Encrypted private data changed on another device. Reload before syncing.");
  }
}

async function writeCapsuleRecord(
  record: StoredCapsuleRecord,
  current: { revision: number } | null,
): Promise<void> {
  const supabase = requireSupabaseClient();
  const row = capsuleRowFromRecord(record);
  if (!current) {
    const { error } = await supabase.from("encrypted_friend_availability").insert(row);
    if (error) throw new Error("Encrypted availability upload failed.");
    return;
  }
  const update: TablesUpdate<"encrypted_friend_availability"> = { ...row };
  delete update.user_id;
  const { data, error } = await supabase
    .from("encrypted_friend_availability")
    .update(update)
    .eq("user_id", record.userId)
    .eq("revision", current.revision)
    .select("revision")
    .maybeSingle();
  if (error || data?.revision !== record.revision) {
    throw new Error("Encrypted availability changed on another device. Reload before syncing.");
  }
}

async function saveEncryptedPrivateStateNow(
  userId: string,
  input: PrivateCloudState,
): Promise<PrivateCloudRestoration> {
  await sessionForUser(userId);
  const payload = createPrivateDataPayload(input);
  const capsule = deriveAvailabilityCapsule(busyEvents(payload));
  const selection = await securityStore();
  const keys = await ensureDataKeys(selection.store, userId);
  const [previousLocalPrivate, previousLocalCapsule] = await Promise.all([
    selection.store.getPrivateRecord(userId),
    selection.store.getCapsuleRecord(userId),
  ]);
  if (Boolean(previousLocalPrivate) !== Boolean(previousLocalCapsule)) {
    throw new Error("Encrypted local data is incomplete.");
  }
  await Promise.all([
    previousLocalPrivate ? openPrivateData(keys, previousLocalPrivate) : Promise.resolve(),
    previousLocalCapsule ? openAvailabilityCapsule(keys, previousLocalCapsule) : Promise.resolve(),
  ]);
  const localUpdatedAt = new Date().toISOString();
  const [localPrivate, localCapsule] = await Promise.all([
    sealPrivateData({
      userId,
      keys,
      payload,
      revision: (previousLocalPrivate?.revision ?? 0) + 1,
      ...(previousLocalPrivate ? { recordId: previousLocalPrivate.recordId } : {}),
      cloudRevision: previousLocalPrivate?.cloudRevision ?? null,
      updatedAt: localUpdatedAt,
    }),
    sealAvailabilityCapsule({
      userId,
      keys,
      capsule,
      revision: (previousLocalCapsule?.revision ?? 0) + 1,
      ...(previousLocalCapsule ? { recordId: previousLocalCapsule.recordId } : {}),
      cloudRevision: previousLocalCapsule?.cloudRevision ?? null,
      updatedAt: localUpdatedAt,
    }),
  ]);
  await selection.store.putEncryptedRecords(localPrivate, localCapsule);

  // The encrypted local transaction completes before any cloud read/write. A
  // network failure therefore never discards the user's current in-browser state.
  const cloud = await loadCloudMetadata(userId);
  if (cloud.privateData) {
    validatePrivateMetadata(userId, keys, previousLocalPrivate, cloud.privateData);
  }
  if (cloud.capsule) {
    validateCapsuleMetadata(userId, keys, previousLocalCapsule, cloud.capsule);
  }
  if (encryptedRevisionConflicts(previousLocalPrivate, cloud.privateData)) {
    throw new Error("Encrypted private data changed on another device. Reload before syncing.");
  }
  if (encryptedRevisionConflicts(previousLocalCapsule, cloud.capsule)) {
    throw new Error("Encrypted availability changed on another device. Reload before syncing.");
  }
  const updatedAt = new Date().toISOString();
  const [privateRecord, capsuleRecord] = await Promise.all([
    cloud.privateData
      ? sealPrivateData({
          userId,
          keys,
          payload,
          revision: cloud.privateData.revision + 1,
          recordId: cloud.privateData.record_id,
          cloudRevision: cloud.privateData.revision,
          updatedAt,
        })
      : Promise.resolve(localPrivate),
    cloud.capsule
      ? sealAvailabilityCapsule({
          userId,
          keys,
          capsule,
          revision: cloud.capsule.revision + 1,
          recordId: cloud.capsule.capsule_id,
          cloudRevision: cloud.capsule.revision,
          updatedAt,
        })
      : Promise.resolve(localCapsule),
  ]);
  await selection.store.putEncryptedRecords(privateRecord, capsuleRecord);
  await writePrivateRecord(privateRecord, cloud.privateData);
  await selection.store.putPrivateRecord({
    ...privateRecord,
    cloudRevision: privateRecord.revision,
  });
  await writeCapsuleRecord(capsuleRecord, cloud.capsule);
  await selection.store.putCapsuleRecord({
    ...capsuleRecord,
    cloudRevision: capsuleRecord.revision,
  });

  const verifiedRows = await loadCloudRows(userId);
  if (!verifiedRows.privateData || !verifiedRows.capsule) {
    throw new Error("Encrypted cloud verification failed.");
  }
  const verifiedPrivate = privateRecordFromRow(userId, verifiedRows.privateData);
  const verifiedCapsule = capsuleRecordFromRow(userId, verifiedRows.capsule);
  const [verifiedPayload, verifiedAvailability] = await Promise.all([
    openPrivateData(keys, verifiedPrivate),
    openAvailabilityCapsule(keys, verifiedCapsule),
  ]);
  if (
    JSON.stringify(verifiedPayload) !== JSON.stringify(payload) ||
    JSON.stringify(verifiedAvailability) !== JSON.stringify(capsule)
  ) {
    throw new Error("Encrypted cloud verification failed.");
  }
  await selection.store.putEncryptedRecords(verifiedPrivate, verifiedCapsule);
  await selection.store.putDataKeys({ ...keys, cloudSyncEnabled: true });
  optedInUsers.add(userId);

  if (isEncryptedPrivateCloudAuthoritative) {
    clearRememberedTimetable();
    clearStoredPersonalItems();
    clearStoredUserPreferences();
    clearStoredGapPreferences();
  }
  return {
    payload: verifiedPayload,
    source: "cloud",
    updatedAt: verifiedPrivate.updatedAt,
    persistentKeys: selection.persistent,
  };
}

export function saveEncryptedPrivateState(
  userId: string,
  input: PrivateCloudState,
): Promise<PrivateCloudRestoration> {
  const previous = saveQueues.get(userId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => saveEncryptedPrivateStateNow(userId, input));
  saveQueues.set(userId, next);
  const cleanup = () => {
    if (saveQueues.get(userId) === next) saveQueues.delete(userId);
  };
  void next.then(cleanup, cleanup);
  return next;
}

export function isEncryptedSyncOptedIn(userId: string): boolean {
  return optedInUsers.has(userId);
}

export async function deleteEncryptedPrivateCloud(userId: string): Promise<void> {
  await sessionForUser(userId);
  await saveQueues.get(userId)?.catch(() => undefined);
  const supabase = requireSupabaseClient();
  const results = await Promise.all([
    supabase.from("encrypted_friend_availability").delete().eq("user_id", userId),
    supabase.from("encrypted_private_data").delete().eq("user_id", userId),
  ]);
  if (results.some((result) => result.error)) throw new Error("Encrypted cloud deletion failed.");
  const selection = await securityStore();
  const keys = await selection.store.getDataKeys(userId);
  if (keys) await selection.store.putDataKeys({ ...keys, cloudSyncEnabled: false });
  optedInUsers.delete(userId);
}

export async function clearPrivateCloudLocalUser(userId: string): Promise<void> {
  optedInUsers.delete(userId);
  await saveQueues.get(userId)?.catch(() => undefined);
  saveQueues.delete(userId);
  const selection = await securityStore();
  await selection.store.clearUser(userId);
}

export function privateCloudState(input: {
  schedule: PrivateDataPayloadV1["schedule"];
  personalItems: PersonalItem[];
  preferences: PrivateDataPayloadV1["preferences"];
  gapPreferences: PrivateDataPayloadV1["gapPreferences"];
}): PrivateCloudState {
  return input;
}

export function availabilityForPrivateState(input: PrivateCloudState): AvailabilityCapsuleV1 {
  return deriveAvailabilityCapsule(busyEvents(createPrivateDataPayload(input)));
}

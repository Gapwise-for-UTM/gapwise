from pathlib import Path


def replace_once(path: str, old: str, new: str, expected: int = 1) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}\n--- OLD ---\n{old}")
    target.write_text(text.replace(old, new, expected))


# 1. Never carry one authenticated user's in-memory private state into another account.
replace_once(
    "src/routes/index.tsx",
    'if (previousUser.current && restoredSource.current === "cloud") {',
    '''if (
        previousUser.current &&
        (restoredSource.current === "cloud" || isEncryptedPrivateCloudAuthoritative)
      ) {''',
    expected=2,
)
replace_once(
    "src/routes/index.tsx",
    '''      !authenticatedUserId ||
      !meetings?.length ||''',
    '''      !authenticatedUserId ||
      meetings === null ||''',
)

# 2. Authoritative encrypted mode must not read old plaintext browser persistence.
replace_once(
    "src/features/sync/preferences.ts",
    'type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;',
    'type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;',
)
replace_once(
    "src/features/sync/preferences.ts",
    '''): UserPreferences {
  if (!storage) return DEFAULT_USER_PREFERENCES;''',
    '''): UserPreferences {
  if (isEncryptedPrivateCloudAuthoritative) {
    try {
      storage?.removeItem(LOCAL_PREFERENCES_KEY);
    } catch {
      // Authoritative encrypted mode ignores inaccessible legacy plaintext state.
    }
    return DEFAULT_USER_PREFERENCES;
  }
  if (!storage) return DEFAULT_USER_PREFERENCES;''',
)
replace_once(
    "src/hooks/use-preferences.ts",
    '''export function loadRememberedRecord<T>(): {
  remember: boolean;
  record: RememberedRecord<T> | null;
} {
  try {
    const remember = window.localStorage.getItem(REMEMBER_KEY) === "1";''',
    '''export function loadRememberedRecord<T>(): {
  remember: boolean;
  record: RememberedRecord<T> | null;
} {
  try {
    if (isEncryptedPrivateCloudAuthoritative) {
      window.localStorage.removeItem(TIMETABLE_KEY);
      window.localStorage.removeItem(REMEMBER_KEY);
      return { remember: false, record: null };
    }
    const remember = window.localStorage.getItem(REMEMBER_KEY) === "1";''',
)

# 3. Preserve rejected Promise values even when they are falsy.
replace_once(
    "src/features/auth/auth-service.ts",
    '''  let cleanupError: unknown;
  try {
    await clearPrivateState();
  } catch (error) {
    cleanupError = error;
  }

  let signOutError: unknown;
  try {
    await removeLocalSession();
  } catch (error) {
    signOutError = error;
  }
  if (cleanupError) throw cleanupError;
  if (signOutError) throw signOutError;''',
    '''  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    await clearPrivateState();
  } catch (error) {
    cleanupFailed = true;
    cleanupError = error;
  }

  let signOutFailed = false;
  let signOutError: unknown;
  try {
    await removeLocalSession();
  } catch (error) {
    signOutFailed = true;
    signOutError = error;
  }
  if (cleanupFailed) throw cleanupError;
  if (signOutFailed) throw signOutError;''',
)

# 4. Account deletion distinguishes server deletion from browser cleanup and offers a retry.
replace_once(
    "src/features/auth/AccountStatus.tsx",
    'import { shouldWritePrivateCloud } from "@/features/security/private-cloud-mode";',
    'import { shouldWritePrivateCloud } from "@/features/security/private-cloud-mode";\nimport { clearPrivateCloudLocalUser } from "@/features/sync/encrypted-sync-service";',
)
replace_once(
    "src/features/auth/AccountStatus.tsx",
    '  const [emailSent, setEmailSent] = useState(false);',
    '  const [emailSent, setEmailSent] = useState(false);\n  const [cleanupUserId, setCleanupUserId] = useState<string | null>(null);',
)
replace_once(
    "src/features/auth/AccountStatus.tsx",
    '''  async function removeAccount() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteAccount();
      if (clearLocal) clearRememberedTimetable();
      onAccountDeleted(clearLocal);
      await signOut().catch(() => undefined);
      setDeleteOpen(false);
      setMessage("Your account and cloud data were permanently deleted.");
    } catch {
      setMessage("We couldn't delete your account. Your session and local data are unchanged.");
    } finally {
      setBusy(false);
    }
  }
''',
    '''  async function removeAccount() {
    if (busy) return;
    const deletedUserId = user?.id ?? null;
    setBusy(true);
    setMessage(null);
    try {
      await deleteAccount();
      let localCleanupFailed = false;
      if (shouldWritePrivateCloud && deletedUserId) {
        try {
          await clearPrivateCloudLocalUser(deletedUserId);
        } catch {
          localCleanupFailed = true;
          setCleanupUserId(deletedUserId);
        }
      }
      if (clearLocal) clearRememberedTimetable();
      onAccountDeleted(clearLocal);
      await signOut().catch(() => undefined);
      setDeleteOpen(false);
      if (localCleanupFailed) {
        setMessage(
          "Your account and cloud data were deleted, but this browser couldn't finish clearing encrypted local data. Retry local cleanup.",
        );
      } else {
        setCleanupUserId(null);
        setMessage("Your account and cloud data were permanently deleted.");
      }
    } catch {
      setMessage("We couldn't delete your account. Your session and local data are unchanged.");
    } finally {
      setBusy(false);
    }
  }

  async function retryLocalCleanup() {
    if (busy || !cleanupUserId) return;
    setBusy(true);
    try {
      await clearPrivateCloudLocalUser(cleanupUserId);
      if (clearLocal) clearRememberedTimetable();
      setCleanupUserId(null);
      setMessage(
        "Your account and cloud data were permanently deleted, and this browser's private data was cleared.",
      );
    } catch {
      setMessage(
        "Your account is deleted, but this browser still couldn't clear encrypted local data. Retry or clear this site's browser data.",
      );
    } finally {
      setBusy(false);
    }
  }
''',
)
replace_once(
    "src/features/auth/AccountStatus.tsx",
    '                  ? "Secure device keys and encrypted local records are always cleared on account deletion. If unchecked, legacy guest data stays available."',
    '                  ? "Gapwise clears secure device keys and encrypted local records during account deletion. If browser storage blocks cleanup, you will be prompted to retry. If unchecked, legacy guest data stays available."',
)
replace_once(
    "src/features/auth/AccountStatus.tsx",
    '''      {message ? (
        <span
          role="status"
          className="glass-panel fixed right-4 top-20 z-[60] max-w-sm rounded-lg px-4 py-3 text-sm"
        >
          {message}
        </span>
      ) : null}''',
    '''      {message ? (
        <div
          role="status"
          className="glass-panel fixed right-4 top-20 z-[60] max-w-sm rounded-lg px-4 py-3 text-sm"
        >
          <span>{message}</span>
          {cleanupUserId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void retryLocalCleanup()}
              className="button-secondary mt-2 min-h-9 px-3 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? "Retrying…" : "Retry local cleanup"}
            </button>
          ) : null}
        </div>
      ) : null}''',
)

# 5. Keep friend-overlap privacy constants in one place and make network reads bounded.
replace_once(
    "src/features/friends/friend-service.ts",
    'import { AVAILABILITY_RESPONSE_CAP } from "@/features/security/availability-capsule";',
    '''import {
  AVAILABILITY_DAY_END,
  AVAILABILITY_DAY_START,
  AVAILABILITY_MINIMUM_MINUTES,
  AVAILABILITY_RESPONSE_CAP,
  AVAILABILITY_ROUNDING_MINUTES,
} from "@/features/security/availability-capsule";''',
)
replace_once(
    "src/features/friends/friend-service.ts",
    'const UNSAFE_DISPLAY_CHARACTER = /[\\p{Cc}\\p{Cf}]/u;',
    '''const UNSAFE_DISPLAY_CHARACTER = /[\\p{Cc}\\p{Cf}]/u;
const COMMON_GAP_TIMEOUT_MS = 10_000;
const COMMON_GAP_MAX_BYTES = 8 * 1024;
const MAX_ENCRYPTED_GAP_CONNECTIONS = 10;''',
)
replace_once(
    "src/features/friends/friend-service.ts",
    '''      (startMinute as number) < 9 * 60 ||
      (endMinute as number) > 18 * 60 ||
      (startMinute as number) % 30 !== 0 ||
      (endMinute as number) % 30 !== 0 ||
      (endMinute as number) - (startMinute as number) < 60''',
    '''      (startMinute as number) < AVAILABILITY_DAY_START ||
      (endMinute as number) > AVAILABILITY_DAY_END ||
      (startMinute as number) % AVAILABILITY_ROUNDING_MINUTES !== 0 ||
      (endMinute as number) % AVAILABILITY_ROUNDING_MINUTES !== 0 ||
      (endMinute as number) - (startMinute as number) < AVAILABILITY_MINIMUM_MINUTES''',
)
replace_once(
    "src/features/friends/friend-service.ts",
    '''async function loadEncryptedFriendGaps(
  connection: FriendConnection,
  term: Term,
  accessToken: string,
): Promise<FriendGapOverlap[]> {
  const response = await fetch("/api/common-gap", {
    method: "POST",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ friendshipId: connection.id, term }),
  });
  if (response.status === 429) throw new FriendOverlapRateLimitError();
  if (!response.ok) throw new Error("Common-gap lookup failed.");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 8 * 1024) {
    throw new Error("Common-gap response is too large.");
  }
''',
    '''async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Common-gap response is malformed.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Error("Common-gap response is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

async function loadEncryptedFriendGaps(
  connection: FriendConnection,
  term: Term,
  accessToken: string,
): Promise<FriendGapOverlap[]> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), COMMON_GAP_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch("/api/common-gap", {
      method: "POST",
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ friendshipId: connection.id, term }),
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Common-gap lookup timed out.");
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
  if (response.status === 429) throw new FriendOverlapRateLimitError();
  if (!response.ok) throw new Error("Common-gap lookup failed.");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > COMMON_GAP_MAX_BYTES) {
    throw new Error("Common-gap response is too large.");
  }
  const text = await readBoundedText(response, COMMON_GAP_MAX_BYTES);
''',
)
replace_once(
    "src/features/friends/friend-service.ts",
    '''    return (
      await Promise.all(
        connections
          .slice(0, 10)
          .map((connection) =>
            loadEncryptedFriendGaps(connection, term, data.session.access_token),
          ),
      )
    ).flat();''',
    '''    if (connections.length > MAX_ENCRYPTED_GAP_CONNECTIONS) {
      throw new Error(
        `Common-gap refresh supports up to ${MAX_ENCRYPTED_GAP_CONNECTIONS} mutual friends at once.`,
      );
    }
    const settled = await Promise.allSettled(
      connections.map((connection) =>
        loadEncryptedFriendGaps(connection, term, data.session.access_token),
      ),
    );
    if (
      settled.some(
        (result) =>
          result.status === "rejected" && result.reason instanceof FriendOverlapRateLimitError,
      )
    ) {
      throw new FriendOverlapRateLimitError();
    }
    return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));''',
)

# 6. IndexedDB probes use the injected crypto runtime; sibling ESM specifiers stay explicit.
replace_once(
    "src/features/security/security-store.ts",
    '''import type { EncryptedBytes } from "./envelope-crypto";
import type { AvailabilityCapsuleV1 } from "./availability-capsule";
import type { PrivateDataPayloadV1 } from "./private-data";''',
    '''import type { EncryptedBytes } from "./envelope-crypto.js";
import type { AvailabilityCapsuleV1 } from "./availability-capsule.js";
import type { PrivateDataPayloadV1 } from "./private-data.js";''',
)
replace_once(
    "src/features/security/security-store.ts",
    '  cryptoRuntime: Pick<Crypto, "subtle"> | undefined = globalThis.crypto,',
    '  cryptoRuntime: (Pick<Crypto, "subtle"> & Partial<Pick<Crypto, "randomUUID">>) | undefined =\n    globalThis.crypto,',
)
replace_once(
    "src/features/security/security-store.ts",
    '''  async function verifyCryptoKeyPersistence(): Promise<boolean> {
    const probeId = crypto.randomUUID();
    try {''',
    '''  async function verifyCryptoKeyPersistence(): Promise<boolean> {
    let probeId: string | null = null;
    try {
      if (!cryptoRuntime.randomUUID) return false;
      probeId = cryptoRuntime.randomUUID();''',
)
replace_once(
    "src/features/security/security-store.ts",
    '''        transaction.objectStore(CRYPTO_PROBE_STORE).delete(probeId);''',
    '''        if (!probeId) return;
        transaction.objectStore(CRYPTO_PROBE_STORE).delete(probeId);''',
)

# 7. Empty schedules are still valid encrypted private state.
replace_once(
    "src/features/sync/CloudSyncControls.tsx",
    '            disabled={!enabled || !meetings?.length || busy}',
    '            disabled={!enabled || busy || (!isEncryptedPrivateCloudAuthoritative && !meetings?.length)}',
)
replace_once(
    "src/features/sync/CloudSyncControls.tsx",
    '                    schedule: meetings!,',
    '                    schedule: meetings ?? [],',
)

# 8. Bound key-broker requests and close the cloud-deletion race before any await.
replace_once(
    "src/features/sync/encrypted-sync-service.ts",
    '''  abortIfRequested(signal);
  const response = await fetch("/api/key-broker", {
    method: "POST",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
    ...(signal ? { signal } : {}),''',
    '''  abortIfRequested(signal);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  let response: Response;
  try {
    response = await fetch("/api/key-broker", {
      method: "POST",
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
      signal: controller.signal,''',
)
replace_once(
    "src/features/sync/encrypted-sync-service.ts",
    '''    body: JSON.stringify({ devicePublicKey: device.publicJwk }),
  });
  const body = await readSmallJson(response);''',
    '''      body: JSON.stringify({ devicePublicKey: device.publicJwk }),
    });
  } catch (error) {
    if (timedOut && !signal?.aborted) throw new Error("Encrypted key setup timed out.");
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
  const body = await readSmallJson(response);''',
)
replace_once(
    "src/features/sync/encrypted-sync-service.ts",
    '''export async function deleteEncryptedPrivateCloud(userId: string): Promise<void> {
  await sessionForUser(userId);
  if (deletingCloudUsers.has(userId)) throw new Error("Encrypted cloud deletion is in progress.");
  deletingCloudUsers.add(userId);
  optedInUsers.delete(userId);
  try {
    await saveQueues.get(userId)?.catch(() => undefined);''',
    '''export async function deleteEncryptedPrivateCloud(userId: string): Promise<void> {
  if (deletingCloudUsers.has(userId)) throw new Error("Encrypted cloud deletion is in progress.");
  deletingCloudUsers.add(userId);
  optedInUsers.delete(userId);
  try {
    await sessionForUser(userId);
    await saveQueues.get(userId)?.catch(() => undefined);''',
)

# 9. Server auth has a finite verification budget and reuses its request-independent verifier.
replace_once(
    "src/server/private-cloud/auth.ts",
    'const MAX_AUTHORIZATION_BYTES = 8 * 1024;',
    '''const MAX_AUTHORIZATION_BYTES = 8 * 1024;
const AUTH_CLAIMS_TIMEOUT_MS = 5_000;
let verifierClient: SupabaseClient<Database> | null = null;''',
)
replace_once(
    "src/server/private-cloud/auth.ts",
    '''function createServerSupabaseClient(accessToken?: string): SupabaseClient<Database> {
  const { url, publishableKey } = serverSupabaseConfiguration();
  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}
''',
    '''function createServerSupabaseClient(accessToken?: string): SupabaseClient<Database> {
  const { url, publishableKey } = serverSupabaseConfiguration();
  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

function sharedVerifierClient(): SupabaseClient<Database> {
  verifierClient ??= createServerSupabaseClient();
  return verifierClient;
}

async function withAuthTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new ApiError(503, "Authentication service temporarily unavailable.")),
          AUTH_CLAIMS_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
''',
)
replace_once(
    "src/server/private-cloud/auth.ts",
    '''  const verifier = createServerSupabaseClient();
  const { data, error } = await verifier.auth.getClaims(accessToken);''',
    '''  const verifier = sharedVerifierClient();
  const { data, error } = await withAuthTimeout(verifier.auth.getClaims(accessToken));''',
)

# 10. Use structural size/error contracts at the Vercel common-gap boundary.
replace_once(
    "src/server/private-cloud/common-gap.ts",
    'const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;',
    '''const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const AES_GCM_TAG_BYTES = 16;
const AES_GCM_NONCE_BYTES = 12;
const MAX_CAPSULE_CIPHERTEXT_BYTES = MAX_CAPSULE_PLAINTEXT_BYTES + AES_GCM_TAG_BYTES;''',
)
replace_once(
    "src/server/private-cloud/common-gap.ts",
    '''        ciphertext: byteaHexToBytes(row.capsule_ciphertext, 8_208),
        nonce: byteaHexToBytes(row.capsule_nonce, 12),''',
    '''        ciphertext: byteaHexToBytes(row.capsule_ciphertext, MAX_CAPSULE_CIPHERTEXT_BYTES),
        nonce: byteaHexToBytes(row.capsule_nonce, AES_GCM_NONCE_BYTES),''',
)
replace_once(
    "src/server/private-cloud/common-gap.ts",
    '    if (error.message.includes("temporarily unavailable")) {',
    '    if (error.code === "P0001") {',
)

# 11. A production Supabase deletion function accepts only exact configured origins.
replace_once(
    "supabase/functions/delete-account/index.ts",
    '''const gapwisePreviewOrigin =
  /^https:\/\/gapwise-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-andrew-muratov-s-projects\.vercel\.app$/i;

function isAllowedOrigin(origin: string | null): boolean {
  return !origin || configuredOrigins.has(origin) || gapwisePreviewOrigin.test(origin);
}''',
    '''function isAllowedOrigin(origin: string | null): boolean {
  return !origin || configuredOrigins.has(origin);
}''',
)

# 12. Preserve diagnostic security invariants and decode exactly the guarded view.
replace_once(
    "src/features/security/device-keys.ts",
    '''  try {
    const key = await runtime(selected).subtle.unwrapKey(
      "raw",
      ownedBuffer(wrappedDek),
      privateKey,
      { name: "RSA-OAEP" },
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    if (key.extractable) throw new Error("Unwrapped DEK must be non-extractable.");
    return key;
  } catch {
    throw new Error("Device key unwrap failed.");
  }''',
    '''  let key: CryptoKey;
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
  return key;''',
)
replace_once(
    "src/features/security/envelope-crypto.ts",
    '    parsed = JSON.parse(decodeUtf8(plaintext.buffer));',
    '    parsed = JSON.parse(decodeUtf8(plaintext));',
)
replace_once(
    "src/features/security/private-data.ts",
    'import { PRIVATE_DATA_SCHEMA_VERSION } from "./crypto-context";',
    'import { PRIVATE_DATA_SCHEMA_VERSION } from "./crypto-context.js";',
)

# 13. Use the same version source for rewrap and verification AAD.
replace_once(
    "src/server/private-cloud/key-broker.ts",
    '''  keyId: string,
  kekVersion: number,
) {
  return wrapDataEncryptionKey(kek, rawDek, {
    cryptoVersion: CRYPTO_VERSION,
    purpose,
    subjectId,
    keyId,
    keyVersion: KEY_VERSION,
    kekVersion,
  });''',
    '''  keyId: string,
  kekVersion: number,
  cryptoVersion = CRYPTO_VERSION,
  keyVersion = KEY_VERSION,
) {
  return wrapDataEncryptionKey(kek, rawDek, {
    cryptoVersion,
    purpose,
    subjectId,
    keyId,
    keyVersion,
    kekVersion,
  });''',
)
replace_once(
    "src/server/private-cloud/key-broker.ts",
    '''        envelope.private_data_key_id,
        newKekVersion,
      ),''',
    '''        envelope.private_data_key_id,
        newKekVersion,
        envelope.crypto_version,
        envelope.key_version,
      ),''',
)
replace_once(
    "src/server/private-cloud/key-broker.ts",
    '''        envelope.friend_availability_key_id,
        newKekVersion,
      ),''',
    '''        envelope.friend_availability_key_id,
        newKekVersion,
        envelope.crypto_version,
        envelope.key_version,
      ),''',
)

# 14. Rollback is explicitly destructive and atomic. Applied migration history remains untouched.
replace_once(
    "supabase/rollbacks/20260811063830_encrypted_private_cloud_phase1.sql",
    '''-- This additive rollback intentionally leaves every legacy plaintext table and
-- function untouched. Run only before encrypted storage becomes authoritative.

''',
    '''-- This additive rollback intentionally leaves every legacy plaintext table and
-- function untouched. Run only before encrypted storage becomes authoritative.
-- WARNING: this permanently deletes all encrypted records and key envelopes.

begin;

''',
)
replace_once(
    "supabase/rollbacks/20260811063830_encrypted_private_cloud_phase1.sql",
    'alter table public.user_preferences no force row level security;\n',
    'alter table public.user_preferences no force row level security;\n\ncommit;\n',
)

# 15. Correct operational documentation without weakening key-handling rules.
replace_once(
    "docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md",
    'lossy friend capsule locally. Normal reloads use IndexedDB and do not call a crypto function.',
    'lossy friend capsule locally. Normal reloads use IndexedDB and local Web Crypto without calling the key broker or any server-side crypto function.',
)
replace_once(
    "docs/SUPABASE.md",
    '- Verify only the publishable key is configured in Vercel.',
    '- Verify that only the publishable key is exposed to browser-facing configuration; keep server-only KEK variables confined to Vercel Sensitive function variables.',
)
replace_once(
    "docs/PRIVATE_CLOUD_CAPACITY.md",
    '## Current free-plan limits\n',
    '''## Current free-plan limits

The Vercel Hobby figures below are capacity references only for eligible personal, non-commercial use and previews. Do not treat them as a production entitlement for an institutional or commercial deployment; re-evaluate on an eligible Vercel plan or another hosting plan before such a rollout.
''',
)

# 16. Regression coverage for concrete final-review findings.
replace_once(
    "tests/auth-persistence.test.ts",
    '''  test("survives adapter recreation like a reload or browser restart", async () => {''',
    '''  test("preserves falsy cleanup rejection values", async () => {
    for (const rejected of [undefined, null, false, 0, ""]) {
      await expect(
        completeLocalSignOut(
          async () => Promise.reject(rejected),
          async () => undefined,
        ),
      ).rejects.toBe(rejected);
    }
  });

  test("preserves falsy session-removal rejection values", async () => {
    for (const rejected of [undefined, null, false, 0, ""]) {
      await expect(
        completeLocalSignOut(
          async () => undefined,
          async () => Promise.reject(rejected),
        ),
      ).rejects.toBe(rejected);
    }
  });

  test("survives adapter recreation like a reload or browser restart", async () => {''',
)
replace_once(
    "tests/friend-overlap.test.ts",
    '''    expect(() =>
      parseCommonGapResponse({
        windows: [{ weekday: "Monday", startMinute: 690, endMinute: 720, detail: "forbidden" }],
      }),
    ).toThrow("malformed");
  });''',
    '''    expect(() =>
      parseCommonGapResponse({
        windows: [{ weekday: "Monday", startMinute: 690, endMinute: 720, detail: "forbidden" }],
      }),
    ).toThrow("malformed");
    expect(() =>
      parseCommonGapResponse({
        windows: [{ weekday: "Monday", startMinute: 510, endMinute: 600 }],
      }),
    ).toThrow("malformed");
    expect(() =>
      parseCommonGapResponse({
        windows: [{ weekday: "Monday", startMinute: 1020, endMinute: 1110 }],
      }),
    ).toThrow("malformed");
    expect(() =>
      parseCommonGapResponse({
        windows: [{ weekday: "Monday", startMinute: 660, endMinute: 690 }],
      }),
    ).toThrow("malformed");
    expect(() =>
      parseCommonGapResponse({
        windows: [{ weekday: "Funday", startMinute: 660, endMinute: 750 }],
      }),
    ).toThrow("malformed");
    expect(() =>
      parseCommonGapResponse({
        windows: [{ weekday: "Monday", startMinute: 660, endMinute: 750 }],
        detail: "forbidden",
      }),
    ).toThrow("malformed");
  });''',
)
replace_once(
    "tests/crypto.test.ts",
    '''    expect(() =>
      createPrivateDataPayload({
        schedule: [meeting()],
        personalItems: Array.from({ length: 201 }, (_, index) => ({''',
    '''    expect(() =>
      createPrivateDataPayload({
        schedule: [meeting()],
        personalItems: Array.from({ length: 200 }, (_, index) => ({
          ...personalItem,
          id: `private-item-${index}`,
        })),
        preferences: DEFAULT_USER_PREFERENCES,
        gapPreferences: DEFAULT_GAP_PREFERENCES,
      }),
    ).not.toThrow();
    expect(() =>
      createPrivateDataPayload({
        schedule: [meeting()],
        personalItems: Array.from({ length: 201 }, (_, index) => ({''',
)
replace_once(
    "tests/security.test.ts",
    '''  test("allows production and narrowly scoped Gapwise previews without reflecting rejected origins", async () => {
    const source = await readFile("supabase/functions/delete-account/index.ts", "utf8");
    expect(source).toContain('"https://gapwise-utm.vercel.app"');
    expect(source).toContain("const gapwisePreviewOrigin =");
    expect(source).toContain("gapwise-");
    expect(source).toContain("andrew-muratov-s-projects\\.vercel\\.app");
    expect(source).toContain("configuredOrigins.has(origin)");
    expect(source).toContain("gapwisePreviewOrigin.test(origin)");
    expect(source).toContain("const originAllowed = isAllowedOrigin(origin)");
    expect(source).toContain("if (!originAllowed)");
    expect(source).not.toContain("https://*.vercel.app");
    expect(source).not.toContain("defaultOrigins[0]");
  });''',
    '''  test("allows only exact configured account-deletion origins", async () => {
    const source = await readFile("supabase/functions/delete-account/index.ts", "utf8");
    expect(source).toContain('"https://gapwise-utm.vercel.app"');
    expect(source).toContain("configuredOrigins.has(origin)");
    expect(source).toContain("const originAllowed = isAllowedOrigin(origin)");
    expect(source).toContain("if (!originAllowed)");
    expect(source).not.toContain("gapwisePreviewOrigin");
    expect(source).not.toContain("https://*.vercel.app");
    expect(source).not.toContain("defaultOrigins[0]");
  });

  test("authoritative encrypted mode clears cross-account and legacy plaintext state", async () => {
    const [route, preferences, remembered] = await Promise.all([
      readFile("src/routes/index.tsx", "utf8"),
      readFile("src/features/sync/preferences.ts", "utf8"),
      readFile("src/hooks/use-preferences.ts", "utf8"),
    ]);
    expect(
      route.match(/restoredSource\\.current === "cloud" \\|\\| isEncryptedPrivateCloudAuthoritative/g),
    ).toHaveLength(2);
    expect(preferences).toContain("storage?.removeItem(LOCAL_PREFERENCES_KEY)");
    expect(remembered).toContain("window.localStorage.removeItem(TIMETABLE_KEY)");
    expect(remembered).toContain("window.localStorage.removeItem(REMEMBER_KEY)");
  });''',
)

print("PR #56 reviewed source fixes applied")

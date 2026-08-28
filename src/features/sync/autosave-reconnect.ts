export type AutosaveTarget = "skip" | "local" | "cloud";

/**
 * Decide where the current encrypted state still needs to be persisted.
 *
 * `lastCloudFingerprint` is intentionally independent from the restoration ref
 * used by the app shell. That lets reconnect remain idempotent even if other
 * lifecycle code invalidates a restoration cache while handling `online`.
 */
export function chooseAutosaveTarget({
  fingerprint,
  lastCloudFingerprint,
  pendingOfflineFingerprint,
  isOnline,
}: {
  fingerprint: string;
  lastCloudFingerprint: string | null;
  pendingOfflineFingerprint: string | null;
  isOnline: boolean;
}): AutosaveTarget {
  if (isOnline) {
    return fingerprint === lastCloudFingerprint && pendingOfflineFingerprint === null
      ? "skip"
      : "cloud";
  }

  return fingerprint === lastCloudFingerprint || fingerprint === pendingOfflineFingerprint
    ? "skip"
    : "local";
}

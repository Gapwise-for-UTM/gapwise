export type PrivateCloudMode = "encrypted";

/**
 * Production is permanently encrypted-only after Gate 6 retired the plaintext
 * schedule/preferences tables. There is intentionally no deployment flag or
 * plaintext fallback path left to select.
 */
export const privateCloudMode: PrivateCloudMode = "encrypted";
export const shouldWritePrivateCloud = true;
export const isEncryptedPrivateCloudAuthoritative = true;

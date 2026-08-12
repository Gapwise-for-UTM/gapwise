export type PrivateCloudMode = "off" | "shadow" | "encrypted";

const configuredMode = (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
  .env?.["VITE_PRIVATE_CLOUD_MODE"];

export const privateCloudMode: PrivateCloudMode =
  configuredMode === "shadow" || configuredMode === "encrypted" ? configuredMode : "off";

/** Shadow writes encrypted records but preserves the legacy production read path. */
export const shouldWritePrivateCloud = privateCloudMode !== "off";

/** Only this mode may stop legacy writes and restore the encrypted payload. */
export const isEncryptedPrivateCloudAuthoritative = privateCloudMode === "encrypted";

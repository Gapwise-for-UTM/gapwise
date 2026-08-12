export type PrivateCloudMode = "encrypted";

/**
 * The migration is complete: encrypted private cloud is the only signed-in cloud mode.
 * Guest mode remains local-only and does not depend on this setting.
 */
export const privateCloudMode: PrivateCloudMode = "encrypted";
export const shouldWritePrivateCloud = true;
export const isEncryptedPrivateCloudAuthoritative = true;

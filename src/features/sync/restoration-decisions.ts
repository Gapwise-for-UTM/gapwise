import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import type { Meeting } from "@/lib/timetable-types";

export type RestoredSource = "memory" | "local" | "cloud" | "none";

export function shouldClearAccountState(
  previousUserId: string | null,
  source: RestoredSource,
  privateCloudAuthoritative = isEncryptedPrivateCloudAuthoritative,
): boolean {
  return Boolean(previousUserId && (source === "cloud" || privateCloudAuthoritative));
}

export function memoryCandidate(
  source: RestoredSource,
  meetings: Meeting[] | null,
): Meeting[] | null {
  return source === "memory" ? meetings : null;
}

export function isCurrentRestorationRequest(input: {
  mounted: boolean;
  currentVersion: number;
  requestVersion: number;
  currentUserId: string | null;
  requestUserId: string;
}): boolean {
  return (
    input.mounted &&
    input.currentVersion === input.requestVersion &&
    input.currentUserId === input.requestUserId
  );
}

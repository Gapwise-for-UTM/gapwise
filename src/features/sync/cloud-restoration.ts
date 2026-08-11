import { loadScheduleRecord, type CloudScheduleRecord } from "./sync-service";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import { loadEncryptedPrivateState } from "./encrypted-sync-service";

type ScheduleLoader = (userId: string, signal: AbortSignal) => Promise<CloudScheduleRecord | null>;

type InFlightRestoration = {
  id: symbol;
  controller: AbortController;
  promise: Promise<CloudScheduleRecord | null>;
};

/** Deduplicates an authenticated restore and gives user changes a real abort path. */
export function createCloudRestorationCoordinator(loader: ScheduleLoader) {
  const inFlight = new Map<string, InFlightRestoration>();

  function restore(userId: string): Promise<CloudScheduleRecord | null> {
    const existing = inFlight.get(userId);
    if (existing) return existing.promise;

    const controller = new AbortController();
    const id = Symbol(userId);
    const promise = loader(userId, controller.signal).finally(() => {
      if (inFlight.get(userId)?.id === id) inFlight.delete(userId);
    });
    inFlight.set(userId, { id, controller, promise });
    return promise;
  }

  function cancel(userId: string | null) {
    if (!userId) return;
    const request = inFlight.get(userId);
    if (!request) return;
    inFlight.delete(userId);
    request.controller.abort();
  }

  function cancelAll() {
    for (const request of inFlight.values()) request.controller.abort();
    inFlight.clear();
  }

  return { restore, cancel, cancelAll };
}

export function isRestorationAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export const cloudRestoration = createCloudRestorationCoordinator(async (userId, signal) => {
  if (!isEncryptedPrivateCloudAuthoritative) return loadScheduleRecord(userId, signal);
  const restored = await loadEncryptedPrivateState(userId, signal);
  if (!restored) return null;
  return {
    meetings: restored.payload.schedule,
    updatedAt: restored.updatedAt,
    privateData: restored.payload,
    storageSource: restored.source === "cloud" ? "encrypted-cloud" : "secure-local",
    persistentKeys: restored.persistentKeys,
  };
});

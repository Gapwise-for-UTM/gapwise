import { describe, expect, test } from "bun:test";
import { createCloudRestorationCoordinator } from "@/features/sync/cloud-restoration";
import type { CloudScheduleRecord } from "@/features/sync/sync-service";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("cloud restoration coordinator", () => {
  test("single-flights duplicate restore requests for one authenticated user", async () => {
    const request = deferred<CloudScheduleRecord | null>();
    let calls = 0;
    const coordinator = createCloudRestorationCoordinator(async () => {
      calls += 1;
      return request.promise;
    });

    const first = coordinator.restore("user-1");
    const second = coordinator.restore("user-1");
    expect(first).toBe(second);
    expect(calls).toBe(1);

    request.resolve(null);
    await first;
  });

  test("aborts an in-flight request when the authenticated user changes", async () => {
    let signal: AbortSignal | null = null;
    const coordinator = createCloudRestorationCoordinator(
      (_userId, nextSignal) =>
        new Promise((_resolve, reject) => {
          signal = nextSignal;
          nextSignal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const restore = coordinator.restore("user-1");
    coordinator.cancel("user-1");
    expect(signal?.aborted).toBeTrue();
    await expect(restore).rejects.toMatchObject({ name: "AbortError" });
  });
});

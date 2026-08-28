import { describe, expect, test } from "bun:test";
import { chooseAutosaveTarget } from "../src/features/sync/autosave-reconnect";

describe("encrypted autosave reconnect targeting", () => {
  test("repeated online events do not rewrite an unchanged cloud state", () => {
    expect(
      chooseAutosaveTarget({
        fingerprint: "state-a",
        lastCloudFingerprint: "state-a",
        pendingOfflineFingerprint: null,
        isOnline: true,
      }),
    ).toBe("skip");
  });

  test("offline edits persist locally once and remain pending for cloud", () => {
    expect(
      chooseAutosaveTarget({
        fingerprint: "state-b",
        lastCloudFingerprint: "state-a",
        pendingOfflineFingerprint: null,
        isOnline: false,
      }),
    ).toBe("local");
    expect(
      chooseAutosaveTarget({
        fingerprint: "state-b",
        lastCloudFingerprint: "state-a",
        pendingOfflineFingerprint: "state-b",
        isOnline: false,
      }),
    ).toBe("skip");
  });

  test("reconnect flushes pending local work exactly once", () => {
    expect(
      chooseAutosaveTarget({
        fingerprint: "state-b",
        lastCloudFingerprint: "state-a",
        pendingOfflineFingerprint: "state-b",
        isOnline: true,
      }),
    ).toBe("cloud");
    expect(
      chooseAutosaveTarget({
        fingerprint: "state-b",
        lastCloudFingerprint: "state-b",
        pendingOfflineFingerprint: null,
        isOnline: true,
      }),
    ).toBe("skip");
  });

  test("going offline without a state change does not create deferred work", () => {
    expect(
      chooseAutosaveTarget({
        fingerprint: "state-a",
        lastCloudFingerprint: "state-a",
        pendingOfflineFingerprint: null,
        isOnline: false,
      }),
    ).toBe("skip");
  });

  test("a new online edit still writes through to cloud", () => {
    expect(
      chooseAutosaveTarget({
        fingerprint: "state-c",
        lastCloudFingerprint: "state-b",
        pendingOfflineFingerprint: null,
        isOnline: true,
      }),
    ).toBe("cloud");
  });
});

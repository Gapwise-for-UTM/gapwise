import { describe, expect, test } from "bun:test";
import { createClient, type AuthChangeEvent, type Session, type User } from "@supabase/supabase-js";
import { completeLocalSignOut } from "@/features/auth/auth-service";
import { createAuthStore, type AuthClient } from "@/features/auth/auth-store";
import { createSafeAuthStorage } from "@/lib/supabase";

const STORAGE_KEY = "sb-example-auth-token";

class MapStorage {
  constructor(private readonly values = new Map<string, string>()) {}

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function user(id = "user-1"): User {
  return {
    id,
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-08-01T00:00:00.000Z",
  } as User;
}

function session(id = "user-1", expiresAt = Math.floor(Date.now() / 1_000) + 3_600): Session {
  return {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3_600,
    expires_at: expiresAt,
    user: user(id),
  };
}

function clientWithStorage(
  storage: ReturnType<typeof createSafeAuthStorage>,
  fetch?: typeof global.fetch,
) {
  return createClient("https://example.supabase.co", "sb_publishable_test", {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    ...(fetch ? { global: { fetch } } : {}),
  });
}

describe("persistent Supabase auth storage", () => {
  test("attempts local session removal even when private-state cleanup fails", async () => {
    const cleanupError = new Error("cleanup failed");
    let sessionRemovalCalls = 0;
    await expect(
      completeLocalSignOut(
        () => {
          throw cleanupError;
        },
        async () => {
          sessionRemovalCalls += 1;
        },
      ),
    ).rejects.toBe(cleanupError);
    expect(sessionRemovalCalls).toBe(1);
  });

  test("starts local session removal without waiting for private cleanup", async () => {
    let finishCleanup!: () => void;
    let sessionRemoved = false;
    const signOut = completeLocalSignOut(
      () =>
        new Promise<void>((resolve) => {
          finishCleanup = resolve;
        }),
      async () => {
        sessionRemoved = true;
      },
    );

    await Promise.resolve();
    expect(sessionRemoved).toBe(true);
    finishCleanup();
    await signOut;
  });

  test("preserves falsy cleanup rejection values", async () => {
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

  test("survives adapter recreation like a reload or browser restart", async () => {
    const persistent = new MapStorage();
    const firstStorage = createSafeAuthStorage(persistent);
    firstStorage.setItem(STORAGE_KEY, JSON.stringify(session()));

    const firstClient = clientWithStorage(firstStorage);
    expect((await firstClient.auth.getSession()).data.session?.user.id).toBe("user-1");
    firstClient.auth.stopAutoRefresh();

    const reopenedClient = clientWithStorage(createSafeAuthStorage(persistent));
    expect((await reopenedClient.auth.getSession()).data.session?.user.id).toBe("user-1");
    reopenedClient.auth.stopAutoRefresh();
  });

  test("falls back to page memory when private browsing blocks storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const storage = createSafeAuthStorage(blocked);

    expect(() => storage.setItem("session", "active")).not.toThrow();
    expect(storage.getItem("session")).toBe("active");
    expect(() => storage.removeItem("session")).not.toThrow();
    expect(storage.getItem("session")).toBeNull();
  });

  test("invalidates a readable durable session when direct removal is blocked", () => {
    const values = new Map([["session", "active"]]);
    const persistent = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: () => {
        throw new Error("removal blocked");
      },
    };

    const storage = createSafeAuthStorage(persistent);
    expect(() => storage.removeItem("session")).not.toThrow();
    expect(createSafeAuthStorage(persistent).getItem("session")).toBeNull();
  });

  test("reports sign-out failure when a readable durable session cannot be invalidated", () => {
    const persistent = {
      getItem: () => "active",
      setItem: () => {
        throw new Error("write blocked");
      },
      removeItem: () => {
        throw new Error("removal blocked");
      },
    };

    expect(() => createSafeAuthStorage(persistent).removeItem("session")).toThrow(
      "removal blocked",
    );
  });

  test("treats malformed and invalid expired sessions as signed out without leaking tokens", async () => {
    const malformedStorage = new MapStorage();
    malformedStorage.setItem(STORAGE_KEY, "not-json");
    const malformedClient = clientWithStorage(createSafeAuthStorage(malformedStorage));
    expect((await malformedClient.auth.getSession()).data.session).toBeNull();
    malformedClient.auth.stopAutoRefresh();

    const expiredStorage = new MapStorage();
    expiredStorage.setItem(STORAGE_KEY, JSON.stringify(session("expired-user", 1)));
    const logs: string[] = [];
    const originalError = console.error;
    console.error = (...values: unknown[]) => logs.push(values.map(String).join(" "));
    try {
      const expiredClient = clientWithStorage(
        createSafeAuthStorage(expiredStorage),
        async () =>
          new Response(JSON.stringify({ message: "Invalid Refresh Token" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          }),
      );
      const result = await expiredClient.auth.getSession();
      expect(result.data.session).toBeNull();
      expect(result.error).toBeTruthy();
      expect(expiredStorage.getItem(STORAGE_KEY)).toBeNull();
      expiredClient.auth.stopAutoRefresh();
    } finally {
      console.error = originalError;
    }
    expect(logs.join(" ")).not.toContain("test-access-token");
    expect(logs.join(" ")).not.toContain("test-refresh-token");
  });

  test("local sign-out clears the durable browser session", async () => {
    const persistent = new MapStorage();
    persistent.setItem(STORAGE_KEY, JSON.stringify(session()));
    const client = clientWithStorage(
      createSafeAuthStorage(persistent),
      async () =>
        new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );

    expect((await client.auth.getSession()).data.session).not.toBeNull();
    expect((await client.auth.signOut({ scope: "local" })).error).toBeNull();
    expect(persistent.getItem(STORAGE_KEY)).toBeNull();
    client.auth.stopAutoRefresh();
  });

  test("network-failed sign-out still removes the durable local session", async () => {
    const persistent = new MapStorage();
    persistent.setItem(STORAGE_KEY, JSON.stringify(session()));
    const client = clientWithStorage(createSafeAuthStorage(persistent), async () => {
      throw new TypeError("offline");
    });

    const result = await client.auth.signOut({ scope: "local" });
    expect(result.error).toBeTruthy();
    expect(persistent.getItem(STORAGE_KEY)).toBeNull();
    client.auth.stopAutoRefresh();
  });
});

describe("page-lifetime auth store", () => {
  test("registers one SDK subscription and ignores stale post-sign-out callbacks", () => {
    let callback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
    let registrations = 0;
    let unsubscriptions = 0;
    const auth: AuthClient = {
      onAuthStateChange(next) {
        registrations += 1;
        callback = next;
        return {
          data: {
            subscription: { unsubscribe: () => (unsubscriptions += 1) },
          },
        };
      },
    };
    const store = createAuthStore(auth);
    let notifications = 0;
    const unsubscribeFirst = store.subscribe(() => (notifications += 1));
    unsubscribeFirst();
    store.subscribe(() => (notifications += 1));

    expect(registrations).toBe(1);
    callback!("INITIAL_SESSION", session());
    const originalUser = store.getSnapshot().user;
    expect(originalUser?.id).toBe("user-1");

    callback!("TOKEN_REFRESHED", session());
    expect(store.getSnapshot().user).toBe(originalUser);
    expect(notifications).toBe(1);

    store.forceSignedOut();
    callback!("SIGNED_OUT", null);
    callback!("TOKEN_REFRESHED", session());
    callback!("INITIAL_SESSION", session());
    expect(store.getSnapshot().user).toBeNull();

    callback!("SIGNED_IN", session());
    expect(store.getSnapshot().user?.id).toBe("user-1");
    store.dispose();
    expect(unsubscriptions).toBe(1);
  });
});

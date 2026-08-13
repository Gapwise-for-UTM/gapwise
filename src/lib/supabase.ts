import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type { Database, Json } from "./database.types";

type StorageAdapter = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const viteEnv = (
  import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }
).env;
const url = viteEnv?.["VITE_SUPABASE_URL"]?.trim() ?? "";
const publishableKey = viteEnv?.["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? "";

/**
 * Keeps Supabase on its supported storage interface while making browser privacy
 * failures non-fatal. Successful writes use localStorage; memory is only a
 * same-page fallback and never replaces durable browser persistence.
 */
export function createSafeAuthStorage(
  persistentStorage: BrowserStorage | null,
  memory = new Map<string, string>(),
): StorageAdapter {
  const durableKeys = new Set<string>();
  return {
    getItem(key) {
      if (persistentStorage) {
        try {
          const value = persistentStorage.getItem(key);
          if (value === null || value === "") {
            memory.delete(key);
            durableKeys.delete(key);
          } else {
            memory.set(key, value);
            durableKeys.add(key);
          }
          return value || null;
        } catch {
          // Fall through to the in-memory session when storage is blocked mid-session.
        }
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      if (persistentStorage) {
        try {
          persistentStorage.setItem(key, value);
          durableKeys.add(key);
        } catch {
          // The active tab remains usable, but the session will be nonpersistent.
        }
      }
    },
    removeItem(key) {
      memory.delete(key);
      if (persistentStorage) {
        try {
          persistentStorage.removeItem(key);
          durableKeys.delete(key);
        } catch (removalError) {
          try {
            persistentStorage.setItem(key, "");
            if (persistentStorage.getItem(key) === "") {
              durableKeys.delete(key);
              return;
            }
          } catch {
            // Report a readable durable session that could not be invalidated.
          }
          try {
            if (persistentStorage.getItem(key) === null) {
              durableKeys.delete(key);
              return;
            }
          } catch {
            if (!durableKeys.has(key)) return;
          }
          throw removalError;
        }
      }
    },
  };
}

function persistentBrowserStorage(): BrowserStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let client: SupabaseClient<Database> | null = null;
let configurationError: string | null = null;

if (url && publishableKey) {
  try {
    client = createClient<Database>(url, publishableKey, {
      auth: {
        storage: createSafeAuthStorage(persistentBrowserStorage()),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    configurationError = "Supabase environment variables are present but invalid.";
  }
}

export const isSupabaseConfigured = client !== null;
export const supabaseConfigurationNotice = isSupabaseConfigured
  ? null
  : (configurationError ??
    "Cloud sync is off. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable it.");

export function getSupabaseClient(): SupabaseClient<Database> | null {
  return client;
}

export class SupabaseUnavailableError extends Error {
  constructor() {
    super("Cloud sync is unavailable because Supabase is not configured.");
  }
}

export function requireSupabaseClient(): SupabaseClient<Database> {
  if (!client) throw new SupabaseUnavailableError();
  return client;
}

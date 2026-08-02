import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      user_schedules: {
        Row: {
          user_id: string;
          meetings: Json;
          source_filename: string | null;
          schema_version: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          meetings: Json;
          source_filename?: string | null;
          schema_version?: number;
          updated_at?: string;
        };
        Update: {
          meetings?: Json;
          source_filename?: string | null;
          schema_version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          walking_speed_mps: number;
          route_mode: string;
          transition_buffer_minutes: number;
          avoid_stairs: boolean;
          prefer_indoor: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          walking_speed_mps?: number;
          route_mode?: string;
          transition_buffer_minutes?: number;
          avoid_stairs?: boolean;
          prefer_indoor?: boolean;
          updated_at?: string;
        };
        Update: {
          walking_speed_mps?: number;
          route_mode?: string;
          transition_buffer_minutes?: number;
          avoid_stairs?: boolean;
          prefer_indoor?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

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
  return {
    getItem(key) {
      if (persistentStorage) {
        try {
          const value = persistentStorage.getItem(key);
          if (value === null) memory.delete(key);
          else memory.set(key, value);
          return value;
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
        } catch {
          // Memory has still been cleared, so this page is signed out safely.
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

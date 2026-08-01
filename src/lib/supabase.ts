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

const viteEnv = (
  import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }
).env;
const url = viteEnv?.["VITE_SUPABASE_URL"]?.trim() ?? "";
const publishableKey = viteEnv?.["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? "";

const memorySession = new Map<string, string>();
const memoryStorage: StorageAdapter = {
  getItem: (key) => memorySession.get(key) ?? null,
  setItem: (key, value) => {
    memorySession.set(key, value);
  },
  removeItem: (key) => {
    memorySession.delete(key);
  },
};

function sessionOnlyStorage(): StorageAdapter {
  return typeof window === "undefined" ? memoryStorage : window.sessionStorage;
}

let client: SupabaseClient<Database> | null = null;
let configurationError: string | null = null;

if (url && publishableKey) {
  try {
    client = createClient<Database>(url, publishableKey, {
      auth: {
        storage: sessionOnlyStorage(),
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

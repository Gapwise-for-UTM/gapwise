import { requireSupabaseClient } from "@/lib/supabase";
import type { AiActionCompletion, AiDelegationStatus, AiSnapshot, PendingAiAction } from "./types";

const viteEnv = (
  import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }
).env;

function configuredBaseUrl(): string | null {
  const raw = viteEnv?.["VITE_GAPWISE_AI_URL"]?.trim() ?? "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.pathname !== "/" || url.search || url.hash) return null;
    if (import.meta.env.PROD && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const GAPWISE_AI_BASE_URL = configuredBaseUrl();
export const isGapwiseAiConfigured = GAPWISE_AI_BASE_URL !== null;

const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

type ApiRecord = Record<string, unknown> & {
  enabled?: unknown;
  revision?: unknown;
  updatedAt?: unknown;
  permissions?: unknown;
  actions?: unknown;
  error?: unknown;
  message?: unknown;
  approved?: unknown;
  clientId?: unknown;
  clients?: unknown;
  revoked?: unknown;
  clientIds?: unknown;
};

async function accessToken(): Promise<string> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in before using Gapwise AI.");
  return data.session.access_token;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > MAX_RESPONSE_BYTES)
    throw new Error("Gapwise AI response is too large.");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("Gapwise AI response is too large.");
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Gapwise AI returned malformed data.");
  }
}

async function aiRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  if (!GAPWISE_AI_BASE_URL) throw new Error("Gapwise AI is not configured for this deployment.");
  const token = await accessToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${GAPWISE_AI_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body = await readBoundedJson(response);
    if (!response.ok) {
      const message =
        isRecord(body) && typeof body.message === "string"
          ? body.message
          : "Gapwise AI request failed.";
      const error = new Error(message) as Error & { status?: number; code?: string };
      error.status = response.status;
      if (isRecord(body) && typeof body.error === "string") error.code = body.error;
      throw error;
    }
    return body;
  } finally {
    window.clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getAiDelegationStatus(): Promise<AiDelegationStatus> {
  const body = await aiRequest("/api/delegation");
  if (!isRecord(body) || typeof body.enabled !== "boolean") {
    throw new Error("Gapwise AI delegation status is malformed.");
  }
  if (!body.enabled) return { enabled: false };
  if (
    !Number.isSafeInteger(body.revision) ||
    typeof body.updatedAt !== "string" ||
    !isRecord(body.permissions)
  ) {
    throw new Error("Gapwise AI delegation status is malformed.");
  }
  return body as AiDelegationStatus;
}

export async function publishAiSnapshot(
  snapshot: AiSnapshot,
): Promise<{ revision: number; updatedAt: string }> {
  const body = await aiRequest("/api/delegation/snapshot", {
    method: "PUT",
    body: JSON.stringify(snapshot),
  });
  if (
    !isRecord(body) ||
    !Number.isSafeInteger(body.revision) ||
    typeof body.updatedAt !== "string"
  ) {
    throw new Error("Gapwise AI snapshot response is malformed.");
  }
  return { revision: body.revision as number, updatedAt: body.updatedAt };
}

export async function getPendingAiActions(): Promise<PendingAiAction[]> {
  const body = await aiRequest("/api/delegation/actions");
  if (!isRecord(body) || !Array.isArray(body.actions)) {
    throw new Error("Gapwise AI queued actions response is malformed.");
  }
  return body.actions as PendingAiAction[];
}

export async function completeAiAction(
  actionId: string,
  completion: AiActionCompletion,
): Promise<void> {
  await aiRequest(`/api/delegation/actions/${encodeURIComponent(actionId)}/complete`, {
    method: "POST",
    body: JSON.stringify(completion),
  });
}

export async function approveAiOAuthClient(clientId: string, clientName: string): Promise<void> {
  const body = await aiRequest("/api/delegation/clients", {
    method: "POST",
    body: JSON.stringify({ clientId, clientName }),
  });
  if (!isRecord(body) || body.approved !== true || body.clientId !== clientId) {
    throw new Error("Gapwise AI OAuth client approval response is malformed.");
  }
}

export async function revokeAiOAuthClientApprovals(): Promise<string[]> {
  const body = await aiRequest("/api/delegation/clients", { method: "DELETE" });
  if (
    !isRecord(body) ||
    body.revoked !== true ||
    !Array.isArray(body.clientIds) ||
    !body.clientIds.every((value) => typeof value === "string")
  ) {
    throw new Error("Gapwise AI OAuth revocation response is malformed.");
  }
  return body.clientIds as string[];
}

export async function revokeAiDelegation(): Promise<void> {
  // Remove the database allowlist first. Even if OAuth grant revocation is unavailable,
  // existing client tokens immediately lose access to every AI row under restrictive RLS.
  const clientIds = await revokeAiOAuthClientApprovals();
  await aiRequest("/api/delegation", { method: "DELETE" });

  const supabase = requireSupabaseClient();
  await Promise.allSettled(
    clientIds.map((clientId) => supabase.auth.oauth.revokeGrant({ clientId })),
  );
}

import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/database.types";
import { ApiError } from "./http";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9._~-]+)$/u;
const MAX_AUTHORIZATION_BYTES = 8 * 1024;

export type AuthenticatedRequest = {
  accessToken: string;
  client: SupabaseClient<Database>;
  userId: string;
};

function serverSupabaseConfiguration(): { publishableKey: string; url: string } {
  const url = (process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "").trim();
  const publishableKey = (
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    ""
  ).trim();
  if (!url || !publishableKey) throw new Error("Supabase server configuration is missing.");
  return { url, publishableKey };
}

export function readBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.length > MAX_AUTHORIZATION_BYTES) {
    throw new ApiError(401, "Authentication required.");
  }
  const match = authorization.match(BEARER_PATTERN);
  if (!match?.[1]) throw new ApiError(401, "Authentication required.");
  return match[1];
}

function createServerSupabaseClient(accessToken?: string): SupabaseClient<Database> {
  const { url, publishableKey } = serverSupabaseConfiguration();
  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

export async function authenticateSupabaseRequest(request: Request): Promise<AuthenticatedRequest> {
  const accessToken = readBearerToken(request);
  const verifier = createServerSupabaseClient();
  const { data, error } = await verifier.auth.getClaims(accessToken);
  const subject = data?.claims.sub;
  if (
    error ||
    data?.claims.role !== "authenticated" ||
    typeof subject !== "string" ||
    !UUID_PATTERN.test(subject)
  ) {
    throw new ApiError(401, "Authentication required.");
  }
  return {
    accessToken,
    client: createServerSupabaseClient(accessToken),
    userId: subject,
  };
}

import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const ALLOWED_ORIGIN = "https://gapwise.ca";
const MAX_REQUEST_BYTES = 4_096;

type Body = { action?: unknown; productUpdates?: unknown };

function corsHeaders(origin: string | null) {
  return {
    ...(origin === ALLOWED_ORIGIN ? { "access-control-allow-origin": ALLOWED_ORIGIN } : {}),
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    vary: "Origin",
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "content-type": "application/json; charset=utf-8" },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  let key = "";
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      if (typeof parsed.default === "string") key = parsed.default.trim();
    } catch {
      // Fall back to the legacy service role variable below.
    }
  }
  if (!key) key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!url || !key) throw new Error("Supabase admin credentials are unavailable.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function isDelegatedToken(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return true;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as Record<string, unknown>;
    return typeof claims.client_id === "string" && claims.client_id.length > 0;
  } catch {
    return true;
  }
}

async function authorize(request: Request, supabase: ReturnType<typeof adminClient>) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/iu, "").trim();
  if (!token || isDelegatedToken(token)) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

async function parseBody(request: Request): Promise<Body | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) return null;
  const raw = await request.text();
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Body) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);

  try {
    const body = await parseBody(request);
    if (!body) return json(400, { error: "invalid_request" }, origin);
    const supabase = adminClient();
    const user = await authorize(request, supabase);
    if (!user) return json(401, { error: "authentication_required" }, origin);

    if (body.action === "read") {
      const [preferences, events] = await Promise.all([
        supabase.from("user_email_preferences").select("product_updates,security_notices").eq("user_id", user.id).maybeSingle(),
        supabase.from("ai_access_events").select("id,client_name,event_type,capability,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      ]);
      if (preferences.error || events.error) throw preferences.error ?? events.error;
      return json(200, {
        ok: true,
        preferences: preferences.data ?? { product_updates: false, security_notices: true },
        aiEvents: events.data ?? [],
      }, origin);
    }

    if (body.action === "set_product_updates" && typeof body.productUpdates === "boolean") {
      const now = new Date().toISOString();
      const { error } = await supabase.from("user_email_preferences").upsert({
        user_id: user.id,
        product_updates: body.productUpdates,
        security_notices: true,
        updated_at: now,
      });
      if (error) throw error;
      return json(200, { ok: true, productUpdates: body.productUpdates }, origin);
    }

    return json(400, { error: "invalid_action" }, origin);
  } catch (error) {
    console.error(JSON.stringify({
      event: "account_settings_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json(503, { error: "settings_unavailable" }, origin);
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const ALLOWED_ORIGIN = "https://gapwise.ca";

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

function json(status: number, body: Record<string, unknown>, origin: string | null, requestId: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId,
    },
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
      // Legacy service role fallback below.
    }
  }
  if (!key) key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!url || !key) throw new Error("Supabase admin credentials are unavailable.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function delegatedToken(token: string) {
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
  if (!token || delegatedToken(token)) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: operator, error: operatorError } = await supabase
    .from("email_operators")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (operatorError || !operator) return null;
  return data.user;
}

async function exactCount(supabase: ReturnType<typeof adminClient>, table: string, apply?: (query: any) => any) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const requestId = request.headers.get("x-request-id")?.trim() || `gw_req_${crypto.randomUUID().replaceAll("-", "")}`;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin, requestId);

  try {
    const supabase = adminClient();
    const user = await authorize(request, supabase);
    if (!user) return json(404, { error: "not_found" }, origin, requestId);

    const [users, encryptedProfiles, aiDelegations, inboundMail, failedMail, recentEvents, recentAudit] = await Promise.all([
      exactCount(supabase, "user_onboarding"),
      exactCount(supabase, "encrypted_private_data"),
      exactCount(supabase, "ai_delegations", (q) => q.eq("enabled", true)),
      exactCount(supabase, "resend_email_messages", (q) => q.eq("direction", "inbound")),
      exactCount(supabase, "resend_email_messages", (q) => q.in("latest_event_type", ["email.failed", "email.bounced", "email.suppressed"])),
      supabase.schema("private").from("system_events").select("event_type,service,severity,request_id,created_at").order("created_at", { ascending: false }).limit(20),
      supabase.schema("private").from("operator_audit_log").select("action,resource_type,resource_id,request_id,created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    if (recentEvents.error) throw recentEvents.error;
    if (recentAudit.error) throw recentAudit.error;

    await supabase.schema("private").from("operator_audit_log").insert({
      actor_user_id: user.id,
      action: "ops.overview.read",
      resource_type: "operations",
      request_id: requestId,
      metadata: {},
    });

    return json(200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      counts: { users, encryptedProfiles, aiDelegations, inboundMail, failedMail },
      recentEvents: recentEvents.data ?? [],
      recentAudit: recentAudit.data ?? [],
    }, origin, requestId);
  } catch (error) {
    console.error(JSON.stringify({ event: "ops_console_failed", requestId, message: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
    return json(503, { error: "operations_unavailable" }, origin, requestId);
  }
});

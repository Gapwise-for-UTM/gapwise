import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const ALLOWED_ORIGIN = "https://gapwise.ca";
const MAX_REQUEST_BYTES = 4_096;

type LifecycleEvent = "onboarding_completed" | "ai_authorized" | "ai_revoked";
type Body = { event?: unknown; clientName?: unknown };
type TemplateConfig = {
  id: string;
  from: string;
  subject: string;
  replyTo: string;
  category: string;
};

const TEMPLATES: Record<LifecycleEvent, TemplateConfig> = {
  onboarding_completed: {
    id: "gapwise-welcome",
    from: "Gapwise <hello@gapwise.ca>",
    subject: "Welcome to Gapwise",
    replyTo: "support@inbound.gapwise.ca",
    category: "onboarding_welcome",
  },
  ai_authorized: {
    id: "gapwise-ai-authorized",
    from: "Gapwise Security <security@gapwise.ca>",
    subject: "New AI access to Gapwise",
    replyTo: "security@inbound.gapwise.ca",
    category: "ai_authorized",
  },
  ai_revoked: {
    id: "gapwise-ai-revoked",
    from: "Gapwise Security <security@gapwise.ca>",
    subject: "AI access to Gapwise was revoked",
    replyTo: "security@inbound.gapwise.ca",
    category: "ai_revoked",
  },
};

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
      // Legacy fallback below.
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
    const claims = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    ) as Record<string, unknown>;
    return typeof claims.client_id === "string" && claims.client_id.length > 0;
  } catch {
    return true;
  }
}

async function readBody(request: Request): Promise<Body | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) return null;
  const raw = await request.text();
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Body) : null;
  } catch {
    return null;
  }
}

function eventValue(value: unknown): LifecycleEvent | null {
  return value === "onboarding_completed" || value === "ai_authorized" || value === "ai_revoked"
    ? value
    : null;
}

function clientNameValue(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 240 && !/[\u0000-\u001f\u007f]/u.test(name)
    ? name
    : null;
}

async function stableUserKey(userId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);

  try {
    const body = await readBody(request);
    const event = eventValue(body?.event);
    if (!body || !event) return json(400, { error: "invalid_event" }, origin);

    const clientName = event === "onboarding_completed" ? null : clientNameValue(body.clientName);
    if (event !== "onboarding_completed" && !clientName) {
      return json(400, { error: "invalid_client_name" }, origin);
    }

    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/iu, "").trim();
    if (!token || delegatedToken(token)) return json(401, { error: "authentication_required" }, origin);

    const supabase = adminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) return json(401, { error: "authentication_required" }, origin);

    const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
    if (!apiKey) return json(503, { error: "mail_transport_unavailable" }, origin);

    const template = TEMPLATES[event];
    const userKey = await stableUserKey(data.user.id);
    const idempotencyKey =
      event === "onboarding_completed"
        ? `gapwise-welcome-${userKey}`
        : `gapwise-${event}-${userKey}-${await stableUserKey(clientName ?? "")}`;

    const variables = clientName ? { CLIENT_NAME: clientName } : undefined;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: template.from,
        to: [data.user.email],
        subject: template.subject,
        reply_to: [template.replyTo],
        template: { id: template.id, ...(variables ? { variables } : {}) },
        tags: [{ name: "category", value: template.category }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(
        JSON.stringify({
          event: "lifecycle_email_send_failed",
          lifecycleEvent: event,
          status: response.status,
        }),
      );
      return json(502, { error: "send_failed" }, origin);
    }

    return json(200, { ok: true }, origin);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "lifecycle_email_failed",
        message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      }),
    );
    return json(503, { error: "lifecycle_email_unavailable" }, origin);
  }
});

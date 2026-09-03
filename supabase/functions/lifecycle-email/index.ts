import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const ALLOWED_ORIGIN = "https://gapwise.ca";
const MAX_REQUEST_BYTES = 2_048;

type Body = { event?: unknown };

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
      // Fall back below.
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

async function readBody(request: Request): Promise<Body | null> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) return null;
  const raw = await request.text();
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Body) : null;
  } catch {
    return null;
  }
}

function welcomeText() {
  return `Welcome to Gapwise.\n\nYour account is ready. Import your ACORN timetable when you're ready; Gapwise parses it locally before any optional sync.\n\nThree things to try:\n• Today — see your next class, active gap, and leave-by timing.\n• Campus — route between UTM buildings and places.\n• Can I go there? — check whether a destination fits before your next class.\n\nOpen Gapwise: https://gapwise.ca\n\nGapwise is an independent student project and is not affiliated with or endorsed by the University of Toronto.`;
}

function welcomeHtml() {
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:16px"><tr><td style="padding:32px"><p style="margin:0 0 12px;font-size:12px;line-height:18px;color:#64748b;letter-spacing:.12em">GAPWISE</p><h1 style="margin:0 0 16px;font-size:28px;line-height:34px;color:#0f172a">Welcome to Gapwise</h1><p style="margin:0 0 18px;font-size:16px;line-height:25px;color:#334155">Your account is ready. Import your ACORN timetable when you're ready; Gapwise parses it locally before any optional sync.</p><p style="margin:0 0 8px;font-size:15px;line-height:24px;color:#334155"><strong>Today</strong> — next class, active gap, and leave-by timing.</p><p style="margin:0 0 8px;font-size:15px;line-height:24px;color:#334155"><strong>Campus</strong> — routes between UTM buildings and places.</p><p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#334155"><strong>Can I go there?</strong> — destination feasibility before your next class.</p><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#0f172a;border-radius:10px"><a href="https://gapwise.ca" style="display:inline-block;padding:12px 18px;color:#fff;text-decoration:none;font-size:15px;line-height:20px">Open Gapwise</a></td></tr></table><p style="margin:28px 0 0;font-size:12px;line-height:18px;color:#94a3b8">Gapwise is an independent student project and is not affiliated with or endorsed by the University of Toronto.</p></td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);

  try {
    const body = await readBody(request);
    if (!body || body.event !== "onboarding_completed") return json(400, { error: "invalid_event" }, origin);

    const supabase = adminClient();
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/iu, "").trim();
    if (!token || delegatedToken(token)) return json(401, { error: "authentication_required" }, origin);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) return json(401, { error: "authentication_required" }, origin);

    const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
    if (!apiKey) return json(503, { error: "mail_transport_unavailable" }, origin);

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data.user.id));
    const idempotency = Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
        "Idempotency-Key": `gapwise-welcome-${idempotency}`,
      },
      body: JSON.stringify({
        from: "Gapwise <hello@gapwise.ca>",
        to: [data.user.email],
        subject: "Welcome to Gapwise",
        text: welcomeText(),
        html: welcomeHtml(),
        reply_to: ["support@inbound.gapwise.ca"],
        tags: [{ name: "category", value: "onboarding_welcome" }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(JSON.stringify({ event: "welcome_email_failed", status: response.status }));
      return json(502, { error: "send_failed" }, origin);
    }
    return json(200, { ok: true }, origin);
  } catch (error) {
    console.error(JSON.stringify({ event: "lifecycle_email_failed", message: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
    return json(503, { error: "lifecycle_email_unavailable" }, origin);
  }
});

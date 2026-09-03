import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const ALLOWED_ORIGIN = "https://gapwise.ca";
const MAX_REQUEST_BYTES = 4_096;
type LifecycleEvent = "onboarding_completed" | "ai_authorized" | "ai_revoked";
type Body = { event?: unknown; clientName?: unknown };
type Mail = { from: string; replyTo: string; subject: string; category: string; heading: string; paragraphs: string[]; cta: string };

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
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "content-type": "application/json; charset=utf-8" } });
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
  return createClient(url, key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
}
function delegatedToken(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return true;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))) as Record<string, unknown>;
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
  return value === "onboarding_completed" || value === "ai_authorized" || value === "ai_revoked" ? value : null;
}
function clientNameValue(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 240 && !/[\u0000-\u001f\u007f]/u.test(name) ? name : null;
}
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function mailFor(event: LifecycleEvent, clientName: string | null): Mail {
  if (event === "onboarding_completed") {
    return {
      from: "Gapwise <hello@gapwise.ca>", replyTo: "support@inbound.gapwise.ca", subject: "Welcome to Gapwise", category: "onboarding_welcome", heading: "Welcome to Gapwise", cta: "Open Gapwise",
      paragraphs: [
        "Your account is ready. Import your ACORN timetable when you're ready; Gapwise parses it locally before any optional sync.",
        "Try Today for your next class and leave-by timing, Campus for UTM routes, and Can I go there? for destination feasibility before your next class.",
        "Gapwise is an independent student project and is not affiliated with or endorsed by the University of Toronto.",
      ],
    };
  }
  if (!clientName) throw new Error("AI lifecycle notice requires a client name.");
  const authorized = event === "ai_authorized";
  return {
    from: "Gapwise Security <security@gapwise.ca>", replyTo: "security@inbound.gapwise.ca",
    subject: authorized ? "New AI access to Gapwise" : "AI access to Gapwise was revoked",
    category: authorized ? "ai_authorized" : "ai_revoked",
    heading: authorized ? "New AI access authorized" : "AI access revoked",
    cta: "Review AI access",
    paragraphs: authorized
      ? [`You authorized ${clientName} to access permitted Gapwise context.`, "Gapwise AI is permissioned and does not grant assistants access to raw ACORN files, precise live location, credentials, or encryption keys.", "If you did not authorize this, revoke access and contact security@gapwise.ca."]
      : [`Access for ${clientName} was revoked. That client is no longer approved to access delegated Gapwise context.`, "If you did not make this change, review your account security and contact security@gapwise.ca."],
  };
}
function plainText(mail: Mail) {
  const destination = mail.category === "onboarding_welcome" ? "https://gapwise.ca" : "https://gapwise.ca/settings";
  return `${mail.heading}\n\n${mail.paragraphs.join("\n\n")}\n\n${mail.cta}: ${destination}`;
}
function html(mail: Mail) {
  const destination = mail.category === "onboarding_welcome" ? "https://gapwise.ca" : "https://gapwise.ca/settings";
  const paragraphs = mail.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155">${escapeHtml(p)}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:16px"><tr><td style="padding:32px"><p style="margin:0 0 12px;font-size:12px;line-height:18px;color:#64748b;letter-spacing:.12em">GAPWISE</p><h1 style="margin:0 0 16px;font-size:28px;line-height:34px;color:#0f172a">${escapeHtml(mail.heading)}</h1>${paragraphs}<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#0f172a;border-radius:10px"><a href="${destination}" style="display:inline-block;padding:12px 18px;color:#fff;text-decoration:none;font-size:15px;line-height:20px">${escapeHtml(mail.cta)}</a></td></tr></table></td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  try {
    const body = await readBody(request);
    const event = eventValue(body?.event);
    if (!body || !event) return json(400, { error: "invalid_event" }, origin);
    const clientName = event === "onboarding_completed" ? null : clientNameValue(body.clientName);
    if (event !== "onboarding_completed" && !clientName) return json(400, { error: "invalid_client_name" }, origin);

    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/iu, "").trim();
    if (!token || delegatedToken(token)) return json(401, { error: "authentication_required" }, origin);
    const supabase = adminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) return json(401, { error: "authentication_required" }, origin);
    const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
    if (!apiKey) return json(503, { error: "mail_transport_unavailable" }, origin);

    const mail = mailFor(event, clientName);
    const headers: Record<string, string> = { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" };
    if (event === "onboarding_completed") {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data.user.id));
      const id = Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      headers["Idempotency-Key"] = `gapwise-welcome-${id}`;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers,
      body: JSON.stringify({ from: mail.from, to: [data.user.email], subject: mail.subject, text: plainText(mail), html: html(mail), reply_to: [mail.replyTo], tags: [{ name: "category", value: mail.category }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ event: "lifecycle_email_send_failed", lifecycleEvent: event, status: response.status }));
      return json(502, { error: "send_failed" }, origin);
    }
    return json(200, { ok: true }, origin);
  } catch (error) {
    console.error(JSON.stringify({ event: "lifecycle_email_failed", message: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
    return json(503, { error: "lifecycle_email_unavailable" }, origin);
  }
});

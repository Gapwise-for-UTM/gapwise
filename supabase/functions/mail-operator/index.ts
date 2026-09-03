import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "access-control-allow-origin": "https://gapwise.ca",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const MAX_REQUEST_BYTES = 110_000;

type Mailbox = "support" | "security" | "hello" | "general" | "test";

type RequestBody = {
  action?: unknown;
  mailbox?: unknown;
  threadId?: unknown;
  messageId?: unknown;
  text?: unknown;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  let key = "";
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      if (typeof parsed["default"] === "string") key = parsed["default"].trim();
    } catch {
      // Fall back to legacy service role below.
    }
  }
  if (!key) key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!url || !key) throw new Error("Supabase admin credentials are unavailable.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function stringValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function mailboxValue(value: unknown): Mailbox | null {
  return value === "support" || value === "security" || value === "hello" ||
      value === "general" || value === "test"
    ? value
    : null;
}

function senderForMailbox(mailbox: Mailbox) {
  if (mailbox === "security") {
    return {
      from: "Gapwise Security <security@gapwise.ca>",
      replyTo: "security@inbound.gapwise.ca",
    };
  }
  if (mailbox === "hello" || mailbox === "general") {
    return {
      from: "Gapwise <hello@gapwise.ca>",
      replyTo: "hello@inbound.gapwise.ca",
    };
  }
  return {
    from: "Gapwise Support <support@gapwise.ca>",
    replyTo: "support@inbound.gapwise.ca",
  };
}

function bareEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/<([^<>\s]+@[^<>\s]+)>/u);
  const candidate = (match?.[1] ?? value).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(candidate) ? candidate : null;
}

function replySubject(subject: unknown) {
  const value = typeof subject === "string" && subject.trim() ? subject.trim() : "Gapwise message";
  return /^re:/iu.test(value) ? value : `Re: ${value}`;
}

function uniqueReferences(values: unknown[], current: string | null) {
  const result: string[] = [];
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (typeof item === "string" && item.trim() && !result.includes(item.trim())) {
        result.push(item.trim());
      }
    }
  }
  if (current && !result.includes(current)) result.push(current);
  return result.slice(-30);
}

async function readRequestBody(request: Request): Promise<RequestBody | null> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return null;

  const raw = await request.text();
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as RequestBody)
      : null;
  } catch {
    return null;
  }
}

async function authorize(request: Request, supabase: ReturnType<typeof adminClient>) {
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const token = auth.replace(/^Bearer\s+/iu, "").trim();
  if (!token) return null;
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

async function sendReply(
  supabase: ReturnType<typeof adminClient>,
  messageId: string,
  text: string,
) {
  const { data: parent, error } = await supabase
    .from("resend_email_messages")
    .select("*")
    .eq("resend_email_id", messageId)
    .maybeSingle();
  if (error || !parent) return json(404, { error: "message_not_found" });

  const mailbox = mailboxValue(parent.mailbox);
  if (!mailbox) return json(400, { error: "unsupported_mailbox" });
  const recipient = bareEmail(parent.direction === "inbound" ? parent.from_address : parent.to_addresses?.[0]);
  if (!recipient) return json(400, { error: "recipient_unavailable" });

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  if (!apiKey) return json(503, { error: "mail_transport_unavailable" });

  const sender = senderForMailbox(mailbox);
  const references = uniqueReferences([parent.reference_message_ids], parent.message_id);
  const headers: Record<string, string> = {};
  if (parent.message_id) headers["In-Reply-To"] = parent.message_id;
  if (references.length) headers["References"] = references.join(" ");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      from: sender.from,
      to: [recipient],
      subject: replySubject(parent.subject),
      text,
      reply_to: [sender.replyTo],
      headers,
      tags: [
        { name: "category", value: "operator_reply" },
        { name: "mailbox", value: mailbox },
      ],
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error("operator_mail_send_failed", response.status, (await response.text()).slice(0, 500));
    return json(502, { error: "send_failed" });
  }

  const sent = (await response.json()) as { id?: unknown };
  const resendId = typeof sent.id === "string" ? sent.id : null;
  if (!resendId) return json(502, { error: "send_id_missing" });

  const now = new Date().toISOString();
  const { error: persistError } = await supabase.from("resend_email_messages").insert({
    resend_email_id: resendId,
    direction: "outbound",
    from_address: sender.from,
    to_addresses: [recipient],
    cc_addresses: [],
    bcc_addresses: [],
    subject: replySubject(parent.subject),
    mailbox,
    category: "operator_reply",
    attachment_metadata: [],
    text_body: text,
    latest_event_type: "operator.reply_queued",
    event_created_at: now,
    updated_at: now,
    thread_id: parent.thread_id,
    in_reply_to: parent.message_id,
    reference_message_ids: references,
    reply_to_address: sender.replyTo,
  });
  if (persistError) {
    console.error("operator_mail_persist_failed", persistError.code);
  }

  return json(200, { ok: true, id: resendId, threadId: parent.thread_id });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabase = adminClient();
  const user = await authorize(request, supabase);
  if (!user) return json(403, { error: "forbidden" });

  const body = await readRequestBody(request);
  if (!body) return json(400, { error: "invalid_json" });

  const action = stringValue(body.action, 40);
  if (action === "list") {
    const mailbox = mailboxValue(body.mailbox);
    const query = supabase
      .from("resend_email_messages")
      .select("resend_email_id,direction,message_id,from_address,to_addresses,subject,mailbox,attachment_metadata,text_body,latest_event_type,event_created_at,updated_at,thread_id,in_reply_to,reply_to_address")
      .in("mailbox", mailbox ? [mailbox] : ["support", "security", "hello", "general", "test"])
      .order("updated_at", { ascending: false })
      .limit(100);
    const { data, error } = await query;
    if (error) return json(500, { error: "list_failed" });
    return json(200, { messages: data ?? [] });
  }

  if (action === "thread") {
    const threadId = stringValue(body.threadId, 64);
    if (!threadId) return json(400, { error: "invalid_thread" });
    const { data, error } = await supabase
      .from("resend_email_messages")
      .select("resend_email_id,direction,message_id,from_address,to_addresses,subject,mailbox,attachment_metadata,text_body,latest_event_type,event_created_at,updated_at,thread_id,in_reply_to,reply_to_address")
      .eq("thread_id", threadId)
      .order("updated_at", { ascending: true });
    if (error) return json(500, { error: "thread_failed" });
    return json(200, { messages: data ?? [] });
  }

  if (action === "reply") {
    const messageId = stringValue(body.messageId, 255);
    const text = stringValue(body.text, 100_000);
    if (!messageId || !text) return json(400, { error: "invalid_reply" });
    return await sendReply(supabase, messageId, text);
  }

  return json(400, { error: "unsupported_action" });
});

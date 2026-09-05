import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const ALLOWED_ORIGIN = "https://gapwise.ca";
const MAX_REQUEST_BYTES = 120_000;

type Mailbox = "support" | "security" | "hello" | "general" | "dmarc" | "test";
type Folder = "inbox" | "archive" | "trash";
type Body = {
  action?: unknown;
  threadId?: unknown;
  folder?: unknown;
  isRead?: unknown;
  starred?: unknown;
  labels?: unknown;
  draftId?: unknown;
  mailbox?: unknown;
  recipient?: unknown;
  subject?: unknown;
  text?: unknown;
};

function cors(origin: string | null) {
  return {
    ...(origin === ALLOWED_ORIGIN ? { "access-control-allow-origin": ALLOWED_ORIGIN } : {}),
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    vary: "Origin",
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "content-type": "application/json; charset=utf-8" },
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
      // Fall through to the legacy service-role secret.
    }
  }
  if (!key) key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!url || !key) throw new Error("Supabase admin credentials unavailable");
  return createClient(url, key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
}

function jwtHasDelegatedClient(token: string) {
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
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const token = auth.replace(/^Bearer\s+/iu, "").trim();
  if (!token || jwtHasDelegatedClient(token)) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: operator, error: operatorError } = await supabase
    .from("email_operators")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return operatorError || !operator ? null : data.user;
}

function stringValue(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function mailboxValue(value: unknown): Mailbox | null {
  return value === "support" || value === "security" || value === "hello" || value === "general" || value === "dmarc" || value === "test" ? value : null;
}

function folderValue(value: unknown): Folder | null {
  return value === "inbox" || value === "archive" || value === "trash" ? value : null;
}

function labelsValue(value: unknown) {
  if (!Array.isArray(value)) return null;
  const labels = [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  return labels.length <= 20 && labels.every((item) => item.length <= 40) ? labels : null;
}

async function readBody(request: Request): Promise<Body | null> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) return null;
  const raw = await request.text();
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Body : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403, headers: cors(origin) });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  if (origin !== ALLOWED_ORIGIN) return json(403, { error: "forbidden" }, origin);

  const supabase = adminClient();
  const user = await authorize(request, supabase);
  if (!user) return json(403, { error: "forbidden" }, origin);
  const body = await readBody(request);
  if (!body) return json(400, { error: "invalid_json" }, origin);
  const action = stringValue(body.action, 40);

  if (action === "authorize") return json(200, { ok: true }, origin);

  if (action === "states") {
    const { data, error } = await supabase
      .from("mail_thread_state")
      .select("thread_id,folder,is_read,starred,labels,snoozed_until,trashed_at,updated_at")
      .order("updated_at", { ascending: false });
    return error ? json(500, { error: "states_failed" }, origin) : json(200, { states: data ?? [] }, origin);
  }

  if (action === "update_state") {
    const threadId = stringValue(body.threadId, 64);
    if (!threadId) return json(400, { error: "invalid_thread" }, origin);
    const patch: Record<string, unknown> = { thread_id: threadId, updated_at: new Date().toISOString() };
    const folder = folderValue(body.folder);
    if (body.folder !== undefined) {
      if (!folder) return json(400, { error: "invalid_folder" }, origin);
      patch.folder = folder;
      patch.trashed_at = folder === "trash" ? new Date().toISOString() : null;
    }
    if (typeof body.isRead === "boolean") patch.is_read = body.isRead;
    if (typeof body.starred === "boolean") patch.starred = body.starred;
    if (body.labels !== undefined) {
      const labels = labelsValue(body.labels);
      if (!labels) return json(400, { error: "invalid_labels" }, origin);
      patch.labels = labels;
    }
    const { data, error } = await supabase
      .from("mail_thread_state")
      .upsert(patch, { onConflict: "thread_id" })
      .select("thread_id,folder,is_read,starred,labels,snoozed_until,trashed_at,updated_at")
      .single();
    return error ? json(500, { error: "state_update_failed" }, origin) : json(200, { ok: true, state: data }, origin);
  }

  if (action === "drafts") {
    const mailbox = mailboxValue(body.mailbox);
    let query = supabase.from("mail_drafts").select("id,mailbox,thread_id,recipient,subject,body,created_at,updated_at").order("updated_at", { ascending: false });
    if (mailbox) query = query.eq("mailbox", mailbox);
    const { data, error } = await query.limit(100);
    return error ? json(500, { error: "drafts_failed" }, origin) : json(200, { drafts: data ?? [] }, origin);
  }

  if (action === "save_draft") {
    const mailbox = mailboxValue(body.mailbox);
    if (!mailbox) return json(400, { error: "invalid_mailbox" }, origin);
    const draftId = stringValue(body.draftId, 64);
    const threadId = stringValue(body.threadId, 64);
    const recipient = typeof body.recipient === "string" ? body.recipient.trim().slice(0, 320) : null;
    const subject = typeof body.subject === "string" ? body.subject.slice(0, 300) : "";
    const text = typeof body.text === "string" ? body.text.slice(0, 100_000) : "";
    const now = new Date().toISOString();
    const values = { mailbox, thread_id: threadId, recipient, subject, body: text, updated_at: now };
    let result;
    if (draftId) {
      result = await supabase.from("mail_drafts").update(values).eq("id", draftId).select("id,mailbox,thread_id,recipient,subject,body,created_at,updated_at").maybeSingle();
    } else if (threadId) {
      result = await supabase.from("mail_drafts").upsert(values, { onConflict: "thread_id" }).select("id,mailbox,thread_id,recipient,subject,body,created_at,updated_at").single();
    } else {
      result = await supabase.from("mail_drafts").insert({ ...values, created_at: now }).select("id,mailbox,thread_id,recipient,subject,body,created_at,updated_at").single();
    }
    return result.error ? json(500, { error: "draft_save_failed" }, origin) : json(200, { ok: true, draft: result.data }, origin);
  }

  if (action === "delete_draft") {
    const draftId = stringValue(body.draftId, 64);
    if (!draftId) return json(400, { error: "invalid_draft" }, origin);
    const { error } = await supabase.from("mail_drafts").delete().eq("id", draftId);
    return error ? json(500, { error: "draft_delete_failed" }, origin) : json(200, { ok: true }, origin);
  }

  if (action === "delete_forever") {
    const threadId = stringValue(body.threadId, 64);
    if (!threadId) return json(400, { error: "invalid_thread" }, origin);
    const { data: state } = await supabase.from("mail_thread_state").select("folder").eq("thread_id", threadId).maybeSingle();
    if (!state || state.folder !== "trash") return json(409, { error: "thread_not_in_trash" }, origin);
    const { error: messageError } = await supabase.from("resend_email_messages").delete().eq("thread_id", threadId);
    if (messageError) return json(500, { error: "delete_failed" }, origin);
    await supabase.from("mail_drafts").delete().eq("thread_id", threadId);
    await supabase.from("mail_thread_state").delete().eq("thread_id", threadId);
    return json(200, { ok: true }, origin);
  }

  if (action === "empty_trash") {
    const { data: states, error: stateError } = await supabase.from("mail_thread_state").select("thread_id").eq("folder", "trash");
    if (stateError) return json(500, { error: "trash_list_failed" }, origin);
    const ids = (states ?? []).map((item) => item.thread_id).filter((item): item is string => typeof item === "string");
    if (!ids.length) return json(200, { ok: true, deleted: 0 }, origin);
    const { error: messageError } = await supabase.from("resend_email_messages").delete().in("thread_id", ids);
    if (messageError) return json(500, { error: "trash_delete_failed" }, origin);
    await supabase.from("mail_drafts").delete().in("thread_id", ids);
    await supabase.from("mail_thread_state").delete().in("thread_id", ids);
    return json(200, { ok: true, deleted: ids.length }, origin);
  }

  return json(400, { error: "unsupported_action" }, origin);
});

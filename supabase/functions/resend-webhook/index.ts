import { createClient } from "npm:@supabase/supabase-js@2.112.3";

type ResendWebhookEvent = {
  type?: unknown;
  created_at?: unknown;
  data?: {
    email_id?: unknown;
    template_id?: unknown;
    tags?: unknown;
    message_id?: unknown;
    from?: unknown;
    to?: unknown;
    cc?: unknown;
    bcc?: unknown;
    subject?: unknown;
    attachments?: unknown;
  };
};

const encoder = new TextEncoder();
const SIGNATURE_TOLERANCE_SECONDS = 300;

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  let key = "";

  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      if (typeof parsed["default"] === "string") key = parsed["default"].trim();
    } catch {
      // Fall back to the legacy service-role key below.
    }
  }

  if (!key) key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!url || !key)
    throw new Error("Supabase admin credentials are unavailable.");

  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function signingKeyBytes(secret: string) {
  if (!secret.startsWith("whsec_"))
    throw new Error("Webhook signing secret is malformed.");
  return decodeBase64(secret.slice("whsec_".length));
}

async function verifySignature(
  payload: string,
  secret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
) {
  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    signingKeyBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signedPayload = encoder.encode(`${svixId}.${svixTimestamp}.${payload}`);

  for (const candidate of svixSignature.trim().split(/\s+/u)) {
    const comma = candidate.indexOf(",");
    if (comma === -1 || candidate.slice(0, comma) !== "v1") continue;
    try {
      const signature = decodeBase64(candidate.slice(comma + 1));
      if (await crypto.subtle.verify("HMAC", key, signature, signedPayload))
        return true;
    } catch {
      // Ignore malformed signature candidates and continue checking rotations.
    }
  }

  return false;
}

function stringOrNull(value: unknown, maxLength = 255) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function stringArray(value: unknown, maxLength = 998) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((entry) => stringOrNull(entry, maxLength))
    .filter((entry): entry is string => Boolean(entry));
}

function eventCategory(tags: unknown) {
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (!tag || typeof tag !== "object") continue;
      const value = tag as Record<string, unknown>;
      if (value["name"] === "category")
        return stringOrNull(value["value"], 120);
    }
    return null;
  }

  if (tags && typeof tags === "object") {
    return stringOrNull((tags as Record<string, unknown>)["category"], 120);
  }

  return null;
}

function attachmentMetadata(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = stringOrNull(item["id"]);
    const filename = stringOrNull(item["filename"], 512);
    const contentType = stringOrNull(item["content_type"], 255);
    const contentDisposition = stringOrNull(item["content_disposition"], 255);
    const contentId = stringOrNull(item["content_id"], 512);
    if (!id && !filename) return [];
    return [
      {
        id,
        filename,
        content_type: contentType,
        content_disposition: contentDisposition,
        content_id: contentId,
      },
    ];
  });
}

function mailboxForRecipients(recipients: string[]) {
  for (const recipient of recipients) {
    const address = recipient.toLowerCase();
    const local = address.includes("<")
      ? address.slice(address.lastIndexOf("<") + 1, address.lastIndexOf("@"))
      : address.slice(0, address.indexOf("@"));
    if (local === "support") return "support";
    if (local === "security") return "security";
    if (local === "hello") return "hello";
    if (local === "general") return "general";
    if (local === "test") return "test";
  }
  return recipients.length ? "other" : null;
}

function directionForEvent(eventType: string) {
  return eventType === "email.received" ? "inbound" : "outbound";
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "POST", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const svixId = request.headers.get("svix-id")?.trim() ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp")?.trim() ?? "";
  const svixSignature = request.headers.get("svix-signature")?.trim() ?? "";
  if (!svixId || !svixTimestamp || !svixSignature) {
    return json(400, { error: "missing_signature" });
  }

  const payload = await request.text();
  const supabase = adminClient();
  const { data: signingSecret, error: secretError } = await supabase.rpc(
    "get_resend_webhook_signing_secret",
  );
  if (secretError || typeof signingSecret !== "string" || !signingSecret) {
    console.error(
      "resend_webhook_secret_unavailable",
      secretError?.message ?? "missing secret",
    );
    return json(503, { error: "webhook_unavailable" });
  }

  if (
    !(await verifySignature(
      payload,
      signingSecret,
      svixId,
      svixTimestamp,
      svixSignature,
    ))
  ) {
    return json(400, { error: "invalid_signature" });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(payload) as ResendWebhookEvent;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const eventType = stringOrNull(event.type, 120);
  if (!eventType) return json(400, { error: "invalid_event" });

  const createdAt = stringOrNull(event.created_at, 80);
  const eventCreatedAt =
    createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : null;
  const emailId = stringOrNull(event.data?.email_id);
  const templateId = stringOrNull(event.data?.template_id);
  const category = eventCategory(event.data?.tags);

  const { error: insertError } = await supabase
    .from("resend_webhook_events")
    .upsert(
      {
        svix_id: svixId,
        event_type: eventType,
        resend_email_id: emailId,
        template_id: templateId,
        category,
        event_created_at: eventCreatedAt,
      },
      { onConflict: "svix_id", ignoreDuplicates: true },
    );

  if (insertError) {
    console.error("resend_webhook_persist_failed", {
      svixId,
      eventType,
      code: insertError.code,
    });
    return json(500, { error: "persist_failed" });
  }

  if (emailId && eventType.startsWith("email.")) {
    const to = stringArray(event.data?.to);
    const cc = stringArray(event.data?.cc);
    const bcc = stringArray(event.data?.bcc);
    const incoming = {
      resend_email_id: emailId,
      direction: directionForEvent(eventType),
      message_id: stringOrNull(event.data?.message_id, 998),
      from_address: stringOrNull(event.data?.from, 998),
      to_addresses: to,
      cc_addresses: cc,
      bcc_addresses: bcc,
      subject: stringOrNull(event.data?.subject, 998),
      mailbox: eventType === "email.received" ? mailboxForRecipients(to) : null,
      template_id: templateId,
      category,
      attachment_metadata: attachmentMetadata(event.data?.attachments),
      latest_event_type: eventType,
      event_created_at: eventCreatedAt,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: selectError } = await supabase
      .from("resend_email_messages")
      .select("*")
      .eq("resend_email_id", emailId)
      .maybeSingle();

    if (selectError) {
      console.error("resend_email_message_lookup_failed", {
        emailId,
        code: selectError.code,
      });
      return json(500, { error: "message_lookup_failed" });
    }

    const merged = existing
      ? {
          ...existing,
          ...incoming,
          direction: existing.direction ?? incoming.direction,
          message_id: incoming.message_id ?? existing.message_id,
          from_address: incoming.from_address ?? existing.from_address,
          to_addresses: to.length ? to : existing.to_addresses,
          cc_addresses: cc.length ? cc : existing.cc_addresses,
          bcc_addresses: bcc.length ? bcc : existing.bcc_addresses,
          subject: incoming.subject ?? existing.subject,
          mailbox: incoming.mailbox ?? existing.mailbox,
          template_id: incoming.template_id ?? existing.template_id,
          category: incoming.category ?? existing.category,
          attachment_metadata: incoming.attachment_metadata.length
            ? incoming.attachment_metadata
            : existing.attachment_metadata,
        }
      : incoming;

    const { error: messageError } = await supabase
      .from("resend_email_messages")
      .upsert(merged, { onConflict: "resend_email_id" });

    if (messageError) {
      console.error("resend_email_message_persist_failed", {
        emailId,
        eventType,
        code: messageError.code,
      });
      return json(500, { error: "message_persist_failed" });
    }
  }

  console.info("resend_webhook_event", {
    svixId,
    eventType,
    emailId,
    templateId,
    category,
  });
  return json(200, { ok: true });
});

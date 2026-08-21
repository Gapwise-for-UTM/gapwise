import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../private-cloud/http.js";

export const PRO_TERM = "fall_2026";
export const PRO_AMOUNT_CAD_CENTS = 999;
export const PRO_ENTITLEMENT_EXPIRES_AT = "2027-01-01T04:59:59.000Z";
const STRIPE_API = "https://api.stripe.com/v1";
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
let adminClient: SupabaseClient | null = null;

type JsonRecord = Record<string, unknown>;
type PurchaseStatus = "pending" | "paid" | "expired" | "failed" | "refunded" | "disputed";
export type PurchaseTransition =
  | "payment_succeeded"
  | "full_refund"
  | "dispute_opened"
  | "dispute_won"
  | "dispute_lost";

type CheckoutSession = {
  id: string;
  url: string;
  expiresAt: string;
};

type PaymentIntentBinding = {
  userId: string;
  term: string;
};

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function idValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  return stringValue(asRecord(value)?.["id"]);
}

function purchaseStatus(value: unknown): PurchaseStatus {
  switch (value) {
    case "pending":
    case "paid":
    case "expired":
    case "failed":
    case "refunded":
    case "disputed":
      return value;
    default:
      throw new Error("billing ledger status is invalid");
  }
}

export function reconcilePurchaseStatus(
  current: PurchaseStatus,
  transition: PurchaseTransition,
): PurchaseStatus {
  switch (transition) {
    case "full_refund":
      return "refunded";
    case "payment_succeeded":
      if (current === "refunded" || current === "disputed") return current;
      return "paid";
    case "dispute_opened":
    case "dispute_lost":
      return current === "refunded" ? "refunded" : "disputed";
    case "dispute_won":
      return current === "refunded" ? "refunded" : "paid";
  }
}

function readServiceRoleKey(): string {
  const direct = (process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "").trim();
  if (direct) return direct;
  const secretKeys = process.env["SUPABASE_SECRET_KEYS"];
  if (!secretKeys) return "";
  try {
    const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
    return typeof parsed["default"] === "string" ? parsed["default"].trim() : "";
  } catch {
    return "";
  }
}

export function billingAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = (process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "").trim();
  const serviceRoleKey = readServiceRoleKey();
  if (!url || !serviceRoleKey) throw new ApiError(503, "Billing is not configured yet.");
  adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return adminClient;
}

function stripeSecretKey(): string {
  const secret = (process.env["STRIPE_SECRET_KEY"] ?? "").trim();
  if (!secret) throw new ApiError(503, "Checkout is not available yet.");
  return secret;
}

export function stripeWebhookSecret(): string {
  const secret = (process.env["STRIPE_WEBHOOK_SECRET"] ?? "").trim();
  if (!secret) throw new ApiError(503, "Billing webhook is not configured.");
  return secret;
}

function configuredPriceId(): string {
  return (process.env["STRIPE_PRO_FALL_2026_PRICE_ID"] ?? "").trim();
}

export function assertCheckoutEnabled(): void {
  if ((process.env["STRIPE_CHECKOUT_ENABLED"] ?? "").trim().toLowerCase() !== "true") {
    throw new ApiError(503, "Checkout is temporarily unavailable.");
  }
}

async function stripeGet(path: string): Promise<JsonRecord> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey()}` },
  });
  if (!response.ok) throw new Error("stripe verification unavailable");
  const payload = await response.json();
  const record = asRecord(payload);
  if (!record) throw new Error("stripe verification response is malformed");
  return record;
}

async function paymentIntentBinding(paymentIntent: string): Promise<PaymentIntentBinding | null> {
  const payload = await stripeGet(`/payment_intents/${encodeURIComponent(paymentIntent)}`);
  const metadata = asRecord(payload["metadata"]);
  if (metadata?.["app"] !== "gapwise") return null;
  const userId = stringValue(metadata["gapwise_user_id"]);
  const term = stringValue(metadata["term"]);
  if (!userId || !term) throw new Error("payment intent binding is invalid");
  return { userId, term };
}

async function verifyCheckoutPrice(sessionId: string): Promise<void> {
  const expectedPriceId = configuredPriceId();
  const secret = stripeSecretKey();
  if (!expectedPriceId) {
    if (!secret.startsWith("sk_test_")) throw new Error("production Stripe Price is not configured");
    return;
  }

  const payload = await stripeGet(
    `/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=2`,
  );
  const data = payload["data"];
  if (!Array.isArray(data) || data.length !== 1) throw new Error("checkout line items are invalid");
  const line = asRecord(data[0]);
  const price = asRecord(line?.["price"]);
  if (
    Number(line?.["quantity"]) !== 1 ||
    stringValue(price?.["id"]) !== expectedPriceId ||
    Number(price?.["unit_amount"]) !== PRO_AMOUNT_CAD_CENTS ||
    price?.["currency"] !== "cad"
  ) {
    throw new Error("checkout Price does not match the Gapwise Pro contract");
  }
}

export async function findReusableCheckout(userId: string) {
  const admin = billingAdminClient();
  const cutoff = new Date(Date.now() + 60_000).toISOString();
  const { data, error } = await admin
    .from("stripe_checkout_sessions")
    .select("checkout_url,expires_at")
    .eq("user_id", userId)
    .eq("term", PRO_TERM)
    .eq("status", "pending")
    .gt("expires_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new ApiError(503, "Checkout is temporarily unavailable.");
  const row = data?.[0] as { checkout_url?: unknown; expires_at?: unknown } | undefined;
  return typeof row?.checkout_url === "string" ? row.checkout_url : null;
}

export async function createFall2026CheckoutSession(
  userId: string,
  origin: string,
): Promise<CheckoutSession> {
  assertCheckoutEnabled();
  const secret = stripeSecretKey();
  const priceId = configuredPriceId();
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${origin}/?billing=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/?billing=cancelled`);
  params.set("client_reference_id", userId);
  params.set("customer_creation", "always");
  params.set("billing_address_collection", "auto");
  params.set("line_items[0][quantity]", "1");
  params.set("metadata[app]", "gapwise");
  params.set("metadata[gapwise_user_id]", userId);
  params.set("metadata[term]", PRO_TERM);
  params.set("payment_intent_data[metadata][app]", "gapwise");
  params.set("payment_intent_data[metadata][gapwise_user_id]", userId);
  params.set("payment_intent_data[metadata][term]", PRO_TERM);

  if (priceId) {
    params.set("line_items[0][price]", priceId);
  } else if (secret.startsWith("sk_test_")) {
    params.set("line_items[0][price_data][currency]", "cad");
    params.set("line_items[0][price_data][unit_amount]", String(PRO_AMOUNT_CAD_CENTS));
    params.set("line_items[0][price_data][product_data][name]", "Gapwise Pro · Fall 2026");
    params.set(
      "line_items[0][price_data][product_data][description]",
      "One-time Fall 2026 Gapwise Pro semester pass",
    );
  } else {
    throw new ApiError(503, "Checkout is not available yet.");
  }

  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!response.ok) throw new ApiError(503, "Checkout is not available yet.");
  const payload = (await response.json()) as JsonRecord;
  const id = stringValue(payload["id"]);
  const url = stringValue(payload["url"]);
  const expires = payload["expires_at"];
  if (!id || !url || typeof expires !== "number" || !Number.isFinite(expires)) {
    throw new ApiError(503, "Checkout is not available yet.");
  }
  return { id, url, expiresAt: new Date(expires * 1000).toISOString() };
}

export async function recordCheckoutSession(userId: string, session: CheckoutSession) {
  const admin = billingAdminClient();
  const { error } = await admin.from("stripe_checkout_sessions").insert({
    session_id: session.id,
    user_id: userId,
    term: PRO_TERM,
    amount_total: PRO_AMOUNT_CAD_CENTS,
    currency: "cad",
    status: "pending",
    checkout_url: session.url,
    expires_at: session.expiresAt,
    entitlement_expires_at: PRO_ENTITLEMENT_EXPIRES_AT,
  });
  if (error) throw new ApiError(503, "Checkout is temporarily unavailable.");
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!signatureHeader || !secret) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && /^[0-9a-f]{64}$/iu.test(value)) signatures.push(value.toLowerCase());
  }
  if (!timestamp || !Number.isSafeInteger(timestamp)) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

async function claimWebhookEvent(admin: SupabaseClient, eventId: string, eventType: string) {
  const { data: existing, error: readError } = await admin
    .from("stripe_webhook_events")
    .select("status,attempts,updated_at")
    .eq("event_id", eventId)
    .maybeSingle();
  if (readError) throw new Error("webhook ledger unavailable");
  if (existing?.status === "processed") return false;
  if (existing?.status === "processing") {
    const updated = Date.parse(String(existing.updated_at));
    if (Number.isFinite(updated) && Date.now() - updated < 5 * 60_000) return false;
  }
  if (existing) {
    const { error } = await admin
      .from("stripe_webhook_events")
      .update({
        status: "processing",
        attempts: Number(existing.attempts ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);
    if (error) throw new Error("webhook ledger unavailable");
  } else {
    const { error } = await admin.from("stripe_webhook_events").insert({
      event_id: eventId,
      event_type: eventType,
      status: "processing",
    });
    if (error) throw new Error("webhook ledger unavailable");
  }
  return true;
}

async function finishWebhookEvent(
  admin: SupabaseClient,
  eventId: string,
  status: "processed" | "failed",
) {
  const now = new Date().toISOString();
  await admin
    .from("stripe_webhook_events")
    .update({ status, updated_at: now, processed_at: status === "processed" ? now : null })
    .eq("event_id", eventId);
}

async function recomputeStripeEntitlement(admin: SupabaseClient, userId: string) {
  const { data: current, error: entitlementError } = await admin
    .from("user_entitlements")
    .select("tier,source,expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (entitlementError) throw new Error("entitlement unavailable");
  if (current?.tier === "founder") return;
  const currentExpiry = current?.expires_at
    ? Date.parse(String(current.expires_at))
    : Number.POSITIVE_INFINITY;
  const currentIsActive = current?.tier === "pro" && currentExpiry > Date.now();
  if (
    currentIsActive &&
    typeof current?.source === "string" &&
    !current.source.startsWith("stripe:")
  ) {
    return;
  }

  const { data: paid, error: paidError } = await admin
    .from("stripe_checkout_sessions")
    .select("term,entitlement_expires_at")
    .eq("user_id", userId)
    .eq("status", "paid")
    .gt("entitlement_expires_at", new Date().toISOString())
    .order("entitlement_expires_at", { ascending: false })
    .limit(1);
  if (paidError) throw new Error("billing ledger unavailable");
  const candidate = paid?.[0] as { term?: unknown; entitlement_expires_at?: unknown } | undefined;
  if (candidate && typeof candidate.entitlement_expires_at === "string") {
    const source = `stripe:${String(candidate.term ?? PRO_TERM)}`.slice(0, 64);
    const { error } = await admin.from("user_entitlements").upsert({
      user_id: userId,
      tier: "pro",
      source,
      expires_at: candidate.entitlement_expires_at,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("entitlement unavailable");
    return;
  }

  if (typeof current?.source === "string" && current.source.startsWith("stripe:")) {
    const { error } = await admin.from("user_entitlements").delete().eq("user_id", userId);
    if (error) throw new Error("entitlement unavailable");
  }
}

async function handlePaidCheckout(admin: SupabaseClient, object: JsonRecord) {
  const metadata = asRecord(object["metadata"]);
  if (metadata?.["app"] !== "gapwise") return;
  if (metadata["term"] !== PRO_TERM) throw new Error("unexpected gapwise term");
  const sessionId = stringValue(object["id"]);
  const userId = stringValue(object["client_reference_id"]);
  const metadataUserId = stringValue(metadata["gapwise_user_id"]);
  if (!sessionId || !userId || metadataUserId !== userId)
    throw new Error("invalid checkout binding");

  const { data: ledger, error: ledgerError } = await admin
    .from("stripe_checkout_sessions")
    .select("user_id,term,amount_total,currency,status")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (ledgerError || !ledger) throw new Error("checkout ledger missing");
  if (
    ledger.user_id !== userId ||
    ledger.term !== PRO_TERM ||
    Number(ledger.amount_total) !== PRO_AMOUNT_CAD_CENTS ||
    ledger.currency !== "cad" ||
    object["mode"] !== "payment" ||
    Number(object["amount_total"]) !== PRO_AMOUNT_CAD_CENTS ||
    object["currency"] !== "cad"
  ) {
    throw new Error("checkout mismatch");
  }
  if (object["payment_status"] !== "paid") return;

  const paymentIntent = idValue(object["payment_intent"]);
  if (!paymentIntent) throw new Error("payment intent missing");
  const binding = await paymentIntentBinding(paymentIntent);
  if (!binding || binding.userId !== userId || binding.term !== PRO_TERM) {
    throw new Error("payment intent binding does not match checkout");
  }
  await verifyCheckoutPrice(sessionId);

  const customer = idValue(object["customer"]);
  const now = new Date().toISOString();
  const nextStatus = reconcilePurchaseStatus(purchaseStatus(ledger.status), "payment_succeeded");
  const { error } = await admin
    .from("stripe_checkout_sessions")
    .update({
      status: nextStatus,
      payment_intent_id: paymentIntent,
      customer_id: customer,
      paid_at: now,
      updated_at: now,
    })
    .eq("session_id", sessionId);
  if (error) throw new Error("checkout ledger unavailable");
  await recomputeStripeEntitlement(admin, userId);
}

async function markPaymentIntentTransition(
  admin: SupabaseClient,
  paymentIntent: string | null,
  transition: PurchaseTransition,
) {
  if (!paymentIntent) throw new Error("payment intent missing");
  const binding = await paymentIntentBinding(paymentIntent);
  if (!binding) return;
  if (binding.term !== PRO_TERM) throw new Error("unexpected gapwise term");

  const { data: ledger, error } = await admin
    .from("stripe_checkout_sessions")
    .select("session_id,user_id,status")
    .eq("payment_intent_id", paymentIntent)
    .maybeSingle();
  if (error) throw new Error("checkout ledger unavailable");
  if (!ledger) {
    // Stripe does not guarantee webhook ordering. A refund or dispute can arrive
    // before Checkout completion has linked the PaymentIntent to our ledger.
    // Failing makes Stripe retry rather than incorrectly treating the event as handled.
    throw new Error("checkout ledger not linked yet");
  }
  if (String(ledger.user_id) !== binding.userId) throw new Error("payment intent user mismatch");

  const nextStatus = reconcilePurchaseStatus(purchaseStatus(ledger.status), transition);
  const { error: updateError } = await admin
    .from("stripe_checkout_sessions")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("session_id", ledger.session_id);
  if (updateError) throw new Error("checkout ledger unavailable");
  await recomputeStripeEntitlement(admin, String(ledger.user_id));
}

async function handleStripeEvent(admin: SupabaseClient, eventType: string, object: JsonRecord) {
  switch (eventType) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handlePaidCheckout(admin, object);
      return;
    case "checkout.session.expired": {
      const metadata = asRecord(object["metadata"]);
      if (metadata?.["app"] !== "gapwise") return;
      const sessionId = stringValue(object["id"]);
      if (!sessionId) return;
      const { error } = await admin
        .from("stripe_checkout_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("status", "pending");
      if (error) throw new Error("checkout ledger unavailable");
      return;
    }
    case "charge.refunded":
      if (object["refunded"] === true) {
        await markPaymentIntentTransition(
          admin,
          idValue(object["payment_intent"]),
          "full_refund",
        );
      }
      return;
    case "charge.dispute.created":
      await markPaymentIntentTransition(
        admin,
        idValue(object["payment_intent"]),
        "dispute_opened",
      );
      return;
    case "charge.dispute.closed":
      await markPaymentIntentTransition(
        admin,
        idValue(object["payment_intent"]),
        object["status"] === "won" ? "dispute_won" : "dispute_lost",
      );
      return;
    default:
      return;
  }
}

export async function processStripeWebhookEvent(event: unknown): Promise<void> {
  const record = asRecord(event);
  const eventId = stringValue(record?.["id"]);
  const eventType = stringValue(record?.["type"]);
  const object = asRecord(asRecord(record?.["data"])?.["object"]);
  if (!eventId || !eventType || !object) throw new Error("malformed stripe event");

  const admin = billingAdminClient();
  const claimed = await claimWebhookEvent(admin, eventId, eventType);
  if (!claimed) return;
  try {
    await handleStripeEvent(admin, eventType, object);
    await finishWebhookEvent(admin, eventId, "processed");
  } catch (error) {
    await finishWebhookEvent(admin, eventId, "failed");
    throw error;
  }
}

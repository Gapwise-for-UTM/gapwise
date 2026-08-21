import { jsonResponse } from "../src/server/private-cloud/http.js";
import {
  processStripeWebhookEvent,
  stripeWebhookSecret,
  verifyStripeSignature,
} from "../src/server/billing/stripe.js";

const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
    const declaredLength = request.headers.get("content-length");
    if (declaredLength !== null && Number(declaredLength) > MAX_WEBHOOK_BODY_BYTES) {
      return jsonResponse({ error: "Request is too large." }, 413);
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return jsonResponse({ error: "Request body is malformed." }, 400);
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
      return jsonResponse({ error: "Request is too large." }, 413);
    }

    let secret: string;
    try {
      secret = stripeWebhookSecret();
    } catch {
      return jsonResponse({ error: "Webhook is not configured." }, 503);
    }
    if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret)) {
      return jsonResponse({ error: "Invalid signature." }, 400);
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Request body is malformed." }, 400);
    }

    try {
      await processStripeWebhookEvent(event);
      return jsonResponse({ received: true });
    } catch {
      // Returning a server error makes Stripe retry transient database failures.
      return jsonResponse({ error: "Webhook processing failed." }, 500);
    }
  },
};

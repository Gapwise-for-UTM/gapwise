import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  reconcilePurchaseStatus,
  verifyStripeSignature,
  type PurchaseTransition,
} from "../src/server/billing/stripe";

describe("Stripe webhook signatures", () => {
  test("accepts a current matching v1 signature", () => {
    const body = '{"id":"evt_test","type":"checkout.session.completed"}';
    const secret = "whsec_test_secret";
    const timestamp = 1_800_000_000;
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    expect(
      verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, timestamp * 1000),
    ).toBe(true);
  });

  test("rejects altered and stale payloads", () => {
    const body = "{}";
    const secret = "whsec_test_secret";
    const timestamp = 1_800_000_000;
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    expect(
      verifyStripeSignature(
        '{"changed":true}',
        `t=${timestamp},v1=${signature}`,
        secret,
        timestamp * 1000,
      ),
    ).toBe(false);
    expect(
      verifyStripeSignature(
        body,
        `t=${timestamp},v1=${signature}`,
        secret,
        (timestamp + 301) * 1000,
      ),
    ).toBe(false);
  });
});

describe("Stripe-backed entitlement state", () => {
  test("a full refund remains terminal even after later success or a won dispute", () => {
    expect(reconcilePurchaseStatus("refunded", "payment_succeeded")).toBe("refunded");
    expect(reconcilePurchaseStatus("refunded", "dispute_won")).toBe("refunded");
  });

  test("an open dispute cannot be overwritten by a late payment success event", () => {
    expect(reconcilePurchaseStatus("disputed", "payment_succeeded")).toBe("disputed");
  });

  test("a won dispute restores only a non-refunded purchase", () => {
    expect(reconcilePurchaseStatus("disputed", "dispute_won")).toBe("paid");
    expect(reconcilePurchaseStatus("refunded", "dispute_won")).toBe("refunded");
  });

  test("refund and dispute event reordering converges without resurrecting a refund", () => {
    let status: Parameters<typeof reconcilePurchaseStatus>[0] = "pending";
    const events: PurchaseTransition[] = [
      "payment_succeeded",
      "dispute_opened",
      "full_refund",
      "dispute_won",
      "payment_succeeded",
    ];
    for (const event of events) status = reconcilePurchaseStatus(status, event);
    expect(status).toBe("refunded");
  });
});

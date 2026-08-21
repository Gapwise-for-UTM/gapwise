import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { verifyStripeSignature } from "../src/server/billing/stripe";

describe("Stripe webhook signatures", () => {
  test("accepts a current matching v1 signature", () => {
    const body = '{"id":"evt_test","type":"checkout.session.completed"}';
    const secret = "whsec_test_secret";
    const timestamp = 1_800_000_000;
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    expect(
      verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, timestamp * 1000),
    ).toBe(true);
  });

  test("rejects altered and stale payloads", () => {
    const body = "{}";
    const secret = "whsec_test_secret";
    const timestamp = 1_800_000_000;
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
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

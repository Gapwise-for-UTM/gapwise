import { authenticateSupabaseRequest } from "../src/server/private-cloud/auth.js";
import {
  ApiError,
  errorResponse,
  jsonResponse,
  readLimitedJson,
  requireExactObject,
  requirePostFromSameOrigin,
} from "../src/server/private-cloud/http.js";
import {
  createFall2026CheckoutSession,
  findReusableCheckout,
  recordCheckoutSession,
} from "../src/server/billing/stripe.js";

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      requirePostFromSameOrigin(request);
      requireExactObject(await readLimitedJson(request), []);
      const authenticated = await authenticateSupabaseRequest(request);
      const { data: entitlement, error } = await authenticated.client
        .from("user_entitlements")
        .select("tier,expires_at")
        .eq("user_id", authenticated.userId)
        .maybeSingle();
      if (error) throw new ApiError(503, "Checkout is temporarily unavailable.");
      const expiry = entitlement?.expires_at ? Date.parse(entitlement.expires_at) : null;
      if (
        entitlement?.tier === "founder" ||
        (entitlement?.tier === "pro" && (expiry === null || expiry > Date.now()))
      ) {
        throw new ApiError(409, "Gapwise Pro is already active on this account.");
      }

      const reusable = await findReusableCheckout(authenticated.userId);
      if (reusable) return jsonResponse({ url: reusable });

      const session = await createFall2026CheckoutSession(
        authenticated.userId,
        new URL(request.url).origin,
      );
      await recordCheckoutSession(authenticated.userId, session);
      return jsonResponse({ url: session.url });
    } catch (error) {
      return errorResponse(error);
    }
  },
};

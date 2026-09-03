import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { authenticateSupabaseRequest } from "../src/server/private-cloud/auth.js";
import { ApiError, handleJsonPost, requireExactObject } from "../src/server/private-cloud/http.js";

function createUserClient(accessToken: string) {
  const url = (process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "").trim();
  const publishableKey = (
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    ""
  ).trim();
  if (!url || !publishableKey) throw new ApiError(503, "Account setup is temporarily unavailable.");
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleJsonPost(request, async (body) => {
      const value = requireExactObject(body, ["action"]);
      const action = value["action"];
      if (action !== "read" && action !== "complete") {
        throw new ApiError(400, "Request body is malformed.");
      }

      const authenticated = await authenticateSupabaseRequest(request);
      const client = createUserClient(authenticated.accessToken);

      if (action === "read") {
        const { data, error } = await client
          .from("user_onboarding")
          .select("completed_at")
          .eq("user_id", authenticated.userId)
          .maybeSingle();
        if (error) throw new ApiError(503, "Account setup is temporarily unavailable.");
        return { pending: Boolean(data && !data.completed_at) };
      }

      const now = new Date().toISOString();
      const { data, error } = await client
        .from("user_onboarding")
        .update({ completed_at: now, updated_at: now })
        .eq("user_id", authenticated.userId)
        .is("completed_at", null)
        .select("user_id")
        .limit(1);
      if (error) throw new ApiError(503, "Account setup could not be saved.");

      // Only the null -> completed transition is eligible for the welcome. Delivery
      // is intentionally non-blocking for product state and the Edge Function uses
      // a stable Resend idempotency key as a second duplicate-send boundary.
      if ((data?.length ?? 0) > 0) {
        void client.functions
          .invoke("lifecycle-email", { body: { event: "onboarding_completed" } })
          .catch(() => undefined);
      }

      return { completed: true };
    });
  },
};

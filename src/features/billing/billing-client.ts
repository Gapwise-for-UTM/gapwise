import { getSupabaseClient } from "@/lib/supabase";

export async function startProCheckout(): Promise<string> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Billing is unavailable.");
  const { data } = await client.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sign in to upgrade to Gapwise Pro.");

  let response: Response;
  try {
    response = await fetch("/api/billing-checkout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Checkout took too long. Try again.");
  }
  const payload = (await response.json().catch(() => null)) as {
    url?: string;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Checkout is unavailable right now.");
  if (!payload?.url || !payload.url.startsWith("https://")) {
    throw new Error("Checkout is unavailable right now.");
  }
  return payload.url;
}

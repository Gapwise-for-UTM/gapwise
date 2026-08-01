import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, requireSupabaseClient } from "@/lib/supabase";

export async function signInWithGitHub(): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export function getAccountIdentity(user: User): string {
  const metadata = user.user_metadata ?? {};
  return (
    user.email ||
    (typeof metadata["user_name"] === "string" ? metadata["user_name"] : "") ||
    (typeof metadata["preferred_username"] === "string" ? metadata["preferred_username"] : "") ||
    (typeof metadata["full_name"] === "string" ? metadata["full_name"] : "") ||
    "Signed in"
  );
}

export function consumeOAuthError(
  location: Pick<Location, "href">,
  history: Pick<History, "replaceState" | "state">,
): string | null {
  const url = new URL(location.href);
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (!error) return null;
  for (const key of ["error", "error_code", "error_description"]) url.searchParams.delete(key);
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  return `GitHub sign-in failed: ${error.replace(/\+/g, " ")}`;
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

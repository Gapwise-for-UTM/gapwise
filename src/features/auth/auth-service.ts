import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, requireSupabaseClient } from "@/lib/supabase";
import { authStore } from "./auth-store";

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

export async function requestEmailOtp(email: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Enter an email address.");

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.replace(/\s+/g, "");

  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new Error("Enter the six-digit code from your email.");
  }

  const { error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: "email",
  });
  if (error) throw error;
}

export function getAccountIdentity(user: User): string {
  const metadata = user.user_metadata ?? {};
  return (
    (typeof metadata["name"] === "string" ? metadata["name"] : "") ||
    (typeof metadata["user_name"] === "string" ? metadata["user_name"] : "") ||
    (typeof metadata["preferred_username"] === "string" ? metadata["preferred_username"] : "") ||
    (typeof metadata["full_name"] === "string" ? metadata["full_name"] : "") ||
    user.email ||
    "Signed in"
  );
}

export async function deleteAccount(): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.functions.invoke("delete-account", { body: {} });
  if (error) throw new Error("We couldn't delete your account. Please try again.");
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
  return `Sign-in failed: ${error.replace(/\+/g, " ")}`;
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabaseClient();
  authStore.forceSignedOut();
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  } catch (error) {
    authStore.forceSignedOut();
    throw error;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return authStore.subscribe(() => callback(authStore.getSnapshot().user));
}

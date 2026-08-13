import type { User } from "@supabase/supabase-js";
import {
  assertCanPersistAuthRedirect,
  getSupabaseClient,
  requireSupabaseClient,
} from "@/lib/supabase";
import { authStore } from "./auth-store";
import { clearPrivateCloudLocalUser } from "@/features/sync/encrypted-sync-service";

export async function signInWithGitHub(): Promise<void> {
  const supabase = requireSupabaseClient();
  assertCanPersistAuthRedirect();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = requireSupabaseClient();
  assertCanPersistAuthRedirect();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signInWithMicrosoft(): Promise<void> {
  const supabase = requireSupabaseClient();
  assertCanPersistAuthRedirect();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      scopes: "email",
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function requestEmailSignInLink(email: string): Promise<void> {
  const supabase = requireSupabaseClient();
  assertCanPersistAuthRedirect();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Enter an email address.");

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: window.location.origin,
    },
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

export async function completeLocalSignOut(
  clearPrivateState: () => Promise<void>,
  removeLocalSession: () => Promise<void>,
): Promise<void> {
  const [cleanup, sessionRemoval] = await Promise.allSettled([
    Promise.resolve().then(clearPrivateState),
    Promise.resolve().then(removeLocalSession),
  ]);
  if (cleanup.status === "rejected") throw cleanup.reason;
  if (sessionRemoval.status === "rejected") throw sessionRemoval.reason;
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: null }));
  const userId = sessionData?.session?.user.id ?? authStore.getSnapshot().user?.id ?? null;
  authStore.forceSignedOut();
  try {
    await completeLocalSignOut(
      async () => {
        if (userId) await clearPrivateCloudLocalUser(userId);
      },
      async () => {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      },
    );
  } finally {
    authStore.forceSignedOut();
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

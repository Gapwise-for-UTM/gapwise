import type { User } from "@supabase/supabase-js";
import {
  assertCanPersistAuthRedirect,
  getSupabaseClient,
  requireSupabaseClient,
} from "@/lib/supabase";
import { authStore } from "./auth-store";
import { clearPrivateCloudLocalUser } from "@/features/sync/encrypted-sync-service";

function authRedirectTarget(redirectTo?: string): string {
  if (!redirectTo) return window.location.origin;
  const target = new URL(redirectTo, window.location.origin);
  if (target.origin !== window.location.origin) {
    throw new Error("Authentication can only return to Gapwise.");
  }
  return target.href;
}

export async function signInWithGitHub(redirectTo?: string): Promise<void> {
  const supabase = requireSupabaseClient();
  assertCanPersistAuthRedirect();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: authRedirectTarget(redirectTo),
    },
  });
  if (error) throw error;
}

export async function signInWithGoogleOAuthFallback(redirectTo?: string): Promise<void> {
  const supabase = requireSupabaseClient();
  assertCanPersistAuthRedirect();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectTarget(redirectTo),
    },
  });
  if (error) throw error;
}

type GoogleCredentialResponse = { credential?: string };
type GooglePromptMoment = {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
};
type GoogleAccounts = {
  id: {
    initialize(config: {
      client_id: string;
      nonce: string;
      callback(response: GoogleCredentialResponse): void;
      cancel_on_tap_outside: boolean;
    }): void;
    prompt(callback: (notification: GooglePromptMoment) => void): void;
    cancel(): void;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

const GOOGLE_SCRIPT_ID = "gapwise-google-identity";

async function googleAccounts(): Promise<GoogleAccounts> {
  if (window.google?.accounts) return window.google.accounts;
  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Google sign-in is unavailable.")), {
      once: true,
    });
    if (!existing) {
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  });
  if (!window.google?.accounts) throw new Error("Google sign-in is unavailable.");
  return window.google.accounts;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createGoogleNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = base64Url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return { raw, hashed: base64Url(new Uint8Array(digest)) };
}

export async function signInWithGoogle(redirectTo?: string): Promise<void> {
  const clientId = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;
  const useFallback = import.meta.env["VITE_GOOGLE_AUTH_MODE"] === "oauth";
  if (!clientId || useFallback) return signInWithGoogleOAuthFallback(redirectTo);
  if (!navigator.onLine) throw new Error("You're offline. Reconnect and try Google sign-in.");
  const supabase = requireSupabaseClient();
  const accounts = await googleAccounts();
  const nonce = await createGoogleNonce();
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      action();
    };
    accounts.id.initialize({
      client_id: clientId,
      nonce: nonce.hashed,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (!response.credential) {
          finish(() => reject(new Error("Google sign-in was cancelled.")));
          return;
        }
        void supabase.auth
          .signInWithIdToken({ provider: "google", token: response.credential, nonce: nonce.raw })
          .then(({ error }) => {
            if (error)
              finish(() => reject(new Error("We couldn't complete Google sign-in. Try again.")));
            else finish(resolve);
          })
          .catch(() =>
            finish(() => reject(new Error("We couldn't complete Google sign-in. Try again."))),
          );
      },
    });
    accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment())
        finish(() => reject(new Error("Google sign-in was cancelled or blocked.")));
    });
  });
}

export async function signInWithMicrosoft(redirectTo?: string): Promise<void> {
  const supabase = requireSupabaseClient();
  assertCanPersistAuthRedirect();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      scopes: "email",
      redirectTo: authRedirectTarget(redirectTo),
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

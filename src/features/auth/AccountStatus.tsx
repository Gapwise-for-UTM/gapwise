import type { User } from "@supabase/supabase-js";
import { CloudOff, Github, LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseConfigurationNotice } from "@/lib/supabase";
import { consumeOAuthError, getAccountIdentity, signInWithGitHub, signOut } from "./auth-service";

export function AccountStatus({ user, loading }: { user: User | null; loading: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const error = consumeOAuthError(window.location, window.history);
    if (error) setMessage(error);
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="surface p-4" aria-label="Account status">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-secondary p-2 text-accent">
            {isSupabaseConfigured ? (
              <UserRound className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CloudOff className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
          <div>
            <p className="text-sm font-semibold">
              {loading ? "Checking account…" : user ? getAccountIdentity(user) : "Guest mode"}
            </p>
            <p className="text-xs text-muted-foreground">
              {user
                ? "Cloud controls are available when you choose to use them."
                : "No account is required; your imported schedule can stay in this browser."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!user ? (
            <>
              <button
                type="button"
                onClick={() => setMessage("Guest mode active. Nothing has been sent to the cloud.")}
                className="rounded-lg border border-input bg-card px-3 py-2 text-xs font-semibold hover:bg-secondary"
              >
                Continue as guest
              </button>
              <button
                type="button"
                onClick={() => void run(signInWithGitHub)}
                disabled={!isSupabaseConfigured || busy || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Github className="h-3.5 w-3.5" aria-hidden="true" />
                Sign in with GitHub
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void run(signOut)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          )}
        </div>
      </div>
      {import.meta.env.DEV && !isSupabaseConfigured ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Developer setup: {supabaseConfigurationNotice}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </aside>
  );
}

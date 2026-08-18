import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, GitBranch, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/use-auth";
import {
  assertCanPersistAuthRedirect,
  isSupabaseConfigured,
  requireSupabaseClient,
} from "@/lib/supabase";

type Provider = "github" | "google" | "azure";

type ConsentDetails = {
  authorizationId: string;
  clientId: string;
  clientName: string;
  redirectUri: string | null;
  scopes: string[];
};

type OAuthRecord = Record<string, unknown> & {
  authorization_id?: unknown;
  client?: unknown;
  client_id?: unknown;
  client_name?: unknown;
  redirect_uri?: unknown;
  redirect_url?: unknown;
  scope?: unknown;
  id?: unknown;
  name?: unknown;
};

function isRecord(value: unknown): value is OAuthRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function consentDetails(value: unknown): ConsentDetails | null {
  if (!isRecord(value)) return null;
  const authorizationId = text(value.authorization_id);
  if (!authorizationId) return null;
  const client = isRecord(value.client) ? value.client : null;
  const clientId =
    text(value.client_id) ?? text(client?.id) ?? text(client?.client_id) ?? "Unknown client";
  const clientName =
    text(value.client_name) ?? text(client?.name) ?? text(client?.client_name) ?? "AI connector";
  const redirectUri = text(value.redirect_uri);
  const scope = text(value.scope) ?? "email";
  return {
    authorizationId,
    clientId,
    clientName,
    redirectUri,
    scopes: scope.split(/\s+/u).filter(Boolean).slice(0, 12),
  };
}

export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search["authorization_id"] === "string"
        ? search["authorization_id"].slice(0, 512)
        : "",
  }),
  head: () => ({
    meta: [
      { title: "Authorize AI connector — Gapwise" },
      {
        name: "description",
        content: "Review an OAuth request before connecting an AI or MCP client to Gapwise.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OAuthConsentPage,
});

function OAuthConsentPage() {
  const { authorization_id: authorizationId } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authorizationId || !user || !isSupabaseConfigured) return;
    let active = true;
    const supabase = requireSupabaseClient();
    void supabase.auth.oauth
      .getAuthorizationDetails(authorizationId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMessage("This authorization request is invalid or has expired. Start the connection again from your AI client.");
          return;
        }
        if (data && !("authorization_id" in data)) {
          window.location.assign(data.redirect_url);
          return;
        }
        const normalized = consentDetails(data);
        if (!normalized) {
          setMessage("Gapwise could not verify this authorization request.");
          return;
        }
        setDetails(normalized);
        setMessage(null);
      })
      .catch(() => {
        if (active) setMessage("Gapwise could not load this authorization request.");
      });
    return () => {
      active = false;
    };
  }, [authorizationId, user]);

  async function signIn(provider: Provider) {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = requireSupabaseClient();
      assertCanPersistAuthRedirect();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.href,
          ...(provider === "azure" ? { scopes: "email" } : {}),
        },
      });
      if (error) throw error;
    } catch {
      setMessage("Sign-in could not start. Your authorization request was not approved.");
      setLoading(false);
    }
  }

  async function decide(decision: "approve" | "deny") {
    if (!details) return;
    setLoading(true);
    setMessage(null);
    try {
      const supabase = requireSupabaseClient();
      const response =
        decision === "approve"
          ? await supabase.auth.oauth.approveAuthorization(details.authorizationId)
          : await supabase.auth.oauth.denyAuthorization(details.authorizationId);
      if (response.error || !response.data?.redirect_url) {
        throw response.error ?? new Error("OAuth redirect was missing.");
      }
      window.location.assign(response.data.redirect_url);
    } catch {
      setMessage(
        decision === "approve"
          ? "Gapwise could not approve this connector. No new access was granted."
          : "Gapwise could not finish denying this request. Close this tab and cancel from the AI client.",
      );
      setLoading(false);
    }
  }

  if (!authorizationId) {
    return (
      <ConsentShell>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Invalid authorization request</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This page must be opened by a valid OAuth client. Start the Gapwise connection again from ChatGPT,
          Claude, or another MCP client.
        </p>
        <Link to="/" className="button-secondary mt-6 inline-flex min-h-11 items-center px-4 text-sm font-semibold">
          Return to Gapwise
        </Link>
      </ConsentShell>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <ConsentShell>
        <h1 className="font-display text-2xl font-semibold tracking-tight">OAuth is unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This Gapwise deployment does not have account authentication configured.
        </p>
      </ConsentShell>
    );
  }

  if (authLoading) {
    return (
      <ConsentShell>
        <p className="text-sm text-muted-foreground">Checking your Gapwise session…</p>
      </ConsentShell>
    );
  }

  if (!user) {
    return (
      <ConsentShell>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent/8">
          <Bot className="h-5 w-5 text-accent" aria-hidden="true" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">Sign in before authorizing</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The AI connector will authenticate as your existing Gapwise account. Sign in here; Gapwise preserves this
          authorization request and returns you to it after the provider redirect.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void signIn("github")}
            className="button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold disabled:opacity-50"
          >
            <GitBranch className="h-4 w-4" aria-hidden="true" /> GitHub
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void signIn("google")}
            className="button-secondary min-h-11 px-3 text-sm font-semibold disabled:opacity-50"
          >
            Google
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void signIn("azure")}
            className="button-secondary min-h-11 px-3 text-sm font-semibold disabled:opacity-50"
          >
            Microsoft
          </button>
        </div>
        {message ? <p role="status" className="mt-4 text-xs leading-5 text-muted-foreground">{message}</p> : null}
      </ConsentShell>
    );
  }

  return (
    <ConsentShell>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/8">
          <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow text-accent">OAuth authorization</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            Allow {details?.clientName ?? "this AI connector"} to sign in to Gapwise?
          </h1>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border/70 p-4">
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</dt>
            <dd className="mt-1 break-all">{details?.clientName ?? "Loading…"}</dd>
          </div>
          {details ? (
            <>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requested OAuth scopes</dt>
                <dd className="mt-1">{details.scopes.join(", ") || "email"}</dd>
              </div>
              {details.redirectUri ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Return URL</dt>
                  <dd className="mt-1 break-all text-xs text-muted-foreground">{details.redirectUri}</dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>
      </div>

      <div className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
        <strong className="text-foreground">OAuth sign-in does not automatically expose your timetable.</strong> It
        authenticates this client as your Gapwise account. Timetable access is separately controlled by the AI
        permissions in Gapwise settings, and imported academic classes remain read-only.
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading || !details}
          onClick={() => void decide("approve")}
          className="button-primary min-h-11 px-4 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "Working…" : "Allow connector"}
        </button>
        <button
          type="button"
          disabled={loading || !details}
          onClick={() => void decide("deny")}
          className="button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden="true" /> Deny
        </button>
      </div>

      {message ? <p role="status" className="mt-4 text-xs leading-5 text-muted-foreground">{message}</p> : null}
      {details ? (
        <p className="mt-5 break-all text-[0.68rem] text-muted-foreground">Client ID: {details.clientId}</p>
      ) : null}
    </ConsentShell>
  );
}

function ConsentShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:py-20">
      <section className="surface mx-auto max-w-xl p-6 sm:p-8">{children}</section>
    </main>
  );
}

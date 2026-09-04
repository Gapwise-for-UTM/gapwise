import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Database,
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/features/auth/use-auth";
import { useTheme } from "@/hooks/use-preferences";
import { getSupabaseClient } from "@/lib/supabase";

type AccessState = "checking" | "authorized" | "denied";
type OpsResult = {
  ok?: boolean;
  generatedAt?: string;
  counts?: {
    users: number;
    encryptedProfiles: number;
    aiDelegations: number;
    inboundMail: number;
    failedMail: number;
  };
  recentEvents?: Array<{
    event_type: string;
    service: string;
    severity: string;
    request_id: string | null;
    created_at: string;
  }>;
  recentAudit?: Array<{
    action: string;
    resource_type: string;
    resource_id: string | null;
    request_id: string | null;
    created_at: string;
  }>;
  error?: string;
};
type HealthResult = {
  status?: "operational" | "degraded";
  checkedAt?: string;
  dependencies?: Record<string, { ok: boolean; latencyMs: number }>;
};
type VersionResult = { revision?: string | null; branch?: string | null; environment?: string };

export const Route = createFileRoute("/ops")({
  head: () => ({
    meta: [
      { title: "Gapwise Operations" },
      { name: "robots", content: "noindex,nofollow,noarchive,nosnippet" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: OpsPage,
});

async function invokeOps(): Promise<OpsResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error("cloud_unavailable");
  const { data, error } = await client.functions.invoke("ops-console", {
    body: { action: "overview" },
  });
  if (error) throw error;
  return (data ?? {}) as OpsResult;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`request_failed_${response.status}`);
  return (await response.json()) as T;
}

function HiddenRoute() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <section className="max-w-md text-center">
        <p className="eyebrow text-muted-foreground">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">The page you requested does not exist.</p>
        <Link
          to="/"
          className="button-secondary mt-6 inline-flex min-h-11 items-center px-5 text-sm font-semibold"
        >
          Back to Gapwise
        </Link>
      </section>
    </main>
  );
}

function statusText(value: boolean | undefined) {
  if (value === true) return "Operational";
  if (value === false) return "Degraded";
  return "Unknown";
}

function formatTime(value: string | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{value}</p>
    </article>
  );
}

function OpsPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [access, setAccess] = useState<AccessState>("checking");
  const [ops, setOps] = useState<OpsResult | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [version, setVersion] = useState<VersionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [opsResult, healthResult, versionResult] = await Promise.all([
        invokeOps(),
        fetchJson<HealthResult>("/api/health"),
        fetchJson<VersionResult>("/api/version"),
      ]);
      if (!opsResult.ok) throw new Error(opsResult.error || "not_authorized");
      setOps(opsResult);
      setHealth(healthResult);
      setVersion(versionResult);
      setAccess("authorized");
    } catch {
      setAccess((current) => {
        if (current === "authorized") {
          setError("Operations data could not be refreshed.");
          return current;
        }
        return "denied";
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAccess("denied");
      return;
    }
    void load();
  }, [authLoading, load, user]);

  if (authLoading || access === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Checking access…
      </main>
    );
  }
  if (access === "denied") return <HiddenRoute />;

  const counts = ops?.counts ?? {
    users: 0,
    encryptedProfiles: 0,
    aiDelegations: 0,
    inboundMail: 0,
    failedMail: 0,
  };
  const dependencies = health?.dependencies ?? {};

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="button-ghost inline-flex min-h-10 items-center gap-2 px-3 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Gapwise
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Operator only
              </p>
              <h1 className="font-display text-xl font-semibold">Operations</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="button-secondary inline-flex min-h-10 items-center gap-2 px-3 text-sm"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
        <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-muted-foreground">Production overview</p>
            <h2 className="mt-1 font-display text-3xl font-semibold">Gapwise platform health</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Sanitized operational metadata only. This dashboard does not expose timetable
              contents, precise location, credentials, email bodies, or OAuth tokens.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            Revision{" "}
            <span className="font-mono text-foreground">{version?.revision ?? "unknown"}</span> ·{" "}
            {version?.environment ?? "unknown"}
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Accounts" value={counts.users} icon={<Users className="h-5 w-5" />} />
          <MetricCard
            label="Encrypted profiles"
            value={counts.encryptedProfiles}
            icon={<Database className="h-5 w-5" />}
          />
          <MetricCard
            label="AI delegations"
            value={counts.aiDelegations}
            icon={<KeyRound className="h-5 w-5" />}
          />
          <MetricCard
            label="Inbound mail"
            value={counts.inboundMail}
            icon={<Mail className="h-5 w-5" />}
          />
          <MetricCard
            label="Mail failures"
            value={counts.failedMail}
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow text-muted-foreground">Services</p>
                <h3 className="mt-1 font-display text-xl font-semibold">Dependency health</h3>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-5 divide-y divide-border/70">
              {Object.entries(dependencies).map(([name, state]) => (
                <div key={name} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="font-medium capitalize">{name}</div>
                  <div className="text-right">
                    <span
                      className={
                        state.ok
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }
                    >
                      {statusText(state.ok)}
                    </span>
                    <span className="ml-3 text-muted-foreground">{state.latencyMs} ms</span>
                  </div>
                </div>
              ))}
              {Object.keys(dependencies).length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No dependency data available.</p>
              ) : null}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Last checked {formatTime(health?.checkedAt)}
            </p>
          </article>

          <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <p className="eyebrow text-muted-foreground">Audit</p>
            <h3 className="mt-1 font-display text-xl font-semibold">Recent privileged activity</h3>
            <div className="mt-5 space-y-3">
              {(ops?.recentAudit ?? []).slice(0, 8).map((item, index) => (
                <div
                  key={`${item.created_at}-${index}`}
                  className="rounded-xl border border-border/60 px-3 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-semibold">{item.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(item.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.resource_type}
                    {item.resource_id ? ` · ${item.resource_id}` : ""}
                  </p>
                </div>
              ))}
              {(ops?.recentAudit ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events yet.</p>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

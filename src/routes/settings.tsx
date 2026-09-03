import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, Database, ExternalLink, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/features/auth/use-auth";
import { useTheme } from "@/hooks/use-preferences";
import { getSupabaseClient } from "@/lib/supabase";

type EmailPreferences = { product_updates: boolean; security_notices: boolean };
type AiEvent = { id: string; client_name: string; event_type: string; capability: string | null; created_at: string };
type SettingsResult = {
  ok?: boolean;
  preferences?: EmailPreferences;
  aiEvents?: AiEvent[];
  productUpdates?: boolean;
  error?: string;
};
type SaveState = "idle" | "saving" | "saved" | "error";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Gapwise" },
      { name: "description", content: "Manage Gapwise privacy, communications, and delegated AI access." },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
    ],
  }),
  component: SettingsPage,
});

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function invokeSettings(body: Record<string, unknown>): Promise<SettingsResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error("cloud_unavailable");
  const { data, error } = await client.functions.invoke("account-settings", { body });
  if (error) throw error;
  return (data ?? {}) as SettingsResult;
}

function SettingsPage() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [aiEvents, setAiEvents] = useState<AiEvent[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    invokeSettings({ action: "read" })
      .then((result) => {
        if (!alive) return;
        if (!result.ok) throw new Error(result.error || "settings_unavailable");
        setPreferences(result.preferences ?? { product_updates: false, security_notices: true });
        setAiEvents(result.aiEvents ?? []);
      })
      .catch(() => {
        if (alive) setLoadError("Some cloud settings could not be loaded. Your local timetable is unaffected.");
      });
    return () => {
      alive = false;
    };
  }, [loading, user]);

  const groupedAiEvents = useMemo(() => aiEvents.slice(0, 12), [aiEvents]);

  async function setProductUpdates(enabled: boolean) {
    if (!user || !preferences) return;
    const previous = preferences;
    setPreferences({ ...preferences, product_updates: enabled });
    setSaveState("saving");
    try {
      const result = await invokeSettings({ action: "set_product_updates", productUpdates: enabled });
      if (!result.ok) throw new Error(result.error || "save_failed");
    } catch {
      setPreferences(previous);
      setSaveState("error");
      return;
    }
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1500);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="button-ghost inline-flex min-h-10 items-center gap-2 px-3 text-sm"><ArrowLeft className="h-4 w-4" />Gapwise</Link>
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account</p><h1 className="font-display text-xl font-semibold">System & privacy</h1></div>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-8 sm:px-8">
        <section>
          <p className="eyebrow text-muted-foreground">Trust center</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">Your Gapwise data</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Gapwise keeps the timetable engine local-first. Optional account, encrypted sync, friend availability, and delegated AI features have separate boundaries so one feature does not silently expand another feature's access.</p>
        </section>

        {loadError ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{loadError}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><Database className="h-5 w-5 text-muted-foreground" /><h3 className="font-display text-lg font-semibold">Timetable</h3></div><p className="mt-3 text-sm leading-6 text-muted-foreground">ACORN calendar parsing and the canonical timetable model are built in the browser. Exact course lists are not sent merely to enrich course titles.</p><p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">Local-first</p></article>
          <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-muted-foreground" /><h3 className="font-display text-lg font-semibold">Encrypted sync</h3></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Private cloud payloads are stored as application-encrypted ciphertext with separate key material for private data and friend availability.</p><Link to="/privacy" className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">Read the privacy model <ExternalLink className="h-3.5 w-3.5" /></Link></article>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-muted-foreground" /><div className="min-w-0 flex-1"><h3 className="font-display text-xl font-semibold">Email preferences</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Security and account notices are transactional. Product updates are optional and default off.</p></div></div>
          {!user ? <p className="mt-5 text-sm text-muted-foreground">Sign in to manage account email preferences.</p> : preferences ? (
            <label className="mt-5 flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border/70 px-4 py-4">
              <span><span className="block text-sm font-semibold">Major Gapwise product updates</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Occasional major releases only. No timetable data or private context is attached to marketing consent.</span></span>
              <input className="mt-1 h-5 w-5" type="checkbox" checked={preferences.product_updates} onChange={(event) => void setProductUpdates(event.target.checked)} aria-label="Receive major Gapwise product updates" />
            </label>
          ) : <p className="mt-5 text-sm text-muted-foreground">Loading preferences…</p>}
          {saveState === "saving" ? <p className="mt-3 text-xs text-muted-foreground">Saving…</p> : null}
          {saveState === "saved" ? <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">Preference saved.</p> : null}
          {saveState === "error" ? <p className="mt-3 text-xs text-destructive">Preference could not be saved.</p> : null}
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3"><Bot className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><h3 className="font-display text-xl font-semibold">AI access history</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Minimal access metadata only. Tool payloads, timetable contents, precise location, credentials, and raw OAuth tokens are not stored in this history.</p></div></div>
          <div className="mt-5 space-y-3">
            {!user ? <p className="text-sm text-muted-foreground">Sign in to review delegated AI activity.</p> : groupedAiEvents.length === 0 ? <p className="text-sm text-muted-foreground">No recorded AI access events yet.</p> : groupedAiEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-border/60 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{event.client_name}</span><span className="text-xs text-muted-foreground">{formatTime(event.created_at)}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.event_type.replaceAll("_", " ")}{event.capability ? ` · ${event.capability}` : ""}</p></div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><h3 className="font-display text-xl font-semibold">Security controls</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Review the full privacy and security architecture, report a vulnerability, or use existing account controls from the main app to clear synced data and delete your account.</p><div className="mt-4 flex flex-wrap gap-3"><Link to="/privacy" className="button-secondary inline-flex min-h-10 items-center px-4 text-sm">Privacy</Link><a href="mailto:security@gapwise.ca" className="button-secondary inline-flex min-h-10 items-center px-4 text-sm">Report security issue</a></div></div></div>
        </section>
      </div>
    </main>
  );
}

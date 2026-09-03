import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Inbox, Loader2, RefreshCw, Reply, ShieldCheck } from "lucide-react";
import { useAuth } from "@/features/auth/use-auth";
import { getSupabaseClient } from "@/lib/supabase";

type Mailbox = "support" | "security" | "test";
type AccessState = "checking" | "authorized" | "denied";
type MailMessage = {
  resend_email_id: string;
  direction: "inbound" | "outbound";
  message_id: string | null;
  from_address: string | null;
  to_addresses: string[];
  subject: string | null;
  mailbox: string | null;
  attachment_metadata: Array<{ filename?: string | null }>;
  text_body: string | null;
  latest_event_type: string;
  event_created_at: string | null;
  updated_at: string;
  thread_id: string;
  in_reply_to: string | null;
  reply_to_address: string | null;
};
type InvokeResult = { messages?: MailMessage[]; ok?: boolean; error?: string };

export const Route = createFileRoute("/mail")({
  head: () => ({
    meta: [
      { title: "Gapwise" },
      { name: "robots", content: "noindex,nofollow,noarchive,nosnippet" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: MailPage,
});

async function invokeMail(body: Record<string, unknown>): Promise<InvokeResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error("cloud_unavailable");
  const { data, error } = await client.functions.invoke("mail-operator", { body });
  if (error) throw error;
  return (data ?? {}) as InvokeResult;
}

function formatTime(value: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function HiddenRoute() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <section className="max-w-md text-center">
        <p className="eyebrow text-muted-foreground">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">The page you requested does not exist.</p>
        <Link to="/" className="button-secondary mt-6 inline-flex min-h-11 items-center px-5 text-sm font-semibold">
          Back to Gapwise
        </Link>
      </section>
    </main>
  );
}

function MailPage() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<AccessState>("checking");
  const [mailbox, setMailbox] = useState<Mailbox>("support");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [thread, setThread] = useState<MailMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAccess("denied");
      return;
    }
    let active = true;
    setAccess("checking");
    void invokeMail({ action: "authorize" })
      .then((result) => {
        if (active) setAccess(result.ok === true ? "authorized" : "denied");
      })
      .catch(() => {
        if (active) setAccess("denied");
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const loadInbox = useCallback(async () => {
    if (access !== "authorized") return;
    setLoading(true);
    setError(null);
    try {
      const result = await invokeMail({ action: "list", mailbox });
      const next = result.messages ?? [];
      setMessages(next);
      if (selected && !next.some((item) => item.resend_email_id === selected.resend_email_id)) {
        setSelected(null);
        setThread([]);
      }
    } catch {
      setError("Mail could not be loaded. No message data was exposed.");
    } finally {
      setLoading(false);
    }
  }, [access, mailbox, selected]);

  useEffect(() => {
    if (access === "authorized") void loadInbox();
  }, [access, loadInbox]);

  const openMessage = useCallback(async (message: MailMessage) => {
    setSelected(message);
    setError(null);
    try {
      const result = await invokeMail({ action: "thread", threadId: message.thread_id });
      setThread(result.messages ?? [message]);
    } catch {
      setThread([]);
      setSelected(null);
      setError("The conversation could not be opened.");
    }
  }, []);

  const replyTarget = useMemo(
    () => [...thread].reverse().find((item) => item.direction === "inbound") ?? selected,
    [selected, thread],
  );

  const sendReply = useCallback(async () => {
    if (!replyTarget || !replyText.trim() || access !== "authorized") return;
    setSending(true);
    setError(null);
    try {
      await invokeMail({ action: "reply", messageId: replyTarget.resend_email_id, text: replyText.trim() });
      setReplyText("");
      const refreshed = await invokeMail({ action: "thread", threadId: replyTarget.thread_id });
      setThread(refreshed.messages ?? []);
      await loadInbox();
    } catch {
      setError("The reply was not sent. Nothing was silently discarded.");
    } finally {
      setSending(false);
    }
  }, [access, loadInbox, replyTarget, replyText]);

  if (authLoading || access === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }
  if (access !== "authorized") return <HiddenRoute />;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Gapwise
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-accent/20 bg-accent/8">
                <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow text-accent">Private operator console</p>
                <h1 className="font-display text-2xl font-semibold">Mail</h1>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => void loadInbox()} disabled={loading} className="button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
          </button>
        </header>

        <div className="mb-4 flex gap-2" role="tablist" aria-label="Mailbox">
          {(["support", "security", "test"] as const).map((name) => (
            <button key={name} type="button" role="tab" aria-selected={mailbox === name} onClick={() => { setMailbox(name); setSelected(null); setThread([]); }} className={mailbox === name ? "button-primary min-h-10 px-4 text-sm font-semibold capitalize" : "button-secondary min-h-10 px-4 text-sm font-semibold capitalize"}>
              {name}
            </button>
          ))}
        </div>

        {error ? <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm">{error}</div> : null}

        <div className="grid min-h-[68vh] overflow-hidden rounded-3xl border border-border/70 bg-card/70 lg:grid-cols-[360px_1fr]">
          <aside className="border-b border-border/70 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-sm font-semibold">
              <Inbox className="h-4 w-4 text-accent" aria-hidden="true" /> {mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}
            </div>
            <div className="max-h-[68vh] overflow-y-auto">
              {!loading && messages.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No messages in this mailbox yet.</p> : null}
              {messages.map((message) => (
                <button key={message.resend_email_id} type="button" onClick={() => void openMessage(message)} className={`w-full border-b border-border/60 px-4 py-4 text-left transition hover:bg-accent/5 ${selected?.resend_email_id === message.resend_email_id ? "bg-accent/8" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{message.direction === "inbound" ? message.from_address : message.to_addresses[0]}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{message.direction === "outbound" ? "Sent" : "Received"}</span>
                  </div>
                  <p className="mt-1 truncate text-sm">{message.subject || "(no subject)"}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{message.text_body || "No plain-text preview."}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0">
            {!selected ? (
              <div className="grid h-full min-h-[420px] place-items-center p-8 text-center">
                <div><Inbox className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 font-display text-xl font-semibold">Choose a conversation</h2></div>
              </div>
            ) : (
              <div className="flex h-full max-h-[68vh] flex-col">
                <div className="border-b border-border/70 px-5 py-4"><h2 className="font-display text-xl font-semibold">{selected.subject || "(no subject)"}</h2><p className="mt-1 text-xs text-muted-foreground">Thread {selected.thread_id.slice(0, 8)} · {formatTime(selected.event_created_at ?? selected.updated_at)}</p></div>
                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  {thread.map((message) => (
                    <article key={message.resend_email_id} className={`max-w-3xl rounded-2xl border p-4 ${message.direction === "outbound" ? "ml-auto border-accent/20 bg-accent/6" : "border-border/70 bg-background/60"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{message.direction === "inbound" ? `From ${message.from_address ?? "unknown sender"}` : `From ${message.from_address ?? "Gapwise"}`}</span><span>{formatTime(message.event_created_at ?? message.updated_at)}</span></div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{message.text_body || "(No plain-text body)"}</p>
                      {message.attachment_metadata?.length ? <p className="mt-3 text-xs text-muted-foreground">Attachments: {message.attachment_metadata.map((item) => item.filename || "attachment").join(", ")}</p> : null}
                    </article>
                  ))}
                </div>
                <div className="border-t border-border/70 p-4">
                  <label htmlFor="operator-reply" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reply as {mailbox === "security" ? "security@gapwise.ca" : "support@gapwise.ca"}</label>
                  <textarea id="operator-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={4} placeholder="Write a reply…" className="mt-2 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent" />
                  <div className="mt-3 flex justify-end"><button type="button" disabled={!replyText.trim() || sending} onClick={() => void sendReply()} className="button-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-semibold disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Reply className="h-4 w-4" aria-hidden="true" />}{sending ? "Sending…" : "Send reply"}</button></div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

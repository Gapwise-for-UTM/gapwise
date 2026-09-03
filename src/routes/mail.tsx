import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Inbox, Loader2, RefreshCw, Reply, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/features/auth/use-auth";
import { useTheme } from "@/hooks/use-preferences";
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

function cleanConversationBody(value: string | null) {
  if (!value) return "";
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (/^On .+ wrote:\s*$/iu.test(line.trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}$/iu.test(line.trim())) break;
    if (/^From:\s.+/iu.test(line.trim()) && kept.length > 0) break;
    kept.push(line);
  }
  while (kept.length && !kept[kept.length - 1]?.trim()) kept.pop();
  return kept.join("\n").trim();
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
  const { theme, toggleTheme } = useTheme();
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

  const loadInbox = useCallback(async (silent = false) => {
    if (access !== "authorized") return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await invokeMail({ action: "list", mailbox });
      setMessages(result.messages ?? []);
    } catch {
      if (!silent) setError("Mail could not be loaded. No message data was exposed.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [access, mailbox]);

  useEffect(() => {
    if (access !== "authorized") return;
    void loadInbox();
    const timer = window.setInterval(() => void loadInbox(true), 20_000);
    return () => window.clearInterval(timer);
  }, [access, loadInbox]);

  const conversations = useMemo(() => {
    const byThread = new Map<string, MailMessage>();
    for (const message of messages) {
      if (!byThread.has(message.thread_id)) byThread.set(message.thread_id, message);
    }
    return [...byThread.values()];
  }, [messages]);

  useEffect(() => {
    if (!selected) return;
    const summary = conversations.find((item) => item.thread_id === selected.thread_id);
    if (!summary) {
      setSelected(null);
      setThread([]);
    }
  }, [conversations, selected]);

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
    if (!replyTarget || !replyText.trim() || access !== "authorized" || sending) return;
    setSending(true);
    setError(null);
    try {
      await invokeMail({ action: "reply", messageId: replyTarget.resend_email_id, text: replyText.trim() });
      setReplyText("");
      const refreshed = await invokeMail({ action: "thread", threadId: replyTarget.thread_id });
      setThread(refreshed.messages ?? []);
      await loadInbox(true);
    } catch {
      setError("The reply was not sent. Nothing was silently discarded.");
    } finally {
      setSending(false);
    }
  }, [access, loadInbox, replyTarget, replyText, sending]);

  if (authLoading || access === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }
  if (access !== "authorized") return <HiddenRoute />;

  const replyAs = mailbox === "security" ? "security@gapwise.ca" : "support@gapwise.ca";

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
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button type="button" onClick={() => void loadInbox()} disabled={loading} className="button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </button>
          </div>
        </header>

        <div className="mb-4 flex gap-2" role="tablist" aria-label="Mailbox">
          {(["support", "security", "test"] as const).map((name) => (
            <button key={name} type="button" role="tab" aria-selected={mailbox === name} onClick={() => { setMailbox(name); setSelected(null); setThread([]); }} className={mailbox === name ? "button-primary min-h-10 px-4 text-sm font-semibold capitalize" : "button-secondary min-h-10 px-4 text-sm font-semibold capitalize"}>
              {name}
            </button>
          ))}
        </div>

        {error ? <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm">{error}</div> : null}

        <div className="grid min-h-[70vh] overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm lg:grid-cols-[360px_1fr]">
          <aside className="border-b border-border/70 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Inbox className="h-4 w-4 text-accent" aria-hidden="true" /> {mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</div>
              <span className="text-xs text-muted-foreground">{conversations.length} conversation{conversations.length === 1 ? "" : "s"}</span>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {!loading && conversations.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No messages in this mailbox yet.</p> : null}
              {conversations.map((message) => {
                const active = selected?.thread_id === message.thread_id;
                const preview = cleanConversationBody(message.text_body) || "No plain-text preview.";
                return (
                  <button key={message.thread_id} type="button" onClick={() => void openMessage(message)} className={`w-full border-b border-border/60 px-4 py-4 text-left transition-colors hover:bg-accent/5 ${active ? "bg-accent/8" : ""}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{message.direction === "inbound" ? message.from_address : message.to_addresses[0]}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(message.event_created_at ?? message.updated_at)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{message.subject || "(no subject)"}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{preview}</p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0">
            {!selected ? (
              <div className="grid h-full min-h-[440px] place-items-center p-8 text-center">
                <div><Inbox className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 font-display text-xl font-semibold">Choose a conversation</h2><p className="mt-2 text-sm text-muted-foreground">Replies and follow-ups stay grouped into one thread.</p></div>
              </div>
            ) : (
              <div className="flex h-full max-h-[70vh] flex-col">
                <div className="border-b border-border/70 px-5 py-4"><h2 className="font-display text-xl font-semibold">{selected.subject || "(no subject)"}</h2><p className="mt-1 text-xs text-muted-foreground">Conversation · {thread.length} message{thread.length === 1 ? "" : "s"}</p></div>
                <div className="flex-1 space-y-4 overflow-y-auto bg-background/30 p-5">
                  {thread.map((message) => {
                    const body = cleanConversationBody(message.text_body) || "(No plain-text body)";
                    return (
                      <article key={message.resend_email_id} className={`max-w-3xl rounded-2xl border p-4 shadow-sm ${message.direction === "outbound" ? "ml-auto border-accent/20 bg-accent/6" : "border-border/70 bg-card"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{message.direction === "inbound" ? `From ${message.from_address ?? "unknown sender"}` : `From ${message.from_address ?? "Gapwise"}`}</span><span>{formatTime(message.event_created_at ?? message.updated_at)}</span></div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{body}</p>
                        {message.attachment_metadata?.length ? <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">Attachments: {message.attachment_metadata.map((item) => item.filename || "attachment").join(", ")}</p> : null}
                      </article>
                    );
                  })}
                </div>
                <div className="border-t border-border/70 bg-card/80 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="operator-reply" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reply as {replyAs}</label><span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter to send</span></div>
                  <textarea id="operator-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void sendReply(); } }} rows={5} placeholder="Write a polished reply…" className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" />
                  <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Gapwise branding, logo, website and a professional signature are added automatically.</p><button type="button" disabled={!replyText.trim() || sending} onClick={() => void sendReply()} className="button-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-semibold disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Reply className="h-4 w-4" aria-hidden="true" />}{sending ? "Sending…" : "Send reply"}</button></div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

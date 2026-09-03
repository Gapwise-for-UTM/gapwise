import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Download,
  Inbox,
  Loader2,
  Paperclip,
  PenLine,
  RefreshCw,
  Reply,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/features/auth/use-auth";
import { useTheme } from "@/hooks/use-preferences";
import { getSupabaseClient } from "@/lib/supabase";

type Mailbox = "support" | "security" | "test";
type AccessState = "checking" | "authorized" | "denied";
type AttachmentMeta = {
  id?: string | null;
  filename?: string | null;
  size?: number | null;
  content_type?: string | null;
};
type MailMessage = {
  resend_email_id: string;
  direction: "inbound" | "outbound";
  message_id: string | null;
  from_address: string | null;
  to_addresses: string[];
  subject: string | null;
  mailbox: string | null;
  attachment_metadata: AttachmentMeta[];
  text_body: string | null;
  latest_event_type: string;
  event_created_at: string | null;
  updated_at: string;
  thread_id: string;
  in_reply_to: string | null;
  reply_to_address: string | null;
};
type InvokeResult = {
  messages?: MailMessage[];
  ok?: boolean;
  id?: string;
  threadId?: string;
  downloadUrl?: string;
  error?: string;
};

type ComposeDraft = { recipient: string; subject: string; text: string };

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

function toDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value: string | null) {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Unknown time";
}

function formatInboxTime(value: string | null) {
  const date = toDate(value);
  if (!date) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(
    undefined,
    sameYear ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" },
  ).format(date);
}

function formatBytes(value: number | null | undefined) {
  if (!value || value < 1) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function cleanConversationBody(value: string | null) {
  if (!value) return "";
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^On .+ wrote:\s*$/iu.test(trimmed)) break;
    if (/^-{2,}\s*Original Message\s*-{2,}$/iu.test(trimmed)) break;
    if (/^From:\s.+/iu.test(trimmed) && kept.length > 0) break;
    kept.push(line);
  }
  while (kept.length && !kept[kept.length - 1]?.trim()) kept.pop();
  return kept.join("\n").trim();
}

function bareAddress(value: string | null | undefined) {
  if (!value) return "";
  return value.match(/<([^<>]+)>/u)?.[1] ?? value;
}

function displayName(value: string | null | undefined) {
  if (!value) return "Unknown sender";
  const name = value.replace(/<[^<>]+>/gu, "").trim();
  if (name) return name;
  const address = bareAddress(value);
  return address.split("@")[0] || address;
}

function senderInitial(value: string | null | undefined) {
  return displayName(value).slice(0, 1).toUpperCase() || "?";
}

function deliveryLabel(message: MailMessage) {
  if (message.direction === "inbound") return null;
  const event = message.latest_event_type.toLowerCase();
  if (event.includes("fail") || event.includes("bounce") || event.includes("suppress"))
    return { label: "Delivery issue", kind: "error" as const };
  if (event.includes("deliver")) return { label: "Delivered", kind: "success" as const };
  if (event.includes("sent")) return { label: "Sent", kind: "success" as const };
  return { label: "Sending", kind: "pending" as const };
}

function draftKey(mailbox: Mailbox, threadId: string) {
  return `gapwise:mail:draft:${mailbox}:${threadId}`;
}

function composeKey(mailbox: Mailbox) {
  return `gapwise:mail:compose:${mailbox}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
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
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [compose, setCompose] = useState<ComposeDraft>({ recipient: "", subject: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

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
    if (!silent) setError(null);
    try {
      const result = await invokeMail({ action: "list", mailbox });
      setMessages(result.messages ?? []);
    } catch {
      if (!silent) setError("Mail could not be loaded. No message data was exposed.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [access, mailbox]);

  const refreshThread = useCallback(async (threadId: string, silent = false) => {
    if (!silent) setThreadLoading(true);
    try {
      const result = await invokeMail({ action: "thread", threadId });
      setThread(result.messages ?? []);
    } catch {
      if (!silent) setError("The conversation could not be refreshed.");
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access !== "authorized") return;
    void loadInbox();
    const timer = window.setInterval(() => {
      void loadInbox(true);
      if (selected?.thread_id) void refreshThread(selected.thread_id, true);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [access, loadInbox, refreshThread, selected?.thread_id]);

  const conversations = useMemo(() => {
    const byThread = new Map<string, MailMessage>();
    for (const message of messages) {
      if (!byThread.has(message.thread_id)) byThread.set(message.thread_id, message);
    }
    return [...byThread.values()];
  }, [messages]);

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((message) => {
      const haystack = [
        message.subject,
        message.from_address,
        message.to_addresses.join(" "),
        cleanConversationBody(message.text_body),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [conversations, query]);

  useEffect(() => {
    if (!selected) return;
    if (!conversations.some((item) => item.thread_id === selected.thread_id)) {
      setSelected(null);
      setThread([]);
    }
  }, [conversations, selected]);

  const openMessage = useCallback(async (message: MailMessage) => {
    setComposing(false);
    setSelected(message);
    setError(null);
    setThreadLoading(true);
    try {
      const result = await invokeMail({ action: "thread", threadId: message.thread_id });
      setThread(result.messages ?? [message]);
    } catch {
      setThread([]);
      setSelected(null);
      setError("The conversation could not be opened.");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) {
      setReplyText("");
      return;
    }
    try {
      setReplyText(window.localStorage.getItem(draftKey(mailbox, selected.thread_id)) ?? "");
    } catch {
      setReplyText("");
    }
  }, [mailbox, selected?.thread_id]);

  useEffect(() => {
    if (!selected) return;
    const key = draftKey(mailbox, selected.thread_id);
    const timer = window.setTimeout(() => {
      try {
        if (replyText.trim()) window.localStorage.setItem(key, replyText);
        else window.localStorage.removeItem(key);
      } catch {
        // Draft persistence is a convenience only; mailbox operation never depends on it.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mailbox, replyText, selected]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(composeKey(mailbox));
      if (!raw) {
        setCompose({ recipient: "", subject: "", text: "" });
        return;
      }
      const parsed = JSON.parse(raw) as Partial<ComposeDraft>;
      setCompose({
        recipient: typeof parsed.recipient === "string" ? parsed.recipient : "",
        subject: typeof parsed.subject === "string" ? parsed.subject : "",
        text: typeof parsed.text === "string" ? parsed.text : "",
      });
    } catch {
      setCompose({ recipient: "", subject: "", text: "" });
    }
  }, [mailbox]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (compose.recipient.trim() || compose.subject.trim() || compose.text.trim()) {
          window.localStorage.setItem(composeKey(mailbox), JSON.stringify(compose));
        } else {
          window.localStorage.removeItem(composeKey(mailbox));
        }
      } catch {
        // Non-critical local draft convenience.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [compose, mailbox]);

  useEffect(() => {
    if (!thread.length) return;
    window.requestAnimationFrame(() => threadEndRef.current?.scrollIntoView({ block: "end" }));
  }, [selected?.thread_id, thread.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && (selected || composing) && !(event.target instanceof HTMLTextAreaElement)) {
        setSelected(null);
        setThread([]);
        setComposing(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composing, selected]);

  const replyTarget = useMemo(
    () => [...thread].reverse().find((item) => item.direction === "inbound") ?? selected,
    [selected, thread],
  );

  const sendReply = useCallback(async () => {
    if (!replyTarget || !replyText.trim() || access !== "authorized" || sending) return;
    setSending(true);
    setError(null);
    try {
      await invokeMail({
        action: "reply",
        messageId: replyTarget.resend_email_id,
        text: replyText.trim(),
        requestId: crypto.randomUUID(),
      });
      try {
        window.localStorage.removeItem(draftKey(mailbox, replyTarget.thread_id));
      } catch {
        // Non-critical.
      }
      setReplyText("");
      await refreshThread(replyTarget.thread_id, true);
      await loadInbox(true);
    } catch {
      setError("The reply was not sent. Your draft is still here.");
    } finally {
      setSending(false);
    }
  }, [access, loadInbox, mailbox, refreshThread, replyTarget, replyText, sending]);

  const sendNew = useCallback(async () => {
    if (
      access !== "authorized" ||
      sending ||
      !isValidEmail(compose.recipient) ||
      !compose.subject.trim() ||
      !compose.text.trim()
    )
      return;
    setSending(true);
    setError(null);
    try {
      const result = await invokeMail({
        action: "send",
        mailbox,
        recipient: compose.recipient.trim(),
        subject: compose.subject.trim(),
        text: compose.text.trim(),
        requestId: crypto.randomUUID(),
      });
      try {
        window.localStorage.removeItem(composeKey(mailbox));
      } catch {
        // Non-critical.
      }
      setCompose({ recipient: "", subject: "", text: "" });
      setComposing(false);
      await loadInbox(true);
      if (result.threadId) {
        const refreshed = await invokeMail({ action: "thread", threadId: result.threadId });
        const next = refreshed.messages ?? [];
        if (next[0]) {
          setSelected(next[next.length - 1] ?? next[0]);
          setThread(next);
        }
      }
    } catch {
      setError("The message was not sent. Your draft is still here.");
    } finally {
      setSending(false);
    }
  }, [access, compose, loadInbox, mailbox, sending]);

  const downloadAttachment = useCallback(async (message: MailMessage, attachment: AttachmentMeta) => {
    if (!attachment.id || attachmentLoading) return;
    setAttachmentLoading(attachment.id);
    setError(null);
    try {
      const result = await invokeMail({
        action: "attachment",
        messageId: message.resend_email_id,
        attachmentId: attachment.id,
      });
      if (!result.downloadUrl) throw new Error("attachment_url_missing");
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch {
      setError("The attachment could not be opened securely. Try again to request a fresh download link.");
    } finally {
      setAttachmentLoading(null);
    }
  }, [attachmentLoading]);

  if (authLoading || access === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }
  if (access !== "authorized") return <HiddenRoute />;

  const replyAs = mailbox === "security" ? "security@gapwise.ca" : "support@gapwise.ca";
  const selectedParticipant = selected
    ? selected.direction === "inbound"
      ? selected.from_address
      : selected.to_addresses[0]
    : null;
  const canSendNew = isValidEmail(compose.recipient) && Boolean(compose.subject.trim()) && Boolean(compose.text.trim());

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
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
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button type="button" onClick={() => void loadInbox()} disabled={loading} className="button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </button>
          </div>
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Mailbox">
            {(["support", "security", "test"] as const).map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={mailbox === name}
                onClick={() => {
                  setMailbox(name);
                  setSelected(null);
                  setThread([]);
                  setComposing(false);
                  setQuery("");
                }}
                className={mailbox === name ? "button-primary min-h-10 px-4 text-sm font-semibold capitalize" : "button-secondary min-h-10 px-4 text-sm font-semibold capitalize"}
              >
                {name}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { setSelected(null); setThread([]); setComposing(true); }} className="button-secondary ml-auto inline-flex min-h-10 items-center gap-2 px-4 text-sm font-semibold"><PenLine className="h-4 w-4" aria-hidden="true" />New message</button>
        </div>

        {error ? <div className="mb-3 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</div> : null}

        <div className="grid min-h-[76vh] overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm lg:grid-cols-[390px_1fr]">
          <aside className={`${selected || composing ? "hidden lg:block" : "block"} border-border/70 lg:border-r`}>
            <div className="border-b border-border/70 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${mailbox}…`}
                  aria-label={`Search ${mailbox} conversations`}
                  className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-12 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">/</kbd>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Inbox className="h-4 w-4 text-accent" aria-hidden="true" /> {mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</div>
              <span className="text-xs text-muted-foreground">{filteredConversations.length} of {conversations.length}</span>
            </div>
            <div className="max-h-[calc(76vh-105px)] overflow-y-auto">
              {loading ? <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading conversations…</div> : null}
              {!loading && filteredConversations.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{query ? "No conversations match your search." : "No messages in this mailbox yet."}</p> : null}
              {filteredConversations.map((message) => {
                const active = selected?.thread_id === message.thread_id;
                const participant = message.direction === "inbound" ? message.from_address : message.to_addresses[0];
                const preview = cleanConversationBody(message.text_body) || "No plain-text preview.";
                const delivery = deliveryLabel(message);
                return (
                  <button key={message.thread_id} type="button" onClick={() => void openMessage(message)} className={`group w-full border-b border-border/60 px-4 py-4 text-left transition-colors hover:bg-accent/5 ${active ? "bg-accent/8" : ""}`}>
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{senderInitial(participant)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold">{displayName(participant)}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatInboxTime(message.event_created_at ?? message.updated_at)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium">{message.subject || "(no subject)"}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{preview}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {message.attachment_metadata?.length ? <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" aria-hidden="true" />{message.attachment_metadata.length}</span> : null}
                          {delivery ? <span>{delivery.label}</span> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className={`${selected || composing ? "block" : "hidden lg:block"} min-w-0`}>
            {composing ? (
              <div className="flex h-full max-h-[76vh] flex-col">
                <div className="flex items-center gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
                  <button type="button" onClick={() => setComposing(false)} className="button-secondary inline-flex h-9 w-9 shrink-0 items-center justify-center lg:hidden" aria-label="Back to conversations"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
                  <div className="min-w-0 flex-1"><h2 className="font-display text-xl font-semibold">New message</h2><p className="mt-1 text-xs text-muted-foreground">From {replyAs}</p></div>
                  <button type="button" onClick={() => setComposing(false)} className="button-secondary hidden h-9 w-9 items-center justify-center lg:inline-flex" aria-label="Close composer"><X className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                <div className="flex-1 overflow-y-auto bg-background/30 p-4 sm:p-6">
                  <div className="mx-auto max-w-3xl rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="compose-to">To</label>
                    <input id="compose-to" type="email" value={compose.recipient} onChange={(event) => setCompose((value) => ({ ...value, recipient: event.target.value }))} placeholder="recipient@example.com" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" />
                    {compose.recipient.trim() && !isValidEmail(compose.recipient) ? <p className="mt-1 text-xs text-destructive">Enter a valid email address.</p> : null}
                    <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="compose-subject">Subject</label>
                    <input id="compose-subject" value={compose.subject} maxLength={300} onChange={(event) => setCompose((value) => ({ ...value, subject: event.target.value }))} placeholder="Subject" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" />
                    <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="compose-body">Message</label>
                    <textarea id="compose-body" value={compose.text} onChange={(event) => setCompose((value) => ({ ...value, text: event.target.value }))} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void sendNew(); } }} rows={12} placeholder="Write your message…" className="mt-2 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-[15px] leading-7 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" />
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Draft saved on this device. Gapwise branding is added automatically.</p><button type="button" disabled={!canSendNew || sending} onClick={() => void sendNew()} className="button-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-semibold disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}{sending ? "Sending…" : "Send message"}</button></div>
                  </div>
                </div>
              </div>
            ) : !selected ? (
              <div className="grid h-full min-h-[520px] place-items-center p-8 text-center">
                <div><Inbox className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 font-display text-xl font-semibold">Choose a conversation</h2><p className="mt-2 text-sm text-muted-foreground">Search, read, compose and reply without leaving the private operator console.</p></div>
              </div>
            ) : (
              <div className="flex h-full max-h-[76vh] flex-col">
                <div className="flex items-start gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
                  <button type="button" onClick={() => { setSelected(null); setThread([]); }} className="button-secondary mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center lg:hidden" aria-label="Back to conversations"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-xl font-semibold">{selected.subject || "(no subject)"}</h2>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{selectedParticipant ? `${displayName(selectedParticipant)} · ${bareAddress(selectedParticipant)}` : "Conversation"} · {thread.length} message{thread.length === 1 ? "" : "s"}</p>
                  </div>
                  {threadLoading ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing conversation" /> : null}
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto bg-background/30 p-4 sm:p-5">
                  {thread.map((message) => {
                    const body = cleanConversationBody(message.text_body) || "(No plain-text body)";
                    const delivery = deliveryLabel(message);
                    const sender = message.direction === "inbound" ? message.from_address : message.from_address ?? "Gapwise";
                    return (
                      <article key={message.resend_email_id} className={`max-w-3xl rounded-2xl border p-4 shadow-sm sm:p-5 ${message.direction === "outbound" ? "ml-auto border-accent/20 bg-accent/6" : "border-border/70 bg-card"}`}>
                        <div className="flex items-start gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${message.direction === "outbound" ? "bg-accent/12 text-accent" : "bg-muted text-muted-foreground"}`}>{senderInitial(sender)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                              <div className="min-w-0"><p className="truncate text-sm font-semibold">{displayName(sender)}</p><p className="truncate text-xs text-muted-foreground">{bareAddress(sender)}</p></div>
                              <span className="shrink-0 text-xs text-muted-foreground">{formatTime(message.event_created_at ?? message.updated_at)}</span>
                            </div>
                            <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7">{body}</p>
                            {message.attachment_metadata?.length ? <div className="mt-4 border-t border-border/60 pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Attachments</p><div className="flex flex-wrap gap-2">{message.attachment_metadata.map((attachment, index) => {
                              const size = formatBytes(attachment.size);
                              const downloadable = message.direction === "inbound" && Boolean(attachment.id);
                              return downloadable ? (
                                <button key={`${attachment.id ?? index}`} type="button" onClick={() => void downloadAttachment(message, attachment)} disabled={attachmentLoading === attachment.id} className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-xs disabled:opacity-60">{attachmentLoading === attachment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}<span>{attachment.filename || "attachment"}</span>{size ? <span className="text-muted-foreground">{size}</span> : null}</button>
                              ) : (
                                <span key={`${attachment.filename ?? "attachment"}-${index}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 py-1.5 text-xs"><Paperclip className="h-3.5 w-3.5" aria-hidden="true" />{attachment.filename || "attachment"}{size ? <span className="text-muted-foreground">{size}</span> : null}</span>
                              );
                            })}</div></div> : null}
                            {delivery ? <div className={`mt-3 inline-flex items-center gap-1.5 text-xs ${delivery.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>{delivery.kind === "success" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : delivery.kind === "pending" ? <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> : <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />}{delivery.label}</div> : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                <div className="border-t border-border/70 bg-card/90 p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="operator-reply" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reply as {replyAs}</label><span className="hidden text-[11px] text-muted-foreground sm:inline">Ctrl/⌘ + Enter to send</span></div>
                  <textarea id="operator-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void sendReply(); } }} rows={5} placeholder="Write a reply…" className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-[15px] leading-6 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">{replyText.trim() ? "Draft saved on this device." : "Professional Gapwise signature and responsive email formatting are added automatically."}</p><button type="button" disabled={!replyText.trim() || sending} onClick={() => void sendReply()} className="button-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-semibold disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Reply className="h-4 w-4" aria-hidden="true" />}{sending ? "Sending…" : "Send reply"}</button></div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

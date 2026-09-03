import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  Inbox,
  Loader2,
  MailOpen,
  Paperclip,
  PenLine,
  RefreshCw,
  Reply,
  Search,
  Send,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/features/auth/use-auth";
import { useTheme } from "@/hooks/use-preferences";
import { getSupabaseClient } from "@/lib/supabase";

type Mailbox = "support" | "security" | "hello" | "test";
type FolderView = "inbox" | "starred" | "sent" | "drafts" | "archive" | "trash" | "all";
type AccessState = "checking" | "authorized" | "denied";
type AttachmentMeta = { id?: string | null; filename?: string | null; size?: number | null; content_type?: string | null };
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
type ThreadState = {
  thread_id: string;
  folder: "inbox" | "archive" | "trash";
  is_read: boolean;
  starred: boolean;
  labels: string[];
  snoozed_until?: string | null;
  trashed_at?: string | null;
  updated_at?: string;
};
type Draft = {
  id: string;
  mailbox: string;
  thread_id: string | null;
  recipient: string | null;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
};
type ComposeDraft = { recipient: string; subject: string; text: string };
type MailResult = { messages?: MailMessage[]; ok?: boolean; id?: string; threadId?: string; downloadUrl?: string; error?: string };
type OrgResult = { states?: ThreadState[]; drafts?: Draft[]; state?: ThreadState; draft?: Draft; ok?: boolean; error?: string };

export const Route = createFileRoute("/mail")({
  head: () => ({
    meta: [
      { title: "Gapwise Mail" },
      { name: "robots", content: "noindex,nofollow,noarchive,nosnippet" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: MailPage,
});

async function invoke(name: "mail-operator" | "mail-organizer", body: Record<string, unknown>) {
  const client = getSupabaseClient();
  if (!client) throw new Error("cloud_unavailable");
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) throw error;
  return data ?? {};
}

const invokeMail = (body: Record<string, unknown>) => invoke("mail-operator", body) as Promise<MailResult>;
const invokeOrg = (body: Record<string, unknown>) => invoke("mail-organizer", body) as Promise<OrgResult>;

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatTime(value: string | null | undefined) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : "Unknown time";
}
function formatInboxTime(value: string | null | undefined) {
  const date = toDate(value);
  if (!date) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat(undefined, date.getFullYear() === now.getFullYear() ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" }).format(date);
}
function formatBytes(value: number | null | undefined) {
  if (!value || value < 1) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
function cleanBody(value: string | null) {
  if (!value) return "";
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^On .+ wrote:\s*$/iu.test(trimmed) || /^-{2,}\s*Original Message\s*-{2,}$/iu.test(trimmed)) break;
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
  return name || bareAddress(value).split("@")[0] || bareAddress(value);
}
function initial(value: string | null | undefined) {
  return displayName(value).slice(0, 1).toUpperCase() || "?";
}
function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
}
function replyAddress(mailbox: Mailbox) {
  if (mailbox === "security") return "security@gapwise.ca";
  if (mailbox === "hello") return "hello@gapwise.ca";
  return "support@gapwise.ca";
}
function defaultState(threadId: string): ThreadState {
  return { thread_id: threadId, folder: "inbox", is_read: false, starred: false, labels: [] };
}
function deliveryLabel(message: MailMessage) {
  if (message.direction === "inbound") return null;
  const event = message.latest_event_type.toLowerCase();
  if (event.includes("fail") || event.includes("bounce") || event.includes("suppress")) return { label: "Delivery issue", bad: true };
  if (event.includes("deliver")) return { label: "Delivered", bad: false };
  if (event.includes("sent")) return { label: "Sent", bad: false };
  return { label: "Sending", bad: false };
}

function HiddenRoute() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <section className="max-w-md text-center">
        <p className="eyebrow text-muted-foreground">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">The page you requested does not exist.</p>
        <Link to="/" className="button-secondary mt-6 inline-flex min-h-11 items-center px-5 text-sm font-semibold">Back to Gapwise</Link>
      </section>
    </main>
  );
}

function MailPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [access, setAccess] = useState<AccessState>("checking");
  const [mailbox, setMailbox] = useState<Mailbox>("support");
  const [view, setView] = useState<FolderView>("inbox");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [states, setStates] = useState<Record<string, ThreadState>>({});
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [thread, setThread] = useState<MailMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replyDraftId, setReplyDraftId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [compose, setCompose] = useState<ComposeDraft>({ recipient: "", subject: "", text: "" });
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return setAccess("denied");
    let alive = true;
    Promise.all([invokeMail({ action: "authorize" }), invokeOrg({ action: "authorize" })])
      .then(([mail, org]) => { if (alive) setAccess(mail.ok && org.ok ? "authorized" : "denied"); })
      .catch(() => { if (alive) setAccess("denied"); });
    return () => { alive = false; };
  }, [authLoading, user]);

  const loadAll = useCallback(async (silent = false) => {
    if (access !== "authorized") return;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const [mail, org, draftResult] = await Promise.all([
        invokeMail({ action: "list", mailbox }),
        invokeOrg({ action: "states" }),
        invokeOrg({ action: "drafts", mailbox }),
      ]);
      setMessages(mail.messages ?? []);
      setStates(Object.fromEntries((org.states ?? []).map((state) => [state.thread_id, state])));
      setDrafts(draftResult.drafts ?? []);
    } catch {
      if (!silent) setError("Mail could not be loaded. Your private message data was not exposed.");
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
    void loadAll();
    const timer = window.setInterval(() => {
      void loadAll(true);
      if (selected?.thread_id) void refreshThread(selected.thread_id, true);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [access, loadAll, refreshThread, selected?.thread_id]);

  const conversations = useMemo(() => {
    const latest = new Map<string, MailMessage>();
    for (const message of messages) if (!latest.has(message.thread_id)) latest.set(message.thread_id, message);
    return [...latest.values()];
  }, [messages]);
  const hasSent = useMemo(() => new Set(messages.filter((m) => m.direction === "outbound").map((m) => m.thread_id)), [messages]);
  const labels = useMemo(() => [...new Set(Object.values(states).flatMap((state) => state.labels ?? []))].sort(), [states]);
  const stateOf = useCallback((threadId: string) => states[threadId] ?? defaultState(threadId), [states]);

  const visibleConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return conversations.filter((message) => {
      const state = stateOf(message.thread_id);
      if (labelFilter && !state.labels.includes(labelFilter)) return false;
      if (view === "inbox" && state.folder !== "inbox") return false;
      if (view === "archive" && state.folder !== "archive") return false;
      if (view === "trash" && state.folder !== "trash") return false;
      if (view === "starred" && (!state.starred || state.folder === "trash")) return false;
      if (view === "sent" && (!hasSent.has(message.thread_id) || state.folder === "trash")) return false;
      if (view === "all" && state.folder === "trash") return false;
      if (view === "drafts") return false;
      if (!normalized) return true;
      const text = [message.subject, message.from_address, message.to_addresses.join(" "), cleanBody(message.text_body), state.labels.join(" ")].filter(Boolean).join(" ").toLowerCase();
      return text.includes(normalized);
    });
  }, [conversations, hasSent, labelFilter, query, stateOf, view]);

  const counts = useMemo(() => {
    let inbox = 0, unread = 0, archive = 0, trash = 0, starred = 0;
    for (const message of conversations) {
      const state = stateOf(message.thread_id);
      if (state.folder === "inbox") { inbox += 1; if (!state.is_read) unread += 1; }
      if (state.folder === "archive") archive += 1;
      if (state.folder === "trash") trash += 1;
      if (state.starred && state.folder !== "trash") starred += 1;
    }
    return { inbox, unread, archive, trash, starred, sent: hasSent.size, drafts: drafts.length, all: conversations.length - trash };
  }, [conversations, drafts.length, hasSent.size, stateOf]);

  const updateState = useCallback(async (threadId: string, patch: Partial<Pick<ThreadState, "folder" | "is_read" | "starred" | "labels">>) => {
    const current = stateOf(threadId);
    const optimistic = { ...current, ...patch, updated_at: new Date().toISOString() };
    setStates((value) => ({ ...value, [threadId]: optimistic }));
    try {
      const result = await invokeOrg({ action: "update_state", threadId, folder: patch.folder, isRead: patch.is_read, starred: patch.starred, labels: patch.labels });
      if (result.state) setStates((value) => ({ ...value, [threadId]: result.state! }));
    } catch {
      setStates((value) => ({ ...value, [threadId]: current }));
      setError("That mailbox change could not be saved.");
    }
  }, [stateOf]);

  const openMessage = useCallback(async (message: MailMessage) => {
    setComposing(false);
    setSelected(message);
    setError(null);
    setThreadLoading(true);
    const draft = drafts.find((item) => item.thread_id === message.thread_id) ?? null;
    setReplyDraftId(draft?.id ?? null);
    setReplyText(draft?.body ?? "");
    if (!stateOf(message.thread_id).is_read) void updateState(message.thread_id, { is_read: true });
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
  }, [drafts, stateOf, updateState]);

  useEffect(() => {
    if (!selected || !replyText.trim()) return;
    const timer = window.setTimeout(async () => {
      try {
        const result = await invokeOrg({ action: "save_draft", draftId: replyDraftId, mailbox, threadId: selected.thread_id, recipient: null, subject: selected.subject ?? "", text: replyText });
        if (result.draft) {
          setReplyDraftId(result.draft.id);
          setDrafts((items) => [result.draft!, ...items.filter((item) => item.id !== result.draft!.id && item.thread_id !== selected.thread_id)]);
        }
      } catch { /* keep draft in editor */ }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [mailbox, replyDraftId, replyText, selected]);

  useEffect(() => {
    if (!composing || !(compose.recipient.trim() || compose.subject.trim() || compose.text.trim())) return;
    const timer = window.setTimeout(async () => {
      try {
        const result = await invokeOrg({ action: "save_draft", draftId: composeDraftId, mailbox, recipient: compose.recipient, subject: compose.subject, text: compose.text });
        if (result.draft) {
          setComposeDraftId(result.draft.id);
          setDrafts((items) => [result.draft!, ...items.filter((item) => item.id !== result.draft!.id)]);
        }
      } catch { /* editor retains unsaved text */ }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [compose, composeDraftId, composing, mailbox]);

  useEffect(() => {
    if (thread.length) window.requestAnimationFrame(() => threadEndRef.current?.scrollIntoView({ block: "end" }));
  }, [selected?.thread_id, thread.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault(); searchRef.current?.focus();
      }
      if (event.key === "Escape" && !(event.target instanceof HTMLTextAreaElement)) {
        setSelected(null); setThread([]); setComposing(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const deleteDraft = useCallback(async (id: string | null) => {
    if (!id) return;
    try { await invokeOrg({ action: "delete_draft", draftId: id }); } catch { return; }
    setDrafts((items) => items.filter((item) => item.id !== id));
  }, []);

  const replyTarget = useMemo(() => [...thread].reverse().find((item) => item.direction === "inbound") ?? selected, [selected, thread]);
  const sendReply = useCallback(async () => {
    if (!replyTarget || !replyText.trim() || sending) return;
    setSending(true); setError(null);
    try {
      await invokeMail({ action: "reply", messageId: replyTarget.resend_email_id, text: replyText.trim(), requestId: crypto.randomUUID() });
      await deleteDraft(replyDraftId);
      setReplyDraftId(null); setReplyText("");
      await updateState(replyTarget.thread_id, { is_read: true, folder: "inbox" });
      await refreshThread(replyTarget.thread_id, true); await loadAll(true);
    } catch { setError("The reply was not sent. Your draft is still saved."); }
    finally { setSending(false); }
  }, [deleteDraft, loadAll, refreshThread, replyDraftId, replyTarget, replyText, sending, updateState]);

  const sendNew = useCallback(async () => {
    if (sending || !validEmail(compose.recipient) || !compose.subject.trim() || !compose.text.trim()) return;
    setSending(true); setError(null);
    try {
      const result = await invokeMail({ action: "send", mailbox, recipient: compose.recipient.trim(), subject: compose.subject.trim(), text: compose.text.trim(), requestId: crypto.randomUUID() });
      await deleteDraft(composeDraftId);
      setComposeDraftId(null); setCompose({ recipient: "", subject: "", text: "" }); setComposing(false);
      if (result.threadId) await updateState(result.threadId, { is_read: true, folder: "inbox" });
      await loadAll(true);
    } catch { setError("The message was not sent. Your draft is still saved."); }
    finally { setSending(false); }
  }, [compose, composeDraftId, deleteDraft, loadAll, mailbox, sending, updateState]);

  const downloadAttachment = useCallback(async (message: MailMessage, attachment: AttachmentMeta) => {
    if (!attachment.id || attachmentLoading) return;
    setAttachmentLoading(attachment.id);
    try {
      const result = await invokeMail({ action: "attachment", messageId: message.resend_email_id, attachmentId: attachment.id });
      if (!result.downloadUrl) throw new Error("missing_url");
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch { setError("The attachment could not be opened securely. Try again."); }
    finally { setAttachmentLoading(null); }
  }, [attachmentLoading]);

  const openDraft = useCallback(async (draft: Draft) => {
    if (draft.thread_id) {
      const message = conversations.find((item) => item.thread_id === draft.thread_id);
      if (message) { await openMessage(message); setReplyDraftId(draft.id); setReplyText(draft.body); return; }
    }
    setSelected(null); setThread([]); setView("drafts"); setComposing(true); setComposeDraftId(draft.id);
    setCompose({ recipient: draft.recipient ?? "", subject: draft.subject, text: draft.body });
  }, [conversations, openMessage]);

  const addLabel = useCallback(() => {
    if (!selected) return;
    const name = window.prompt("Label this conversation");
    if (!name?.trim()) return;
    const state = stateOf(selected.thread_id);
    void updateState(selected.thread_id, { labels: [...new Set([...state.labels, name.trim().slice(0, 40)])] });
  }, [selected, stateOf, updateState]);

  const deleteForever = useCallback(async (threadId: string) => {
    if (!window.confirm("Permanently delete this conversation? This cannot be undone.")) return;
    try {
      await invokeOrg({ action: "delete_forever", threadId });
      setSelected(null); setThread([]); await loadAll(true);
    } catch { setError("The conversation could not be permanently deleted."); }
  }, [loadAll]);

  const emptyTrash = useCallback(async () => {
    if (!window.confirm("Permanently delete every conversation in Trash? This cannot be undone.")) return;
    try { await invokeOrg({ action: "empty_trash" }); setSelected(null); setThread([]); await loadAll(true); }
    catch { setError("Trash could not be emptied."); }
  }, [loadAll]);

  if (authLoading || access === "checking") return <main className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>;
  if (access !== "authorized") return <HiddenRoute />;

  const selectedState = selected ? stateOf(selected.thread_id) : null;
  const participant = selected ? (selected.direction === "inbound" ? selected.from_address : selected.to_addresses[0]) : null;
  const folderItems: Array<{ id: FolderView; label: string; icon: typeof Inbox; count?: number }> = [
    { id: "inbox", label: "Inbox", icon: Inbox, count: counts.unread || counts.inbox },
    { id: "starred", label: "Starred", icon: Star, count: counts.starred },
    { id: "sent", label: "Sent", icon: Send, count: counts.sent },
    { id: "drafts", label: "Drafts", icon: FileText, count: counts.drafts },
    { id: "all", label: "All mail", icon: MailOpen, count: counts.all },
    { id: "archive", label: "Archive", icon: Archive, count: counts.archive },
    { id: "trash", label: "Trash", icon: Trash2, count: counts.trash },
  ];

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <header className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to Gapwise</Link>
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-accent/20 bg-accent/8"><ShieldCheck className="h-5 w-5 text-accent" /></span><div><p className="eyebrow text-accent">Private operator console</p><h1 className="font-display text-2xl font-semibold">Mail</h1></div></div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto"><ThemeToggle theme={theme} onToggle={toggleTheme} /><button type="button" onClick={() => void loadAll()} className="button-secondary inline-flex min-h-10 items-center gap-2 px-4 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["support", "security", "hello", "test"] as const).map((name) => <button key={name} type="button" onClick={() => { setMailbox(name); setSelected(null); setThread([]); setComposing(false); setView("inbox"); setLabelFilter(null); }} className={mailbox === name ? "button-primary min-h-10 px-4 text-sm font-semibold capitalize" : "button-secondary min-h-10 px-4 text-sm font-semibold capitalize"}>{name}</button>)}
          <button type="button" onClick={() => { setSelected(null); setThread([]); setComposing(true); setCompose({ recipient: "", subject: "", text: "" }); setComposeDraftId(null); }} className="button-secondary ml-auto inline-flex min-h-10 items-center gap-2 px-4 text-sm font-semibold"><PenLine className="h-4 w-4" />Compose</button>
        </div>
        {error ? <div className="mb-3 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}

        <div className="grid min-h-[78vh] overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm lg:grid-cols-[210px_380px_1fr]">
          <nav className={`${selected || composing ? "hidden lg:block" : "block"} border-r border-border/70 p-3`} aria-label="Mail folders">
            <button type="button" onClick={() => { setComposing(true); setSelected(null); setComposeDraftId(null); setCompose({ recipient: "", subject: "", text: "" }); }} className="button-primary mb-3 inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold"><PenLine className="h-4 w-4" />New message</button>
            <div className="space-y-1">{folderItems.map((item) => { const Icon = item.icon; const active = view === item.id && !labelFilter; return <button key={item.id} type="button" onClick={() => { setView(item.id); setLabelFilter(null); setSelected(null); setThread([]); setComposing(false); }} className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition ${active ? "bg-accent/10 font-semibold text-accent" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}><Icon className="h-4 w-4" /><span className="flex-1">{item.label}</span>{item.count ? <span className="text-xs">{item.count}</span> : null}</button>; })}</div>
            {labels.length ? <div className="mt-5 border-t border-border/60 pt-4"><p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Labels</p>{labels.map((label) => <button key={label} type="button" onClick={() => { setLabelFilter(label); setView("all"); setSelected(null); setThread([]); setComposing(false); }} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm ${labelFilter === label ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted/60"}`}><Tag className="h-3.5 w-3.5" /><span className="truncate">{label}</span></button>)}</div> : null}
          </nav>

          <aside className={`${selected || composing ? "hidden lg:block" : "block"} border-r border-border/70`}>
            <div className="border-b border-border/70 p-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-10 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" /></div></div>
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><span className="text-sm font-semibold">{labelFilter ?? folderItems.find((item) => item.id === view)?.label}</span>{view === "trash" && counts.trash ? <button type="button" onClick={() => void emptyTrash()} className="text-xs font-medium text-destructive hover:underline">Empty trash</button> : <span className="text-xs text-muted-foreground">{view === "drafts" ? drafts.length : visibleConversations.length}</span>}</div>
            <div className="max-h-[calc(78vh-105px)] overflow-y-auto">
              {loading ? <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div> : null}
              {view === "drafts" ? drafts.map((draft) => <button key={draft.id} type="button" onClick={() => void openDraft(draft)} className="w-full border-b border-border/60 px-4 py-4 text-left hover:bg-accent/5"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">Draft{draft.recipient ? ` · ${draft.recipient}` : ""}</span><span className="text-[11px] text-muted-foreground">{formatInboxTime(draft.updated_at)}</span></div><p className="mt-1 truncate text-sm font-medium">{draft.subject || "(no subject)"}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{draft.body || "Empty draft"}</p></button>) : visibleConversations.map((message) => {
                const state = stateOf(message.thread_id); const active = selected?.thread_id === message.thread_id; const who = message.direction === "inbound" ? message.from_address : message.to_addresses[0]; const delivery = deliveryLabel(message);
                return <button key={message.thread_id} type="button" onClick={() => void openMessage(message)} className={`group w-full border-b border-border/60 px-4 py-4 text-left transition hover:bg-accent/5 ${active ? "bg-accent/8" : ""}`}><div className="flex gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initial(who)}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`truncate text-sm ${state.is_read ? "font-medium" : "font-bold"}`}>{displayName(who)}</span><button type="button" aria-label={state.starred ? "Unstar" : "Star"} onClick={(e) => { e.stopPropagation(); void updateState(message.thread_id, { starred: !state.starred }); }} className={`ml-auto shrink-0 ${state.starred ? "text-amber-500" : "text-muted-foreground/50 hover:text-foreground"}`}><Star className={`h-4 w-4 ${state.starred ? "fill-current" : ""}`} /></button><span className="shrink-0 text-[11px] text-muted-foreground">{formatInboxTime(message.event_created_at ?? message.updated_at)}</span></div><p className={`mt-0.5 truncate text-sm ${state.is_read ? "font-normal" : "font-semibold"}`}>{message.subject || "(no subject)"}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{cleanBody(message.text_body) || "No preview"}</p><div className="mt-2 flex flex-wrap items-center gap-1.5">{state.labels.map((label) => <span key={label} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{label}</span>)}{message.attachment_metadata?.length ? <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3" />{message.attachment_metadata.length}</span> : null}{delivery ? <span className={`text-[11px] ${delivery.bad ? "text-destructive" : "text-muted-foreground"}`}>{delivery.label}</span> : null}</div></div></div></button>;
              })}
              {!loading && view === "drafts" && !drafts.length ? <p className="p-6 text-sm text-muted-foreground">No saved drafts.</p> : null}
              {!loading && view !== "drafts" && !visibleConversations.length ? <p className="p-6 text-sm text-muted-foreground">No conversations here.</p> : null}
            </div>
          </aside>

          <section className={`${selected || composing ? "block" : "hidden lg:block"} min-w-0`}>
            {composing ? <div className="flex h-full max-h-[78vh] flex-col"><div className="flex items-center gap-3 border-b border-border/70 px-4 py-4"><button type="button" onClick={() => setComposing(false)} className="button-secondary inline-flex h-9 w-9 items-center justify-center lg:hidden"><ChevronLeft className="h-4 w-4" /></button><div className="flex-1"><h2 className="font-display text-xl font-semibold">New message</h2><p className="mt-1 text-xs text-muted-foreground">From {replyAddress(mailbox)} · server-side draft</p></div><button type="button" onClick={() => setComposing(false)} className="button-secondary hidden h-9 w-9 items-center justify-center lg:inline-flex"><X className="h-4 w-4" /></button></div><div className="flex-1 overflow-y-auto bg-background/30 p-4 sm:p-6"><div className="mx-auto max-w-3xl rounded-2xl border border-border/70 bg-card p-5 shadow-sm"><label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To</label><input type="email" value={compose.recipient} onChange={(e) => setCompose((v) => ({ ...v, recipient: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent" placeholder="recipient@example.com" /><label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</label><input value={compose.subject} onChange={(e) => setCompose((v) => ({ ...v, subject: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent" placeholder="Subject" /><label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</label><textarea value={compose.text} onChange={(e) => setCompose((v) => ({ ...v, text: e.target.value }))} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void sendNew(); } }} rows={13} className="mt-2 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-[15px] leading-7 outline-none focus:border-accent" placeholder="Write your message…" /><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Drafts sync privately to your operator mailbox.</p><button type="button" disabled={!validEmail(compose.recipient) || !compose.subject.trim() || !compose.text.trim() || sending} onClick={() => void sendNew()} className="button-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-semibold disabled:opacity-50"><Send className="h-4 w-4" />{sending ? "Sending…" : "Send"}</button></div></div></div></div> : !selected ? <div className="grid h-full min-h-[540px] place-items-center p-8 text-center"><div><Inbox className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 font-display text-xl font-semibold">Your Gapwise mailbox</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Read, search, organize, label, archive, draft, compose and manage Gapwise correspondence here.</p></div></div> : <div className="flex h-full max-h-[78vh] flex-col">
              <div className="flex items-start gap-3 border-b border-border/70 px-4 py-3"><button type="button" onClick={() => { setSelected(null); setThread([]); }} className="button-secondary inline-flex h-9 w-9 items-center justify-center lg:hidden"><ChevronLeft className="h-4 w-4" /></button><div className="min-w-0 flex-1"><h2 className="truncate font-display text-xl font-semibold">{selected.subject || "(no subject)"}</h2><p className="mt-1 truncate text-xs text-muted-foreground">{participant ? `${displayName(participant)} · ${bareAddress(participant)}` : "Conversation"}</p></div><div className="flex items-center gap-1"><button type="button" title={selectedState?.starred ? "Unstar" : "Star"} onClick={() => void updateState(selected.thread_id, { starred: !selectedState?.starred })} className="button-secondary inline-flex h-9 w-9 items-center justify-center"><Star className={`h-4 w-4 ${selectedState?.starred ? "fill-current text-amber-500" : ""}`} /></button><button type="button" title="Add label" onClick={addLabel} className="button-secondary inline-flex h-9 w-9 items-center justify-center"><Tag className="h-4 w-4" /></button>{selectedState?.folder === "trash" ? <><button type="button" title="Restore" onClick={() => void updateState(selected.thread_id, { folder: "inbox" })} className="button-secondary inline-flex h-9 items-center gap-2 px-3 text-xs"><Inbox className="h-4 w-4" />Restore</button><button type="button" title="Delete forever" onClick={() => void deleteForever(selected.thread_id)} className="button-secondary inline-flex h-9 w-9 items-center justify-center text-destructive"><Trash2 className="h-4 w-4" /></button></> : <><button type="button" title="Archive" onClick={() => void updateState(selected.thread_id, { folder: "archive" })} className="button-secondary inline-flex h-9 w-9 items-center justify-center"><Archive className="h-4 w-4" /></button><button type="button" title="Move to trash" onClick={() => void updateState(selected.thread_id, { folder: "trash" })} className="button-secondary inline-flex h-9 w-9 items-center justify-center"><Trash2 className="h-4 w-4" /></button></>}<button type="button" title={selectedState?.is_read ? "Mark unread" : "Mark read"} onClick={() => void updateState(selected.thread_id, { is_read: !selectedState?.is_read })} className="button-secondary inline-flex h-9 w-9 items-center justify-center"><MailOpen className="h-4 w-4" /></button></div></div>
              {selectedState?.labels.length ? <div className="flex flex-wrap gap-2 border-b border-border/60 px-5 py-2">{selectedState.labels.map((label) => <span key={label} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{label}<button type="button" onClick={() => void updateState(selected.thread_id, { labels: selectedState.labels.filter((item) => item !== label) })} aria-label={`Remove ${label}`}><X className="h-3 w-3" /></button></span>)}</div> : null}
              <div className="flex-1 space-y-5 overflow-y-auto bg-background/30 p-4 sm:p-5">{threadLoading ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : null}{thread.map((message) => { const body = cleanBody(message.text_body) || "(No plain-text body)"; const sender = message.direction === "inbound" ? message.from_address : message.from_address ?? "Gapwise"; const delivery = deliveryLabel(message); return <article key={message.resend_email_id} className={`max-w-3xl rounded-2xl border p-4 shadow-sm sm:p-5 ${message.direction === "outbound" ? "ml-auto border-accent/20 bg-accent/6" : "border-border/70 bg-card"}`}><div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${message.direction === "outbound" ? "bg-accent/12 text-accent" : "bg-muted text-muted-foreground"}`}>{initial(sender)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{displayName(sender)}</p><p className="text-xs text-muted-foreground">{bareAddress(sender)}</p></div><span className="text-xs text-muted-foreground">{formatTime(message.event_created_at ?? message.updated_at)}</span></div><p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7">{body}</p>{message.attachment_metadata?.length ? <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">{message.attachment_metadata.map((attachment, index) => { const size = formatBytes(attachment.size); return message.direction === "inbound" && attachment.id ? <button key={attachment.id} type="button" onClick={() => void downloadAttachment(message, attachment)} className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-xs"><Download className="h-3.5 w-3.5" />{attachment.filename || "attachment"}{size ? <span className="text-muted-foreground">{size}</span> : null}</button> : <span key={index} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs"><Paperclip className="h-3.5 w-3.5" />{attachment.filename || "attachment"}</span>; })}</div> : null}{delivery ? <div className={`mt-3 inline-flex items-center gap-1.5 text-xs ${delivery.bad ? "text-destructive" : "text-muted-foreground"}`}><CheckCircle2 className="h-3.5 w-3.5" />{delivery.label}</div> : null}</div></div></article>; })}<div ref={threadEndRef} /></div>
              {selectedState?.folder !== "trash" ? <div className="border-t border-border/70 bg-card/90 p-3 sm:p-4"><div className="mb-2 flex items-center justify-between"><label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reply as {replyAddress(mailbox)}</label><span className="text-[11px] text-muted-foreground">Draft saved privately</span></div><textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void sendReply(); } }} rows={5} className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-[15px] leading-7 outline-none focus:border-accent" placeholder="Write a reply…" /><div className="mt-3 flex justify-end"><button type="button" disabled={!replyText.trim() || sending} onClick={() => void sendReply()} className="button-primary inline-flex min-h-11 items-center gap-2 px-5 text-sm font-semibold disabled:opacity-50"><Reply className="h-4 w-4" />{sending ? "Sending…" : "Send reply"}</button></div></div> : null}
            </div>}
          </section>
        </div>
      </div>
    </main>
  );
}

import type { User } from "@supabase/supabase-js";
import {
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Unlink,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Term } from "@/lib/timetable-types";
import {
  createFriendInvite,
  defaultFriendDisplayName,
  disableFriendInvite,
  FriendOverlapRateLimitError,
  loadFriendConnections,
  loadFriendGapOverlaps,
  loadOwnFriendProfile,
  respondToFriendRequest,
  revokeFriendship,
  saveFriendProfile,
  submitFriendInviteCode,
} from "./friend-service";
import type { FriendConnection, FriendGapOverlap, FriendInvite } from "./types";

function friendFailureMessage(error: unknown) {
  return error instanceof FriendOverlapRateLimitError
    ? "Friend overlaps were refreshed too often. Try again after the one-hour window resets."
    : "That friend action could not be completed. Try again shortly.";
}

export function FriendOverlapPanel({
  user,
  term,
  onOverlapsChange,
}: {
  user: User | null;
  term: Term;
  onOverlapsChange: (overlaps: FriendGapOverlap[]) => void;
}) {
  const userId = user?.id ?? null;
  const fallbackDisplayName = user ? defaultFriendDisplayName(user) : "Gapwise friend";
  const [connections, setConnections] = useState<FriendConnection[]>([]);
  const [displayName, setDisplayName] = useState(() => fallbackDisplayName);
  const [invite, setInvite] = useState<FriendInvite | null>(null);
  const [submittedCode, setSubmittedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const displayNameDirty = useRef(false);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const overlapCache = useRef(new Map<Term, FriendGapOverlap[]>());
  const overlapRequests = useRef(new Map<Term, Promise<FriendGapOverlap[]>>());

  const refresh = useCallback(
    async (forceOverlap = false) => {
      const version = ++requestVersion.current;
      if (forceOverlap) overlapCache.current.delete(term);
      if (!userId) {
        setConnections([]);
        onOverlapsChange([]);
        return;
      }
      setLoading(true);
      try {
        const cachedOverlaps = forceOverlap ? undefined : overlapCache.current.get(term);
        let overlapRequest =
          cachedOverlaps === undefined && !forceOverlap
            ? overlapRequests.current.get(term)
            : undefined;
        if (cachedOverlaps === undefined && !overlapRequest) {
          overlapRequest = loadFriendGapOverlaps(term);
          overlapRequests.current.set(term, overlapRequest);
          const clearRequest = () => {
            if (overlapRequests.current.get(term) === overlapRequest) {
              overlapRequests.current.delete(term);
            }
          };
          void overlapRequest.then(clearRequest, clearRequest);
        }
        const [profile, nextConnections, overlaps] = await Promise.all([
          loadOwnFriendProfile(userId),
          loadFriendConnections(),
          cachedOverlaps ?? overlapRequest!,
        ]);
        if (!mounted.current || version !== requestVersion.current) return;
        overlapCache.current.set(term, overlaps);
        if (!displayNameDirty.current) setDisplayName(profile ?? fallbackDisplayName);
        setConnections(nextConnections);
        onOverlapsChange(overlaps);
      } catch (error) {
        if (!mounted.current || version !== requestVersion.current) throw error;
        overlapCache.current.delete(term);
        setMessage(friendFailureMessage(error));
        onOverlapsChange([]);
        throw error;
      } finally {
        if (mounted.current && version === requestVersion.current) setLoading(false);
      }
    },
    [fallbackDisplayName, onOverlapsChange, term, userId],
  );

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    displayNameDirty.current = false;
    setDisplayName(fallbackDisplayName);
  }, [fallbackDisplayName, userId]);

  async function persistDisplayName() {
    if (!userId) return;
    const saved = await saveFriendProfile(userId, displayName);
    displayNameDirty.current = false;
    setDisplayName(saved);
  }

  async function run(action: () => Promise<void>, success: string, refreshAfter = true) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (refreshAfter) {
        overlapCache.current.clear();
        await refresh(true);
      }
      setMessage(success);
    } catch (error) {
      setMessage(friendFailureMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteCode(code: string) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable.");
      await navigator.clipboard.writeText(code);
      setMessage("Private code copied.");
    } catch {
      setMessage("The private code could not be copied. Select and copy it manually.");
    }
  }

  if (!user) {
    return (
      <section className="surface p-4 sm:p-5" aria-labelledby="friend-overlap-title">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h3 id="friend-overlap-title" className="text-sm font-semibold">
              Mutual friend gaps
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Sign in and explicitly sync a timetable to compare a few rounded free windows with
              friends who have accepted your request. Guest timetables remain local.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const incoming = connections.filter(
    (connection) => connection.status === "pending" && connection.direction === "incoming",
  );
  const outgoing = connections.filter(
    (connection) => connection.status === "pending" && connection.direction === "outgoing",
  );
  const friends = connections.filter((connection) => connection.status === "accepted");

  return (
    <section className="surface p-4 sm:p-5" aria-labelledby="friend-overlap-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h3 id="friend-overlap-title" className="text-sm font-semibold">
              Mutual friend gaps
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Friends receive at most three 30-minute-rounded windows in {term} when both of you are
              free. They cannot fetch your meetings, rooms, course details, full timetable, or
              non-overlapping gaps.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void refresh(true).catch(() => undefined)}
          className="button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      <div className="friend-connection-grid mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-secondary/25 p-4">
          <label className="block text-xs font-semibold" htmlFor="friend-display-name">
            Name shown only to connections
          </label>
          <div className="friend-field-row mt-2 flex gap-2">
            <input
              id="friend-display-name"
              value={displayName}
              maxLength={80}
              onChange={(event) => {
                displayNameDirty.current = true;
                setDisplayName(event.target.value);
              }}
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(persistDisplayName, "Connection name saved.", false)}
              className="button-secondary px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Save
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  async () => {
                    await persistDisplayName();
                    setInvite(await createFriendInvite());
                  },
                  "A new private code is ready. Any older code is now disabled.",
                  false,
                )
              }
              className="button-primary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Generate private code
            </button>
            {invite ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    async () => {
                      await disableFriendInvite();
                      setInvite(null);
                    },
                    "The private code was disabled.",
                    false,
                  )
                }
                className="button-secondary px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Disable code
              </button>
            ) : null}
          </div>

          {invite ? (
            <div className="mt-3 rounded-lg border border-accent/25 bg-background/70 p-3">
              <p className="font-mono text-xs font-semibold break-all">{invite.code}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.7rem] text-muted-foreground">
                  Expires {new Date(invite.expiresAt).toLocaleString()}. Single use.
                </p>
                <button
                  type="button"
                  onClick={() => void copyInviteCode(invite.code)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <form
          className="rounded-xl border border-border bg-secondary/25 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!submittedCode.trim()) return;
            void run(async () => {
              await persistDisplayName();
              await submitFriendInviteCode(submittedCode);
              setSubmittedCode("");
            }, "Request submitted if that private code is valid.");
          }}
        >
          <label className="text-xs font-semibold" htmlFor="friend-private-code">
            Connect by private code
          </label>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-foreground">
            There is no user or email search. Valid, expired, used, and unknown codes all receive
            the same response, and no authentication email is sent.
          </p>
          <div className="friend-field-row mt-3 flex gap-2">
            <input
              id="friend-private-code"
              value={submittedCode}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              aria-label="Private friend code"
              onChange={(event) => setSubmittedCode(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs"
            />
            <button
              type="submit"
              disabled={busy || !submittedCode.trim()}
              className="button-primary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Send request
            </button>
          </div>
        </form>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ConnectionGroup title="Incoming" empty="No requests to review.">
          {incoming.map((connection) => (
            <ConnectionRow key={connection.id} connection={connection}>
              <button
                type="button"
                disabled={busy}
                aria-label={`Accept ${connection.displayName}`}
                onClick={() =>
                  void run(
                    () => respondToFriendRequest(connection.id, true),
                    `${connection.displayName} is now a mutual friend.`,
                  )
                }
                className="rounded-lg border border-accent/30 p-1.5 text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={`Decline ${connection.displayName}`}
                onClick={() =>
                  void run(
                    () => respondToFriendRequest(connection.id, false),
                    "Request declined. No overlap was shared.",
                  )
                }
                className="rounded-lg border border-input p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </ConnectionRow>
          ))}
        </ConnectionGroup>

        <ConnectionGroup title="Sent" empty="No pending requests.">
          {outgoing.map((connection) => (
            <ConnectionRow key={connection.id} connection={connection} detail="Waiting for them">
              <RemoveButton
                label={`Cancel request to ${connection.displayName}`}
                busy={busy}
                onClick={() =>
                  void run(
                    () => revokeFriendship(connection.id),
                    "Request canceled. No overlap was shared.",
                  )
                }
              />
            </ConnectionRow>
          ))}
        </ConnectionGroup>

        <ConnectionGroup title="Friends" empty="No mutual friends yet.">
          {friends.map((connection) => (
            <ConnectionRow key={connection.id} connection={connection} detail="Mutually accepted">
              <RemoveButton
                label={`Remove ${connection.displayName}`}
                busy={busy}
                onClick={() =>
                  void run(
                    () => revokeFriendship(connection.id),
                    `${connection.displayName} was removed. Overlap access ended immediately.`,
                  )
                }
              />
            </ConnectionRow>
          ))}
        </ConnectionGroup>
      </div>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-3 min-h-4 text-xs text-muted-foreground"
      >
        {message}
      </p>
    </section>
  );
}

function ConnectionGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const childCount = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <div className="rounded-xl border border-border p-3">
      <h4 className="text-xs font-semibold">{title}</h4>
      {childCount ? (
        <div className="mt-2 space-y-2">{children}</div>
      ) : (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function ConnectionRow({
  connection,
  detail,
  children,
}: {
  connection: FriendConnection;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-2.5 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{connection.displayName}</p>
        {detail ? <p className="text-[0.65rem] text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="flex shrink-0 gap-1.5">{children}</div>
    </div>
  );
}

function RemoveButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-lg border border-input p-1.5 text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
    >
      {label.startsWith("Cancel") ? (
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

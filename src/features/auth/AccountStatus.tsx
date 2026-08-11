import type { User } from "@supabase/supabase-js";
import { ChevronDown, Github, LogOut, Mail, Trash2, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearRememberedTimetable } from "@/hooks/use-preferences";
import { isSupabaseConfigured } from "@/lib/supabase";
import { shouldWritePrivateCloud } from "@/features/security/private-cloud-mode";
import {
  consumeOAuthError,
  deleteAccount,
  getAccountIdentity,
  requestEmailSignInLink,
  signInWithGitHub,
  signOut,
} from "./auth-service";

export function AccountStatus({
  user,
  loading,
  onAccountDeleted,
}: {
  user: User | null;
  loading: boolean;
  onAccountDeleted: (clearLocal: boolean) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearLocal, setClearLocal] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const error = consumeOAuthError(window.location, window.history);
    if (error) setMessage("Sign-in did not complete. Please try again.");
  }, []);

  async function removeAccount() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteAccount();
      if (clearLocal) clearRememberedTimetable();
      onAccountDeleted(clearLocal);
      await signOut().catch(() => undefined);
      setDeleteOpen(false);
      setMessage("Your account and cloud data were permanently deleted.");
    } catch {
      setMessage("We couldn't delete your account. Your session and local data are unchanged.");
    } finally {
      setBusy(false);
    }
  }

  async function leaveAccount() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await signOut();
    } catch {
      setMessage("You're signed out on this device, but the server could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await requestEmailSignInLink(email);
      setEmailSent(true);
      setMessage("Check your email and open the secure sign-in link.");
    } catch {
      setMessage("We couldn't send a sign-in link right now. Please wait and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex items-center gap-2" role="group" aria-label="Account">
      {loading ? (
        <span className="text-sm text-muted-foreground" role="status">
          Checking account…
        </span>
      ) : user ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger className="button-secondary inline-flex min-h-9 max-w-52 items-center gap-2 px-3 text-sm font-medium">
              <UserRound className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="truncate">{getAccountIdentity(user)}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                Account settings
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  You’ll stay signed in on this device until you sign out.
                </span>
              </DropdownMenuLabel>
              <DropdownMenuItem disabled={busy} onSelect={() => void leaveAccount()}>
                <LogOut aria-hidden="true" /> Sign out
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 aria-hidden="true" /> Delete account and cloud data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog open={deleteOpen} onOpenChange={(open) => !busy && setDeleteOpen(open)}>
            <AlertDialogContent className="mx-4 w-[calc(100%-2rem)] rounded-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account and cloud data?</AlertDialogTitle>
                <AlertDialogDescription>
                  {shouldWritePrivateCloud
                    ? "This permanently removes your Supabase account, encrypted cloud private data and availability, private invite codes, and every friend/request entry involving you. Former friends immediately lose access and see no relationship history. Your original .ics file was never uploaded."
                    : "This permanently removes your Supabase account, normalized cloud timetable, saved preferences, private invite codes, and every friend/request entry involving you. Former friends immediately lose access and see no relationship history. Your original .ics file was never uploaded."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={clearLocal}
                  onChange={(event) => setClearLocal(event.target.checked)}
                  disabled={busy}
                  className="h-4 w-4"
                />
                Also clear any legacy remembered timetable from this browser
              </label>
              <p className="text-xs text-muted-foreground">
                {shouldWritePrivateCloud
                  ? "Secure device keys and encrypted local records are always cleared on account deletion. If unchecked, legacy guest data stays available."
                  : "If unchecked, local browser data stays available in guest mode."}
              </p>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Keep account</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    void removeAccount();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {busy ? "Deleting…" : "Permanently delete account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSignInOpen((open) => !open)}
            disabled={!isSupabaseConfigured}
            className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-sm font-medium disabled:opacity-50"
            aria-expanded={signInOpen}
          >
            <UserRound className="h-4 w-4" aria-hidden="true" /> Sign in
          </button>
          {signInOpen ? (
            <section className="glass-panel absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Sign in to sync</h2>
                  <p className="text-xs text-muted-foreground">
                    Guest mode remains available without an account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSignInOpen(false)}
                  className="rounded-md p-2 hover:bg-secondary"
                  aria-label="Close sign-in panel"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  void signInWithGitHub().catch(() =>
                    setMessage("GitHub sign-in failed. Please try again."),
                  )
                }
                disabled={busy}
                className="button-secondary inline-flex min-h-11 w-full items-center justify-center gap-2 px-3 text-sm font-medium disabled:opacity-50"
              >
                <Github className="h-4 w-4" aria-hidden="true" /> Continue with GitHub
              </button>

              <div className="my-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or{" "}
                <span className="h-px flex-1 bg-border" />
              </div>

              {emailSent ? (
                <div className="space-y-3" role="status">
                  <div className="rounded-lg border border-border bg-secondary/50 p-4">
                    <p className="font-medium">Check your email</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Open the secure sign-in link we sent to finish signing in.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEmailSent(false)}
                    className="button-secondary min-h-11 w-full px-3 text-sm font-medium disabled:opacity-50"
                  >
                    Use a different email or resend
                  </button>
                </div>
              ) : (
                <form onSubmit={sendEmailLink} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium" htmlFor="account-email">
                      Email address
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      We’ll email you a secure, single-use sign-in link.
                    </p>
                  </div>
                  <input
                    id="account-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy || !email.trim()}
                    className="button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-3 text-sm font-medium disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    {busy ? "Sending…" : "Email me a sign-in link"}
                  </button>
                </form>
              )}
            </section>
          ) : null}
        </>
      )}
      {message ? (
        <span
          role="status"
          className="glass-panel fixed right-4 top-20 z-[60] max-w-sm rounded-lg px-4 py-3 text-sm"
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}

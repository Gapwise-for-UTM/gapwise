import type { User } from "@supabase/supabase-js";
import { ChevronDown, Github, LogOut, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  consumeOAuthError,
  deleteAccount,
  getAccountIdentity,
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

  useEffect(() => {
    const error = consumeOAuthError(window.location, window.history);
    if (error) setMessage("GitHub sign-in did not complete. Please try again.");
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

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Account">
      {loading ? (
        <span className="text-sm text-muted-foreground" role="status">
          Checking account…
        </span>
      ) : user ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex min-h-11 max-w-52 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary">
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
                  This permanently removes your Supabase account, normalized cloud timetable, saved
                  preferences, and every other server-side record you own. Your original .ics file
                  was never uploaded.
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
                Also clear the remembered timetable from this browser
              </label>
              <p className="text-xs text-muted-foreground">
                If unchecked, local browser data stays available in guest mode.
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
        <button
          type="button"
          onClick={() =>
            void signInWithGitHub().catch(() => setMessage("Sign-in failed. Please try again."))
          }
          disabled={!isSupabaseConfigured}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Github className="h-4 w-4" aria-hidden="true" /> Sign in
        </button>
      )}
      {message ? (
        <span
          role="status"
          className="fixed right-4 top-20 z-50 max-w-sm rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-sm"
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}

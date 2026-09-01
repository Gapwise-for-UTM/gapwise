import type { User } from "@supabase/supabase-js";
import { ChevronDown, GitBranch, LogOut, Settings2, Trash2, UserRound } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBridgedAiDelegationController } from "@/features/ai/controller-bridge";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import { AccountOnboarding } from "@/features/onboarding/AccountOnboarding";
import { clearRememberedTimetable } from "@/hooks/use-preferences";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Meeting, Term } from "@/lib/timetable-types";
import { shouldWritePrivateCloud } from "@/features/security/private-cloud-mode";
import { clearPrivateCloudLocalUser } from "@/features/sync/encrypted-sync-service";
import { setCloudRestoreSuppressed } from "@/features/sync/restore-preference";
import { AccountSettingsDialog, type AccountSettingsTab } from "./AccountSettingsDialog";
import {
  consumeOAuthError,
  deleteAccount,
  getAccountIdentity,
  signInWithGitHub,
  signInWithGoogle,
  signInWithMicrosoft,
  signOut,
} from "./auth-service";
import { consumePendingSignInRequest, OPEN_SIGN_IN_EVENT } from "./sign-in-trigger";

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M2 2h9v9H2V2Zm11 0h9v9h-9V2ZM2 13h9v9H2v-9Zm11 0h9v9h-9v-9Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.88 3.2-1.76 4.16-1.12 1.12-2.88 2.4-6.08 2.4-4.88 0-8.72-3.92-8.72-8.72s3.84-8.72 8.72-8.72c2.64 0 4.56 1.04 5.92 2.32l2.32-2.32C18.72 1.44 16.08 0 12.48 0 5.84 0 .24 5.44.24 12s5.6 12 12.24 12c3.6 0 6.32-1.2 8.48-3.44 2.16-2.16 2.8-5.2 2.8-7.68 0-.72-.08-1.36-.16-1.92h-11.28Z" />
    </svg>
  );
}

export function AccountStatus({
  user,
  loading,
  onAccountDeleted,
  hasTimetable,
  onOnboardingContinue,
  onOnboardingImport,
  settingsRequest = 0,
  meetings,
  term,
  preferences,
  planTransition,
}: {
  user: User | null;
  loading: boolean;
  onAccountDeleted: (clearLocal: boolean) => void;
  hasTimetable: boolean;
  onOnboardingContinue: () => void;
  onOnboardingImport: () => void;
  /** Monotonic app-shell action token used to open the single settings dialog directly. */
  settingsRequest?: number;
  meetings: Meeting[];
  term: Term;
  preferences: UserPreferences;
  planTransition: TransitionPlanner;
}) {
  const aiController = useBridgedAiDelegationController();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<AccountSettingsTab>("account");
  const [clearLocal, setClearLocal] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [cleanupUserId, setCleanupUserId] = useState<string | null>(null);

  useEffect(() => {
    const error = consumeOAuthError(window.location, window.history);
    if (error) setMessage("Sign-in did not complete. Please try again.");
  }, []);

  useEffect(() => {
    const openSignIn = () => {
      if (!user && isSupabaseConfigured) {
        consumePendingSignInRequest();
        setSignInOpen(true);
      }
    };
    window.addEventListener(OPEN_SIGN_IN_EVENT, openSignIn);
    if (!user && isSupabaseConfigured && consumePendingSignInRequest()) {
      setSignInOpen(true);
    }
    return () => window.removeEventListener(OPEN_SIGN_IN_EVENT, openSignIn);
  }, [user]);

  useEffect(() => {
    const openSettings = () => {
      setSettingsTab(user ? "account" : "exports");
      setSettingsOpen(true);
    };
    window.addEventListener("gapwise:open-account-settings", openSettings);
    return () => window.removeEventListener("gapwise:open-account-settings", openSettings);
  }, [user]);

  useEffect(() => {
    if (settingsRequest > 0) {
      setSettingsTab(user ? "account" : "exports");
      setSettingsOpen(true);
    }
  }, [settingsRequest, user]);

  useEffect(() => {
    if (user) {
      setSignInOpen(false);
    } else {
      setSettingsOpen(false);
    }
  }, [user]);

  async function removeAccount() {
    if (busy) return;
    const deletedUserId = user?.id ?? null;
    setBusy(true);
    setMessage(null);
    try {
      await deleteAccount();
      let localCleanupFailed = false;
      if (shouldWritePrivateCloud && deletedUserId) {
        try {
          await clearPrivateCloudLocalUser(deletedUserId);
        } catch {
          localCleanupFailed = true;
          setCleanupUserId(deletedUserId);
        }
      }
      if (clearLocal) clearRememberedTimetable();
      if (deletedUserId) setCloudRestoreSuppressed(deletedUserId, false);
      onAccountDeleted(clearLocal);
      await signOut().catch(() => undefined);
      setDeleteOpen(false);
      setSettingsOpen(false);
      if (localCleanupFailed) {
        setMessage(
          "Your account and cloud data were deleted, but this browser couldn't finish clearing encrypted local data. Retry local cleanup.",
        );
      } else {
        setCleanupUserId(null);
        setMessage("Your account and cloud data were permanently deleted.");
      }
    } catch {
      setMessage("We couldn't delete your account. Your session and local data are unchanged.");
    } finally {
      setBusy(false);
    }
  }

  async function retryLocalCleanup() {
    if (busy || !cleanupUserId) return;
    setBusy(true);
    try {
      await clearPrivateCloudLocalUser(cleanupUserId);
      if (clearLocal) clearRememberedTimetable();
      setCleanupUserId(null);
      setMessage(
        "Your account and cloud data were permanently deleted, and this browser's private data was cleared.",
      );
    } catch {
      setMessage(
        "Your account is deleted, but this browser still couldn't clear encrypted local data. Retry or clear this site's browser data.",
      );
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
      setSettingsOpen(false);
    } catch {
      setMessage("You're signed out on this device, but the server could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  async function startOAuth(
    provider: "Google" | "Microsoft" | "GitHub",
    signIn: () => Promise<void>,
  ) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await signIn();
    } catch {
      setBusy(false);
      setMessage(`We couldn't complete ${provider} sign-in. Try again.`);
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
                Account
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  You’ll stay signed in on this device until you sign out.
                </span>
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => {
                  setSettingsTab("account");
                  setSettingsOpen(true);
                }}
              >
                <Settings2 aria-hidden="true" /> Account settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
                  ? "Gapwise clears secure device keys and encrypted local records during account deletion. If browser storage blocks cleanup, you will be prompted to retry. If unchecked, legacy guest data stays available."
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
          <button
            type="button"
            onClick={() => {
              setSettingsTab("exports");
              setSettingsOpen(true);
            }}
            className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-sm font-medium"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" /> Account settings
          </button>
        </>
      )}

      <AccountSettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => !busy && setSettingsOpen(open)}
        identity={user ? getAccountIdentity(user) : null}
        tab={settingsTab}
        onTabChange={setSettingsTab}
        aiController={aiController}
        meetings={meetings}
        term={term}
        preferences={preferences}
        planTransition={planTransition}
      />

      <Dialog
        open={!loading && !user && signInOpen}
        onOpenChange={(open) => {
          if (!busy) setSignInOpen(open);
        }}
      >
        <DialogContent className="sign-in-panel glass-panel w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Sign in to sync</DialogTitle>
            <DialogDescription>
              Sync is optional. You can keep using Gapwise without an account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void startOAuth("Google", signInWithGoogle)}
              disabled={busy}
              className="button-secondary inline-flex min-h-11 w-full items-center justify-center gap-2 px-3 text-sm font-medium disabled:opacity-50"
            >
              <GoogleIcon /> Continue with Google
            </button>
            <button
              type="button"
              onClick={() => void startOAuth("Microsoft", signInWithMicrosoft)}
              disabled={busy}
              className="button-secondary inline-flex min-h-11 w-full items-center justify-center gap-2 px-3 text-sm font-medium disabled:opacity-50"
            >
              <MicrosoftIcon /> Continue with Microsoft
            </button>
            <button
              type="button"
              onClick={() => void startOAuth("GitHub", signInWithGitHub)}
              disabled={busy}
              className="button-secondary inline-flex min-h-11 w-full items-center justify-center gap-2 px-3 text-sm font-medium disabled:opacity-50"
            >
              <GitBranch className="h-4 w-4" aria-hidden="true" /> Continue with GitHub
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to the{" "}
            <a className="underline" href="/terms">
              Terms
            </a>{" "}
            and acknowledge the{" "}
            <a className="underline" href="/privacy">
              Privacy Policy
            </a>
            .
          </p>
        </DialogContent>
      </Dialog>

      <AccountOnboarding
        userId={user?.id ?? null}
        hasTimetable={hasTimetable}
        onContinue={onOnboardingContinue}
        onImport={onOnboardingImport}
      />

      {message ? (
        <div
          role="status"
          className="glass-panel fixed right-4 top-20 z-[60] max-w-sm rounded-lg px-4 py-3 text-sm"
        >
          <span>{message}</span>
          {cleanupUserId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void retryLocalCleanup()}
              className="button-secondary mt-2 min-h-9 px-3 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? "Retrying…" : "Retry local cleanup"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
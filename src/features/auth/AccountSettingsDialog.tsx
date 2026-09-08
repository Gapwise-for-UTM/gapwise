import {
  Bot,
  Download,
  ExternalLink,
  HardDrive,
  Link2,
  LockKeyhole,
  LogIn,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { TimetableExportDialog } from "@/components/TimetableExportDialog";
import { TimetableHeatmapExportDialog } from "@/components/TimetableHeatmapExportDialog";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term } from "@/lib/timetable-types";
import { AiIntegrationControls } from "@/features/ai/AiIntegrationControls";
import type { AiDelegationController } from "@/features/ai/use-ai-delegation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GAPWISE_AI_URL = "https://ai.gapwise.ca";
const GAPWISE_MCP_URL = `${GAPWISE_AI_URL}/api/mcp`;
const GUEST_PERSISTENCE_EVENT = "gapwise:guest-timetable-persistence";
export type AccountSettingsTab = "account" | "exports" | "ai";

type DeviceSaveState = "checking" | "saved" | "off" | "busy" | "unavailable";

export function AccountSettingsDialog({
  open,
  onOpenChange,
  identity,
  tab,
  onTabChange,
  onRequestSignIn,
  aiController,
  meetings,
  term,
  preferences,
  planTransition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: string | null;
  tab: AccountSettingsTab;
  onTabChange: (tab: AccountSettingsTab) => void;
  onRequestSignIn: () => void;
  aiController: AiDelegationController | null;
  meetings: Meeting[];
  term: Term;
  preferences: UserPreferences;
  planTransition: TransitionPlanner;
}) {
  const hasTimetable = meetings.length > 0;
  const [deviceSaveState, setDeviceSaveState] = useState<DeviceSaveState>("checking");

  useEffect(() => {
    if (!open || identity) return;
    let active = true;
    setDeviceSaveState("checking");
    void import("@/features/security/guest-timetable")
      .then(({ loadGuestTimetable }) => loadGuestTimetable())
      .then((record) => {
        if (active) setDeviceSaveState(record.remember ? "saved" : "off");
      })
      .catch(() => {
        if (active) setDeviceSaveState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [identity, open]);

  async function setDeviceSave(enabled: boolean) {
    if (identity || deviceSaveState === "busy") return;
    setDeviceSaveState("busy");
    try {
      const { clearGuestTimetable, saveGuestTimetable } = await import(
        "@/features/security/guest-timetable"
      );
      if (enabled) await saveGuestTimetable(meetings);
      else await clearGuestTimetable();
      const updatedAt = enabled ? new Date().toISOString() : null;
      setDeviceSaveState(enabled ? "saved" : "off");
      window.dispatchEvent(
        new CustomEvent(GUEST_PERSISTENCE_EVENT, {
          detail: {
            remember: enabled,
            meetings: enabled ? meetings : null,
            updatedAt,
          },
        }),
      );
    } catch {
      setDeviceSaveState("unavailable");
    }
  }

  const deviceSaved = deviceSaveState === "saved";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5 text-left sm:px-6 sm:pt-6">
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>
            Manage optional account sync, local device storage, exports, and Gapwise AI.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => onTabChange(value as AccountSettingsTab)}
          className="px-5 pb-5 sm:px-6 sm:pb-6"
        >
          <TabsList className="mt-4 grid h-auto w-full grid-cols-3 sm:w-fit sm:min-w-[30rem]">
            <TabsTrigger value="account" className="min-h-9 gap-2">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Account
            </TabsTrigger>
            <TabsTrigger value="exports" className="min-h-9 gap-2">
              <Download className="h-4 w-4" aria-hidden="true" />
              Exports
            </TabsTrigger>
            <TabsTrigger value="ai" className="min-h-9 gap-2">
              <Bot className="h-4 w-4" aria-hidden="true" />
              AI integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-4 space-y-3">
            <section className="rounded-xl border border-border/70 p-4 sm:p-5">
              <p className="text-sm font-semibold">{identity ? "Signed in as" : "Guest mode"}</p>
              {identity ? (
                <p className="mt-1 break-words text-sm text-muted-foreground">{identity}</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    An account is optional. Timetable planning, device storage, exports, campus
                    tools, and public AI remain available without signing in.
                  </p>
                  <button
                    type="button"
                    onClick={onRequestSignIn}
                    className="button-secondary mt-4 inline-flex min-h-10 items-center gap-2 px-3 text-sm font-medium"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Sign in to sync
                  </button>
                </>
              )}
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Signing in adds optional encrypted sync, private friend features, and authorization
                for delegated student context. Your original ACORN .ics file is not stored in your
                account.
              </p>
            </section>

            <section className="rounded-xl border border-border/70 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/45">
                  <HardDrive className="h-4 w-4 text-accent" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Keep timetable on this device</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {identity
                          ? "Your signed-in data uses the account sync path. Guest device storage is only used while signed out."
                          : "Reopen Gapwise without uploading your ACORN file again. The normalized timetable is encrypted in this browser with a non-extractable device key."}
                      </p>
                    </div>
                    {!identity ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={deviceSaved}
                        disabled={
                          deviceSaveState === "checking" ||
                          deviceSaveState === "busy" ||
                          deviceSaveState === "unavailable" ||
                          (!hasTimetable && !deviceSaved)
                        }
                        onClick={() => void setDeviceSave(!deviceSaved)}
                        className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            deviceSaved ? "bg-accent" : "bg-muted-foreground/35"
                          }`}
                          aria-hidden="true"
                        />
                        {deviceSaveState === "checking"
                          ? "Checking…"
                          : deviceSaveState === "busy"
                            ? "Saving…"
                            : deviceSaved
                              ? "Saved"
                              : "Save on device"}
                      </button>
                    ) : null}
                  </div>

                  {!identity && !hasTimetable && !deviceSaved ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Import a timetable first, then turn this on.
                    </p>
                  ) : null}
                  {!identity && deviceSaveState === "unavailable" ? (
                    <p className="mt-3 text-xs text-destructive">
                      Secure device storage is unavailable in this browser or browsing mode.
                    </p>
                  ) : null}

                  {!identity ? (
                    <div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                      <p>
                        The encryption key stays in browser-managed secure storage and is marked
                        non-extractable. Clearing this site&apos;s browser data removes both the key
                        and saved timetable. This is local device protection, not account sync or a
                        password-protected backup.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="exports" className="mt-4 space-y-3">
            <section className="rounded-xl border border-border/70 p-4 sm:p-5">
              <p className="text-sm font-semibold">Timetable</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Export any available term or combine every term in one private image or print-ready
                vector. No account is required.
              </p>
              <div className="mt-4">
                <TimetableExportDialog meetings={meetings} />
              </div>
            </section>
            <section className="rounded-xl border border-border/70 p-4 sm:p-5">
              <p className="text-sm font-semibold">UTM map heatmap</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Export a campus-focused building and route heatmap for one term or all terms
                together. This also stays local and does not require an account.
              </p>
              <div className="mt-4">
                <TimetableHeatmapExportDialog
                  meetings={meetings}
                  term={term}
                  preferences={preferences}
                  planTransition={planTransition}
                />
              </div>
            </section>
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-4">
            <section className="rounded-xl border border-border/70 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/8">
                  <Link2 className="h-4 w-4 text-accent" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Gapwise AI</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Public Gapwise AI and the MCP endpoint are available to everyone. Sign-in is
                    only needed when you choose to authorize private student context.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={GAPWISE_AI_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="button-secondary inline-flex min-h-10 items-center gap-2 px-3 text-sm font-medium"
                    >
                      Open Gapwise AI
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                  <code className="mt-3 block overflow-x-auto rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground">
                    {GAPWISE_MCP_URL}
                  </code>
                </div>
              </div>
            </section>

            {aiController ? (
              aiController.configured ? (
                <AiIntegrationControls controller={aiController} />
              ) : (
                <section className="rounded-xl border border-border/70 p-4 sm:p-5">
                  <p className="text-sm font-semibold">Private AI delegation unavailable</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Public Gapwise AI still works. Private delegated student context is not
                    configured on this deployment yet.
                  </p>
                </section>
              )
            ) : (
              <section className="rounded-xl border border-border/70 p-4 sm:p-5">
                <p className="text-sm font-semibold">
                  {identity ? "Private AI access is not active" : "Private AI access is optional"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {identity
                    ? "Load a real ACORN timetable in this browser to manage a minimized private AI snapshot. Demo schedules are never delegated."
                    : "You can use the public AI site and MCP endpoint above without an account. Sign in only if you want to authorize private timetable or student context."}
                </p>
                {!identity ? (
                  <button
                    type="button"
                    onClick={onRequestSignIn}
                    className="button-secondary mt-4 inline-flex min-h-10 items-center gap-2 px-3 text-sm font-medium"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Sign in for private delegation
                  </button>
                ) : null}
              </section>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

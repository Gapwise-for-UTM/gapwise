import { Bot, Link2, UserRound } from "lucide-react";
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

const GAPWISE_MCP_URL = "https://ai.gapwise.ca/api/mcp";

export function AccountSettingsDialog({
  open,
  onOpenChange,
  identity,
  aiController,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: string;
  aiController: AiDelegationController | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5 text-left sm:px-6 sm:pt-6">
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>
            Manage your Gapwise account and exactly what authorized AI connectors may access.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="account" className="px-5 pb-5 sm:px-6 sm:pb-6">
          <TabsList className="mt-4 grid h-auto w-full grid-cols-2 sm:w-fit sm:min-w-72">
            <TabsTrigger value="account" className="min-h-9 gap-2">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Account
            </TabsTrigger>
            <TabsTrigger value="ai" className="min-h-9 gap-2">
              <Bot className="h-4 w-4" aria-hidden="true" />
              AI integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-4">
            <section className="rounded-xl border border-border/70 p-4 sm:p-5">
              <p className="text-sm font-semibold">Signed in as</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">{identity}</p>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Your account is used for optional encrypted sync, private friend features, and AI
                authorization. Your original ACORN .ics file is not stored in your account.
              </p>
            </section>
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-4">
            <section className="rounded-xl border border-border/70 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/8">
                  <Link2 className="h-4 w-4 text-accent" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    Connect ChatGPT, Claude, or another MCP client
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Add the Gapwise MCP endpoint in your AI client. OAuth sign-in and the
                    permissions below decide what that client can actually read or change.
                  </p>
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
                  <p className="text-sm font-semibold">AI integrations unavailable</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    AI integration is not configured on this Gapwise deployment yet.
                  </p>
                </section>
              )
            ) : (
              <section className="rounded-xl border border-border/70 p-4 sm:p-5">
                <p className="text-sm font-semibold">Load your timetable to manage AI access</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Gapwise needs your signed-in, real ACORN timetable in this browser before it can
                  create or update the minimized AI snapshot. Demo schedules are never delegated.
                </p>
              </section>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

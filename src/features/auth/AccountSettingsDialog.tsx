import { Bot, UserRound } from "lucide-react";
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

export function AccountSettingsDialog({
  open,
  onOpenChange,
  identity,
  aiController,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: string;
  aiController: AiDelegationController;
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

          <TabsContent value="ai" className="mt-4">
            {aiController.configured ? (
              <AiIntegrationControls controller={aiController} />
            ) : (
              <section className="rounded-xl border border-border/70 p-4 sm:p-5">
                <p className="text-sm font-semibold">AI integrations</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  AI integration is not configured on this Gapwise deployment yet.
                </p>
              </section>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

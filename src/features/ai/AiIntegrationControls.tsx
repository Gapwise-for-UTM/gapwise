import { Bot, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import type { AiDelegationController } from "./use-ai-delegation";
import type { AiPermissions } from "./types";

function PermissionToggle({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-lg border border-border/70 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export function AiIntegrationControls({ controller }: { controller: AiDelegationController }) {
  const [draft, setDraft] = useState<AiPermissions>(controller.permissions);

  useEffect(() => setDraft(controller.permissions), [controller.permissions]);

  const set = (patch: Partial<AiPermissions>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (!next.readPersonal) next.writePersonal = false;
      if (next.writePersonal) next.readPersonal = true;
      if (!next.readGapPreferences) next.writeGapPreferences = false;
      if (next.writeGapPreferences) next.readGapPreferences = true;
      return next;
    });
  };

  if (!controller.configured) {
    return (
      <section className="rounded-xl border border-border/70 p-4">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">AI integrations</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              AI integration is not enabled on this Gapwise deployment yet.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-border/70 p-4"
      aria-labelledby="ai-integration-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/8">
          <Bot className="h-4 w-4 text-accent" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p id="ai-integration-title" className="text-sm font-semibold">
              ChatGPT, Claude & MCP
            </p>
            {controller.status.enabled ? (
              <span className="rounded-full border border-accent/25 bg-accent/8 px-2 py-0.5 text-[11px] font-semibold text-accent">
                Connected · revision {controller.status.revision}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Share a minimized, encrypted-at-rest timetable copy with an AI connector you authorize.
            Your original ACORN file, friends, precise location, account credentials, and Gapwise
            encryption keys are never included.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <p>
            The authorized AI provider can see timetable facts returned by its tools. Gapwise AI
            decrypts the delegated copy transiently to answer those requests, so this is not
            zero-knowledge or end-to-end encryption.{" "}
            <strong className="text-foreground">Academic classes are always read-only.</strong>
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <PermissionToggle
          checked
          disabled
          label="Read academic timetable"
          description="Required. Shares source-backed class times, sections, buildings/rooms, and recurrence facts — never the raw .ics file."
          onChange={() => undefined}
        />
        <PermissionToggle
          checked={draft.readPersonal}
          disabled={controller.busy}
          label="Read personal timetable items"
          description="Lets AI reason about study blocks, meals, appointments, and other personal items. Notes are not shared."
          onChange={(checked) => set({ readPersonal: checked })}
        />
        <PermissionToggle
          checked={draft.writePersonal}
          disabled={controller.busy}
          label="Edit personal timetable items"
          description="Lets AI queue create/update/delete actions for personal items only. Imported academic classes cannot be changed."
          onChange={(checked) => set({ writePersonal: checked })}
        />
        <PermissionToggle
          checked={draft.readGapPreferences}
          disabled={controller.busy}
          label="Read gap-planning preferences"
          description="Shares setup/pack-up buffers, meal window, commute/home assumptions, and risk tolerance."
          onChange={(checked) => set({ readGapPreferences: checked })}
        />
        <PermissionToggle
          checked={draft.writeGapPreferences}
          disabled={controller.busy}
          label="Edit gap-planning preferences"
          description="Lets AI queue bounded changes to those planning preferences."
          onChange={(checked) => set({ writeGapPreferences: checked })}
        />
        <PermissionToggle
          checked={draft.readRoutingPreferences}
          disabled={controller.busy}
          label="Read routing preferences"
          description="Shares walking mode/speed, transition buffer, indoor/stair preferences, and selected commute/residence origin."
          onChange={(checked) => set({ readRoutingPreferences: checked })}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!controller.status.enabled ? (
          <button
            type="button"
            disabled={controller.busy || !controller.canEnable}
            onClick={() => void controller.enable(draft)}
            className="button-primary inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold disabled:opacity-50"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            {controller.busy ? "Enabling…" : "Enable AI access"}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={controller.busy}
              onClick={() => void controller.savePermissions(draft)}
              className="button-secondary min-h-10 px-3 text-sm font-semibold disabled:opacity-50"
            >
              {controller.busy ? "Saving…" : "Save AI permissions"}
            </button>
            <button
              type="button"
              disabled={controller.busy}
              onClick={() => void controller.checkActions()}
              className="button-secondary inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Check AI changes
            </button>
            <button
              type="button"
              disabled={controller.busy}
              onClick={() => void controller.revoke()}
              className="button-secondary inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold text-destructive disabled:opacity-50"
            >
              <Unplug className="h-4 w-4" aria-hidden="true" />
              Revoke AI access
            </button>
          </>
        )}
      </div>

      {!controller.status.enabled && !controller.canEnable ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Sign in and import a real ACORN timetable before enabling AI access. Demo schedules are
          never delegated.
        </p>
      ) : null}

      {controller.message ? (
        <p role="status" className="mt-3 text-xs leading-5 text-muted-foreground">
          {controller.message}
        </p>
      ) : null}
    </section>
  );
}

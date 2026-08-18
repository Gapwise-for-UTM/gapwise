import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GapPreferences } from "@/features/gaps/types";
import type { UserPreferences } from "@/features/sync/preferences";
import type { PersonalItem } from "@/lib/personal-types";
import type { Meeting } from "@/lib/timetable-types";
import { applyAiActionBatch, parsePendingAiActions } from "./actions";
import {
  completeAiAction,
  getAiDelegationStatus,
  getPendingAiActions,
  isGapwiseAiConfigured,
  publishAiSnapshot,
  revokeAiDelegation,
} from "./client";
import { aiSnapshotFingerprint, buildAiSnapshot } from "./snapshot";
import {
  DEFAULT_AI_PERMISSIONS,
  type AiDelegationStatus,
  type AiPermissions,
} from "./types";

const POLL_INTERVAL_MS = 60_000;
const SNAPSHOT_DEBOUNCE_MS = 1_500;

type ControllerInput = {
  userId: string | null;
  meetings: Meeting[] | null;
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  isDemo: boolean;
  onPersonalItemsChange: (items: PersonalItem[]) => void;
  onGapPreferencesChange: (preferences: GapPreferences) => void;
};

export type AiDelegationController = {
  configured: boolean;
  status: AiDelegationStatus;
  permissions: AiPermissions;
  busy: boolean;
  message: string | null;
  canEnable: boolean;
  enable: (permissions?: AiPermissions) => Promise<void>;
  savePermissions: (permissions: AiPermissions) => Promise<void>;
  revoke: () => Promise<void>;
  checkActions: () => Promise<void>;
};

export function useAiDelegation(input: ControllerInput): AiDelegationController {
  const [status, setStatus] = useState<AiDelegationStatus>({ enabled: false });
  const [permissions, setPermissions] = useState<AiPermissions>(DEFAULT_AI_PERMISSIONS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const operation = useRef<Promise<void> | null>(null);
  const currentRevision = useRef<number | null>(null);
  const lastPublishedFingerprint = useRef<string | null>(null);
  const latest = useRef(input);
  latest.current = input;

  const canEnable = Boolean(
    isGapwiseAiConfigured && input.userId && input.meetings?.length && !input.isDemo,
  );

  const snapshotInput = useMemo(
    () => ({
      meetings: input.meetings ?? [],
      personalItems: input.personalItems,
      preferences: input.preferences,
      gapPreferences: input.gapPreferences,
      permissions,
    }),
    [input.gapPreferences, input.meetings, input.personalItems, input.preferences, permissions],
  );
  const fingerprint = useMemo(() => aiSnapshotFingerprint(snapshotInput), [snapshotInput]);

  const serialize = useCallback(async (work: () => Promise<void>) => {
    const previous = operation.current ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    operation.current = next;
    setBusy(true);
    try {
      await next;
    } finally {
      if (operation.current === next) {
        operation.current = null;
        setBusy(false);
      }
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!isGapwiseAiConfigured || !latest.current.userId) {
      currentRevision.current = null;
      lastPublishedFingerprint.current = null;
      setStatus({ enabled: false });
      return;
    }
    try {
      const next = await getAiDelegationStatus();
      setStatus(next);
      if (next.enabled) {
        currentRevision.current = next.revision;
        setPermissions(next.permissions);
      } else {
        currentRevision.current = null;
        lastPublishedFingerprint.current = null;
      }
      setMessage(null);
    } catch {
      setMessage("Gapwise could not check AI access right now.");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [input.userId, refreshStatus]);

  const publishCurrent = useCallback(
    async (nextPermissions = permissions, force = false) => {
      const state = latest.current;
      if (!state.userId || !state.meetings?.length || state.isDemo) return;
      const revision = currentRevision.current;
      if (revision === null) return;
      const content = {
        meetings: state.meetings,
        personalItems: state.personalItems,
        preferences: state.preferences,
        gapPreferences: state.gapPreferences,
        permissions: nextPermissions,
      };
      const nextFingerprint = aiSnapshotFingerprint(content);
      if (!force && nextFingerprint === lastPublishedFingerprint.current) return;
      const result = await publishAiSnapshot(buildAiSnapshot(revision + 1, content));
      currentRevision.current = result.revision;
      lastPublishedFingerprint.current = nextFingerprint;
      setPermissions(nextPermissions);
      setStatus({
        enabled: true,
        revision: result.revision,
        permissions: nextPermissions,
        updatedAt: result.updatedAt,
      });
    },
    [permissions],
  );

  const enable = useCallback(
    async (requestedPermissions = permissions) => {
      await serialize(async () => {
        const state = latest.current;
        if (!isGapwiseAiConfigured) {
          setMessage("Gapwise AI is not configured on this deployment.");
          return;
        }
        if (!state.userId || !state.meetings?.length || state.isDemo) {
          setMessage("Sign in with a real imported timetable before enabling AI access.");
          return;
        }
        try {
          const current = await getAiDelegationStatus();
          if (current.enabled) {
            currentRevision.current = current.revision;
            setStatus(current);
            await publishCurrent(requestedPermissions, true);
            setMessage("Gapwise AI permissions were updated.");
            return;
          }
          const content = {
            meetings: state.meetings,
            personalItems: state.personalItems,
            preferences: state.preferences,
            gapPreferences: state.gapPreferences,
            permissions: requestedPermissions,
          };
          const result = await publishAiSnapshot(buildAiSnapshot(1, content));
          currentRevision.current = result.revision;
          lastPublishedFingerprint.current = aiSnapshotFingerprint(content);
          setPermissions(requestedPermissions);
          setStatus({
            enabled: true,
            revision: result.revision,
            permissions: requestedPermissions,
            updatedAt: result.updatedAt,
          });
          setMessage("AI access is enabled. Connect ChatGPT or Claude using the Gapwise MCP server.");
        } catch {
          setMessage("Gapwise could not enable AI access. Nothing was shared.");
        }
      });
    },
    [permissions, publishCurrent, serialize],
  );

  const savePermissions = useCallback(
    async (nextPermissions: AiPermissions) => {
      if (!status.enabled) {
        await enable(nextPermissions);
        return;
      }
      await serialize(async () => {
        try {
          await publishCurrent(nextPermissions, true);
          setMessage("AI permissions were updated.");
        } catch {
          setMessage("Gapwise could not update AI permissions. Existing permissions are unchanged.");
        }
      });
    },
    [enable, publishCurrent, serialize, status.enabled],
  );

  const revoke = useCallback(async () => {
    await serialize(async () => {
      try {
        await revokeAiDelegation();
        currentRevision.current = null;
        lastPublishedFingerprint.current = null;
        setStatus({ enabled: false });
        setPermissions(DEFAULT_AI_PERMISSIONS);
        setMessage("AI access was revoked and the delegated snapshot/queued changes were deleted.");
      } catch {
        setMessage("Gapwise could not revoke AI access right now. Try again before assuming access is removed.");
      }
    });
  }, [serialize]);

  const checkActions = useCallback(async () => {
    await serialize(async () => {
      if (!status.enabled || currentRevision.current === null) return;
      try {
        const raw = await getPendingAiActions();
        const actions = parsePendingAiActions(raw);
        if (!actions) throw new Error("Queued AI actions are malformed.");
        if (!actions.length) {
          setMessage("No AI changes are waiting for Gapwise.");
          return;
        }

        const state = latest.current;
        const revision = currentRevision.current;
        const batch = applyAiActionBatch({
          actions,
          revision,
          personalItems: state.personalItems,
          gapPreferences: state.gapPreferences,
        });

        for (const rejected of batch.rejected) {
          await completeAiAction(rejected.id, { status: "rejected", resultCode: rejected.code });
        }

        if (!batch.applied.length) {
          setMessage(`${batch.rejected.length} queued AI change(s) were rejected safely.`);
          return;
        }

        const content = {
          meetings: state.meetings ?? [],
          personalItems: batch.personalItems,
          preferences: state.preferences,
          gapPreferences: batch.gapPreferences,
          permissions,
        };
        const result = await publishAiSnapshot(buildAiSnapshot(revision + 1, content));

        state.onPersonalItemsChange(batch.personalItems);
        state.onGapPreferencesChange(batch.gapPreferences);
        currentRevision.current = result.revision;
        lastPublishedFingerprint.current = aiSnapshotFingerprint(content);
        setStatus({
          enabled: true,
          revision: result.revision,
          permissions,
          updatedAt: result.updatedAt,
        });

        for (const id of batch.applied) {
          await completeAiAction(id, { status: "applied" });
        }
        setMessage(
          `${batch.applied.length} AI change(s) applied${batch.rejected.length ? `; ${batch.rejected.length} rejected safely` : ""}.`,
        );
      } catch {
        setMessage("Gapwise could not apply queued AI changes. Your current timetable was kept.");
      }
    });
  }, [permissions, serialize, status.enabled]);

  useEffect(() => {
    if (!status.enabled || !input.userId || !input.meetings?.length || input.isDemo) return;
    if (lastPublishedFingerprint.current === null) {
      // This browser may have restored fresher private state than the delegated copy.
      lastPublishedFingerprint.current = "";
    }
    if (fingerprint === lastPublishedFingerprint.current) return;
    const timeout = window.setTimeout(() => {
      void serialize(async () => {
        try {
          await publishCurrent(permissions);
        } catch {
          setMessage("Gapwise kept your local changes, but could not refresh the AI snapshot.");
        }
      });
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [fingerprint, input.isDemo, input.meetings?.length, input.userId, permissions, publishCurrent, serialize, status.enabled]);

  useEffect(() => {
    if (!status.enabled || !input.userId || !isGapwiseAiConfigured) return;
    const poll = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void checkActions();
    };
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    window.addEventListener("focus", poll);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", poll);
    };
  }, [checkActions, input.userId, status.enabled]);

  return {
    configured: isGapwiseAiConfigured,
    status,
    permissions,
    busy,
    message,
    canEnable,
    enable,
    savePermissions,
    revoke,
    checkActions,
  };
}

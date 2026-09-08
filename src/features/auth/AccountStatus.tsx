import type { User } from "@supabase/supabase-js";
import { lazy, Suspense, useEffect, useState } from "react";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term } from "@/lib/timetable-types";
import { OPEN_ACCOUNT_SETTINGS_EVENT } from "./account-settings-trigger";
import { OPEN_SIGN_IN_EVENT, requestGapwiseSignIn } from "./sign-in-trigger";

const AccountStatusImpl = lazy(() =>
  import("./AccountStatusImpl").then((module) => ({ default: module.AccountStatus })),
);

const viteEnv = (
  import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }
).env;
const signInEnvironmentAvailable = Boolean(
  viteEnv?.["VITE_SUPABASE_URL"]?.trim() && viteEnv?.["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim(),
);

type AccountStatusProps = {
  user: User | null;
  loading: boolean;
  onAccountDeleted: (clearLocal: boolean) => void;
  hasTimetable: boolean;
  onOnboardingContinue: () => void;
  onOnboardingImport: () => void;
  settingsRequest?: number;
  meetings: Meeting[];
  term: Term;
  preferences: UserPreferences;
  planTransition: TransitionPlanner;
};

function SignInStub({
  loading,
  available,
  onActivate,
}: {
  loading: boolean;
  available: boolean;
  onActivate: () => void;
}) {
  return (
    <div className="relative flex items-center gap-2" role="group" aria-label="Account">
      <button
        type="button"
        disabled={loading || !available}
        onClick={onActivate}
        className="button-secondary inline-flex min-h-9 items-center px-3 text-sm font-medium disabled:opacity-50"
      >
        Sign in
      </button>
    </div>
  );
}

export function AccountStatus(props: AccountStatusProps) {
  const [activated, setActivated] = useState(false);
  const [localSettingsRequest, setLocalSettingsRequest] = useState(0);

  useEffect(() => {
    const activate = () => setActivated(true);
    window.addEventListener(OPEN_SIGN_IN_EVENT, activate);
    return () => window.removeEventListener(OPEN_SIGN_IN_EVENT, activate);
  }, []);

  useEffect(() => {
    const openSettings = () => {
      setActivated(true);
      setLocalSettingsRequest((request) => request + 1);
    };
    window.addEventListener(OPEN_ACCOUNT_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_ACCOUNT_SETTINGS_EVENT, openSettings);
  }, []);

  const settingsRequest = (props.settingsRequest ?? 0) + localSettingsRequest;
  const shouldLoad = activated || Boolean(props.user) || settingsRequest > 0;

  if (!shouldLoad) {
    return (
      <SignInStub
        loading={props.loading}
        available={signInEnvironmentAvailable}
        onActivate={() => {
          setActivated(true);
          requestGapwiseSignIn();
        }}
      />
    );
  }

  return (
    <Suspense
      fallback={<SignInStub loading available={signInEnvironmentAvailable} onActivate={() => undefined} />}
    >
      <AccountStatusImpl {...props} settingsRequest={settingsRequest} />
    </Suspense>
  );
}

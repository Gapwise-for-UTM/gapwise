import type { User } from "@supabase/supabase-js";
import { lazy, Suspense, useState } from "react";
import type { UserPreferences } from "./preferences";

const ResidenceSettingsImpl = lazy(() =>
  import("./ResidenceSettingsImpl").then((module) => ({ default: module.ResidenceSettings })),
);

type ResidenceSettingsProps = {
  user: User | null;
  preferences: UserPreferences;
  onPreferencesChange: (preferences: UserPreferences) => void;
  openRequest?: number;
};

function ArrivalStub({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="button-secondary inline-flex min-h-9 items-center px-3 text-sm font-medium"
      aria-label="Campus arrival settings"
    >
      Arrival
    </button>
  );
}

export function ResidenceSettings(props: ResidenceSettingsProps) {
  const [activated, setActivated] = useState(false);
  const [localRequest, setLocalRequest] = useState(0);
  const externalRequest = props.openRequest ?? 0;
  const shouldLoad = activated || externalRequest > 0;

  if (!shouldLoad) {
    return (
      <ArrivalStub
        onOpen={() => {
          setActivated(true);
          setLocalRequest((value) => value + 1);
        }}
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <ResidenceSettingsImpl {...props} openRequest={externalRequest + localRequest} />
    </Suspense>
  );
}

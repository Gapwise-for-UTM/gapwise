import type { User } from "@supabase/supabase-js";
import { useEffect } from "react";
import { registerAiDelegationController } from "@/features/ai/controller-bridge";
import { useAiDelegation } from "@/features/ai/use-ai-delegation";
import type { AcademicState } from "@/features/academic/state";
import type { GapPreferences } from "@/features/gaps/types";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
import type { PersonalItem } from "@/lib/personal-types";
import type { Meeting } from "@/lib/timetable-types";
import type { UserPreferences } from "./preferences";

export function CloudAiBridge({
  user,
  meetings,
  personalItems,
  preferences,
  gapPreferences,
  academic,
  onLoadPrivate,
}: {
  user: User;
  meetings: Meeting[] | null;
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  academic: AcademicState;
  onLoadPrivate: (payload: PrivateDataPayloadV1) => void;
}) {
  const aiController = useAiDelegation({
    userId: user.id,
    meetings,
    personalItems,
    preferences,
    gapPreferences,
    academic,
    isDemo: meetings === DEMO_MEETINGS,
    onPrivateDataChange: onLoadPrivate,
  });

  useEffect(() => registerAiDelegationController(aiController), [aiController]);
  return null;
}

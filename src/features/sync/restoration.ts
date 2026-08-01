import type { Meeting } from "@/lib/timetable-types";
import type { RememberedRecord } from "@/hooks/use-preferences";
import type { CloudScheduleRecord } from "./sync-service";

export type RestorationState =
  | "idle"
  | "waiting-for-auth"
  | "checking-cloud"
  | "restored-memory"
  | "restored-local"
  | "restored-cloud"
  | "cloud-version-available"
  | "no-cloud-data"
  | "failed";

export type RestorationChoice = {
  source: "memory" | "local" | "cloud" | "none";
  state: RestorationState;
  meetings: Meeting[] | null;
};

function safeTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** Pure precedence policy. This function never saves or uploads a timetable. */
export function chooseRestoration(
  memory: Meeting[] | null,
  local: RememberedRecord<Meeting[]> | null,
  cloud: CloudScheduleRecord | null,
): RestorationChoice {
  if (memory?.length) return { source: "memory", state: "restored-memory", meetings: memory };
  const localValid = local?.data?.length ? local : null;
  const cloudValid = cloud?.meetings?.length ? cloud : null;
  if (localValid && !cloudValid)
    return { source: "local", state: "restored-local", meetings: localValid.data };
  if (cloudValid && !localValid)
    return { source: "cloud", state: "restored-cloud", meetings: cloudValid.meetings };
  if (!localValid || !cloudValid) return { source: "none", state: "no-cloud-data", meetings: null };
  const localTime = safeTime(localValid.updatedAt);
  const cloudTime = safeTime(cloudValid.updatedAt);
  if (localTime === null || cloudTime === null) {
    return {
      source: "local",
      state: "cloud-version-available",
      meetings: localValid.data,
    };
  }
  return cloudTime > localTime
    ? { source: "cloud", state: "restored-cloud", meetings: cloudValid.meetings }
    : { source: "local", state: "restored-local", meetings: localValid.data };
}

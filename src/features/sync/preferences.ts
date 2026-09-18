import { DEFAULT_ROUTE_PREFERENCES, sanitizeRoutePreferences } from "@/config/routing";
import { getResidenceBuildingForCampus, type GapwiseCampusId } from "@/data/campuses";
import { getCampusAccessPoint, type CampusAccessKind } from "@/data/utm/campus-access-points";
import type { RoutePreferences } from "@/features/routing/types";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";

export type DayOrigin = "commute" | "residence";

export type UserPreferences = RoutePreferences & {
  avoidStairs: boolean;
  preferIndoor: boolean;
  dayOrigin: DayOrigin;
  mainCampus: GapwiseCampusId;
  residenceBuildingCode: string | null;
  commuteMode: CampusAccessKind | null;
  campusAccessPointId: string | null;
};

const LOCAL_PREFERENCES_KEY = "gapwise:user-preferences:v1";
type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  ...DEFAULT_ROUTE_PREFERENCES,
  avoidStairs: false,
  preferIndoor: false,
  dayOrigin: "commute",
  mainCampus: "utm",
  residenceBuildingCode: null,
  commuteMode: null,
  campusAccessPointId: null,
};

export function sanitizeUserPreferences(
  value: Partial<UserPreferences> | null | undefined,
): UserPreferences {
  const route = sanitizeRoutePreferences(value);
  const mainCampus =
    value?.mainCampus === "utsg" || value?.mainCampus === "utsc" ? value.mainCampus : "utm";
  const requestedResidence = value?.residenceBuildingCode?.trim().toUpperCase() ?? null;
  const residenceBuildingCode =
    getResidenceBuildingForCampus(mainCampus, requestedResidence)?.code ?? null;
  const dayOrigin =
    value?.dayOrigin === "residence" && residenceBuildingCode ? "residence" : "commute";
  const commuteMode =
    dayOrigin === "commute" &&
    (value?.commuteMode === "transit" ||
      value?.commuteMode === "parking" ||
      value?.commuteMode === "pickup")
      ? value.commuteMode
      : null;
  const requestedAccessPoint = mainCampus === "utm"
    ? getCampusAccessPoint(value?.campusAccessPointId ?? null)
    : null;
  const campusAccessPointId =
    commuteMode && requestedAccessPoint?.kind === commuteMode ? requestedAccessPoint.id : null;
  return {
    ...route,
    avoidStairs: value?.avoidStairs === true || route.mode === "step-free",
    preferIndoor: value?.preferIndoor === true || route.mode === "prefer-indoor",
    dayOrigin,
    mainCampus,
    residenceBuildingCode: dayOrigin === "residence" ? residenceBuildingCode : null,
    commuteMode,
    campusAccessPointId,
  };
}

function browserPreferenceStorage(): PreferenceStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadLocalUserPreferences(
  storage: PreferenceStorage | null = browserPreferenceStorage(),
): UserPreferences {
  if (isEncryptedPrivateCloudAuthoritative) {
    try {
      storage?.removeItem(LOCAL_PREFERENCES_KEY);
    } catch {
      // Authoritative encrypted mode ignores inaccessible legacy plaintext state.
    }
    return DEFAULT_USER_PREFERENCES;
  }
  if (!storage) return DEFAULT_USER_PREFERENCES;
  try {
    const raw = storage.getItem(LOCAL_PREFERENCES_KEY);
    return raw
      ? sanitizeUserPreferences(JSON.parse(raw) as Partial<UserPreferences>)
      : DEFAULT_USER_PREFERENCES;
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function saveLocalUserPreferences(
  value: UserPreferences,
  storage: PreferenceStorage | null = browserPreferenceStorage(),
): UserPreferences {
  const preferences = sanitizeUserPreferences(value);
  if (!storage) return preferences;
  if (isEncryptedPrivateCloudAuthoritative) return preferences;
  try {
    storage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    /* Private browsing or storage policy can make localStorage unavailable. */
  }
  return preferences;
}

export function clearStoredUserPreferences(storage?: Pick<Storage, "removeItem"> | null) {
  let selected = storage;
  try {
    if (selected === undefined)
      selected = typeof window === "undefined" ? null : window.localStorage;
    selected?.removeItem(LOCAL_PREFERENCES_KEY);
  } catch {
    // A verified encrypted copy still exists; blocked storage needs no cleanup.
  }
}

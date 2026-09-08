export const OPEN_ACCOUNT_SETTINGS_EVENT = "gapwise:open-account-settings";

export function requestGapwiseAccountSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_ACCOUNT_SETTINGS_EVENT));
}

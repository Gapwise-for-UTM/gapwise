export const OPEN_SIGN_IN_EVENT = "gapwise:open-sign-in";

export function requestGapwiseSignIn() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SIGN_IN_EVENT));
}

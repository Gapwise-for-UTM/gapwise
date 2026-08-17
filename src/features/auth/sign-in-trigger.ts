export const OPEN_SIGN_IN_EVENT = "gapwise:open-sign-in";

let pendingSignInRequest = false;

export function requestGapwiseSignIn() {
  if (typeof window === "undefined") return;
  pendingSignInRequest = true;
  window.dispatchEvent(new Event(OPEN_SIGN_IN_EVENT));
}

export function consumePendingSignInRequest() {
  if (!pendingSignInRequest) return false;
  pendingSignInRequest = false;
  return true;
}

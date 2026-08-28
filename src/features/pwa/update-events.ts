export const APP_UPDATE_READY_EVENT = "gapwise:app-update-ready";

export type ApplyAppUpdate = () => Promise<void>;

export function announceAppUpdate(applyUpdate: ApplyAppUpdate) {
  window.dispatchEvent(
    new CustomEvent<ApplyAppUpdate>(APP_UPDATE_READY_EVENT, { detail: applyUpdate }),
  );
}

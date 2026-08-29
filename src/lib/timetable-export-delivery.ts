export interface ExportNavigatorLike {
  userActivation?: {
    isActive: boolean;
  };
}

/**
 * File sharing and downloads may require a fresh transient user activation.
 * Browsers without the User Activation API keep the historical one-tap path.
 */
export function canDeliverGeneratedExportImmediately(
  browserNavigator: ExportNavigatorLike | undefined =
    typeof navigator === "undefined" ? undefined : (navigator as ExportNavigatorLike),
) {
  return browserNavigator?.userActivation?.isActive ?? true;
}

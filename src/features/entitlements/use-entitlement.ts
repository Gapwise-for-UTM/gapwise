import { FREE_ENTITLEMENT, type Entitlement } from "./entitlements";

/** Current Gapwise features are fully free; historical entitlement rows are not consulted. */
export function useEntitlement(_userId: string | null, _demo = false): Entitlement {
  return FREE_ENTITLEMENT;
}

export type EntitlementTier = string;
export type FeatureCapability =
  "academic_planner" | "coursework_management" | "planned_work_blocks";

export interface Entitlement {
  tier: EntitlementTier;
  expiresAt: null;
}

export const FREE_ENTITLEMENT: Entitlement = { tier: "free", expiresAt: null };

/**
 * Historical account rows may still contain retired billing-era fields. They are deliberately
 * ignored: current Gapwise features are not payment-gated.
 */
export function resolveEntitlement(
  _row: { tier?: unknown; expires_at?: unknown } | null | undefined,
): Entitlement {
  return FREE_ENTITLEMENT;
}

export function canUseFeature(_entitlement: Entitlement, _capability: FeatureCapability): boolean {
  return true;
}

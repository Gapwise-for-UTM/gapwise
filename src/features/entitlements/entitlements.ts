export type EntitlementTier = "free" | "pro" | "founder";
export type ProCapability = "academic_planner" | "coursework_management" | "planned_work_blocks";

export interface Entitlement {
  tier: EntitlementTier;
  expiresAt: string | null;
}

export const FREE_ENTITLEMENT: Entitlement = { tier: "free", expiresAt: null };

export function resolveEntitlement(
  row: { tier?: unknown; expires_at?: unknown } | null | undefined,
  now = new Date(),
): Entitlement {
  if (!row || !["pro", "founder"].includes(String(row.tier))) return FREE_ENTITLEMENT;
  if (row.tier === "founder") return { tier: "founder", expiresAt: null };
  const expiresAt = typeof row.expires_at === "string" ? row.expires_at : null;
  if (expiresAt && Date.parse(expiresAt) <= now.getTime()) return FREE_ENTITLEMENT;
  return { tier: "pro", expiresAt };
}

export function canUseFeature(
  entitlement: Entitlement,
  _capability: ProCapability,
  now = new Date(),
): boolean {
  if (entitlement.tier === "founder") return true;
  return (
    entitlement.tier === "pro" &&
    (!entitlement.expiresAt || Date.parse(entitlement.expiresAt) > now.getTime())
  );
}

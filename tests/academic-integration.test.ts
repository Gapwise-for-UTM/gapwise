import { describe, expect, test } from "bun:test";
import {
  canUseFeature,
  FREE_ENTITLEMENT,
  resolveEntitlement,
} from "@/features/entitlements/entitlements";

describe("free product capabilities", () => {
  test("historical entitlement rows do not gate current features", () => {
    expect(resolveEntitlement(null)).toEqual(FREE_ENTITLEMENT);
    expect(resolveEntitlement({ tier: "legacy", expires_at: "2020-01-01T00:00:00Z" })).toEqual(
      FREE_ENTITLEMENT,
    );

    for (const capability of [
      "academic_planner",
      "coursework_management",
      "planned_work_blocks",
    ] as const) {
      expect(canUseFeature(FREE_ENTITLEMENT, capability)).toBe(true);
    }
  });
});

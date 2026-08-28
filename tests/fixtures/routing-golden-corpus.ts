import type { RouteMode } from "@/features/routing/types";

export type RoutingGoldenCase = {
  id: string;
  from: string;
  to: string;
  mode: RouteMode;
  expected: "routed" | "unavailable";
  /** Regression ceiling, not a claim about real-world walking distance. */
  maxGraphDistanceMeters?: number;
  /** Source-backed graph topology that this case is intended to keep connected. */
  requiredEdgeIds?: readonly string[];
  checkReverse?: boolean;
};

/**
 * Deterministic graph expectations only. These cases do not verify physical doors or
 * accessibility. AND-103 / GitHub #157 remains the authority for that field evidence.
 */
export const ROUTING_GOLDEN_CORPUS: readonly RoutingGoldenCase[] = [
  {
    id: "academic-core-short-mn-dh",
    from: "MN",
    to: "DH",
    mode: "fastest",
    expected: "routed",
    maxGraphDistanceMeters: 175,
    checkReverse: true,
  },
  {
    id: "academic-core-short-mn-ib",
    from: "MN",
    to: "IB",
    mode: "fastest",
    expected: "routed",
    maxGraphDistanceMeters: 185,
    checkReverse: true,
  },
  {
    id: "reviewed-east-link-ib-cct",
    from: "IB",
    to: "CCT",
    mode: "fastest",
    expected: "routed",
    maxGraphDistanceMeters: 525,
    requiredEdgeIds: ["reviewed-topology-connector-five-minute-walk-east-link"],
    checkReverse: true,
  },
  {
    id: "academic-core-short-dv-kn",
    from: "DV",
    to: "KN",
    mode: "fastest",
    expected: "routed",
    maxGraphDistanceMeters: 140,
    checkReverse: true,
  },
  {
    id: "campus-span-rawc-mn",
    from: "RAWC",
    to: "MN",
    mode: "fastest",
    expected: "routed",
    maxGraphDistanceMeters: 1_000,
    requiredEdgeIds: ["reviewed-topology-connector-five-minute-walk-east-link"],
    checkReverse: true,
  },
  ...(["MN", "IB", "CCT", "DV", "KN", "RAWC"] as const).map((from, index): RoutingGoldenCase => ({
    id: `step-free-fails-closed-${from.toLowerCase()}`,
    from,
    to: (["DH", "MN", "IB", "KN", "DV", "MN"] as const)[index]!,
    mode: "step-free",
    expected: "unavailable",
  })),
];

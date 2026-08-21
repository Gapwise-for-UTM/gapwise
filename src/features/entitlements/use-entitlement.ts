import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { FREE_ENTITLEMENT, resolveEntitlement, type Entitlement } from "./entitlements";

export const ENTITLEMENT_REFRESH_EVENT = "gapwise:entitlement-refresh";

export function requestEntitlementRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ENTITLEMENT_REFRESH_EVENT));
}

export function useEntitlement(userId: string | null, demo = false): Entitlement {
  const [value, setValue] = useState<Entitlement>(FREE_ENTITLEMENT);
  useEffect(() => {
    let active = true;
    setValue(demo ? { tier: "pro", expiresAt: null } : FREE_ENTITLEMENT);
    if (!userId || demo)
      return () => {
        active = false;
      };
    const client = getSupabaseClient();
    if (!client)
      return () => {
        active = false;
      };

    const load = () => {
      void client
        .from("user_entitlements")
        .select("tier,expires_at")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setValue(resolveEntitlement(data));
        });
    };

    load();
    const refresh = () => load();
    if (typeof window !== "undefined") {
      window.addEventListener(ENTITLEMENT_REFRESH_EVENT, refresh);
      window.addEventListener("focus", refresh);
    }
    return () => {
      active = false;
      if (typeof window !== "undefined") {
        window.removeEventListener(ENTITLEMENT_REFRESH_EVENT, refresh);
        window.removeEventListener("focus", refresh);
      }
    };
  }, [demo, userId]);
  return value;
}

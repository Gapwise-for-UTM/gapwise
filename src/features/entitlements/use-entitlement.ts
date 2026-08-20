import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { FREE_ENTITLEMENT, resolveEntitlement, type Entitlement } from "./entitlements";

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
    void client
      .from("user_entitlements")
      .select("tier,expires_at")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setValue(resolveEntitlement(data));
      });
    return () => {
      active = false;
    };
  }, [demo, userId]);
  return value;
}

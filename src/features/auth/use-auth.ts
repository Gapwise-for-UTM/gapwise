import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getCurrentUser, subscribeToAuthChanges } from "./auth-service";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getCurrentUser().then((nextUser) => {
      if (active) {
        setUser(nextUser);
        setLoading(false);
      }
    });
    const unsubscribe = subscribeToAuthChanges((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { user, loading };
}

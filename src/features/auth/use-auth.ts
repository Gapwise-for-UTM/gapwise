import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getCurrentUser, subscribeToAuthChanges } from "./auth-service";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((nextUser) => {
        if (active) {
          setUser(nextUser);
          setError(null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setError("We couldn't restore your signed-in session.");
          setLoading(false);
        }
      });
    const unsubscribe = subscribeToAuthChanges((nextUser) => {
      setUser(nextUser);
      setError(null);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { user, loading, error };
}

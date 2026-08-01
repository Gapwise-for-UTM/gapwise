import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, requireSupabaseClient } from "@/lib/supabase";

export async function signInWithGoogle(): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

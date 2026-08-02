import { useSyncExternalStore } from "react";
import { authStore } from "./auth-store";

export function useAuth() {
  return useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getServerSnapshot,
  );
}

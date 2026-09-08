import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

export type AuthSnapshot = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

type AuthSubscription = {
  data: { subscription: { unsubscribe: () => void } };
};

export type AuthClient = {
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) => AuthSubscription;
};

const SIGNED_OUT: AuthSnapshot = { user: null, loading: false, error: null };

/** A page-lifetime auth store: one SDK listener, any number of React consumers. */
export function createAuthStore(auth: AuthClient | null) {
  let snapshot: AuthSnapshot = auth ? { user: null, loading: true, error: null } : SIGNED_OUT;
  let started = false;
  let lifecycle = 0;
  let unsubscribeAuth: (() => void) | null = null;
  let blockedUserId: string | null = null;
  const listeners = new Set<() => void>();

  function emit(next: AuthSnapshot, replaceSameUser = false) {
    const sameUser = snapshot.user?.id === next.user?.id;
    if (
      sameUser &&
      !replaceSameUser &&
      snapshot.loading === next.loading &&
      snapshot.error === next.error
    ) {
      return;
    }
    snapshot =
      sameUser && snapshot.user && !replaceSameUser ? { ...next, user: snapshot.user } : next;
    for (const listener of listeners) listener();
  }

  function start() {
    if (started) return;
    started = true;
    if (!auth) {
      emit(SIGNED_OUT);
      return;
    }

    const activeLifecycle = ++lifecycle;
    const { data } = auth.onAuthStateChange((event, session) => {
      if (lifecycle !== activeLifecycle) return;
      const nextUser = session?.user ?? null;
      if (nextUser?.id === blockedUserId && event !== "SIGNED_IN") return;
      if (event === "SIGNED_IN") blockedUserId = null;
      emit({ user: nextUser, loading: false, error: null }, event === "USER_UPDATED");
    });
    unsubscribeAuth = () => data.subscription.unsubscribe();
  }

  function subscribe(listener: () => void) {
    start();
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function forceSignedOut() {
    blockedUserId = snapshot.user?.id ?? blockedUserId;
    emit(SIGNED_OUT);
  }

  function reportInitializationError() {
    blockedUserId = snapshot.user?.id ?? blockedUserId;
    emit({ user: null, loading: false, error: "Sign-in is unavailable." });
  }

  function dispose() {
    lifecycle += 1;
    unsubscribeAuth?.();
    unsubscribeAuth = null;
    started = false;
    listeners.clear();
  }

  return {
    subscribe,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SIGNED_OUT,
    forceSignedOut,
    reportInitializationError,
    dispose,
  };
}

function createDeferredAuthStore() {
  let snapshot: AuthSnapshot = { user: null, loading: true, error: null };
  let started = false;
  let disposed = false;
  let inner: ReturnType<typeof createAuthStore> | null = null;
  let unsubscribeInner: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const emit = (next: AuthSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  function start() {
    if (started) return;
    started = true;
    void import("@/lib/supabase")
      .then(({ getSupabaseClient }) => {
        if (disposed) return;
        inner = createAuthStore(getSupabaseClient()?.auth ?? null);
        unsubscribeInner = inner.subscribe(() => emit(inner!.getSnapshot()));
        emit(inner.getSnapshot());
      })
      .catch(() => {
        if (!disposed) emit({ user: null, loading: false, error: "Sign-in is unavailable." });
      });
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    start();
    return () => listeners.delete(listener);
  }

  function forceSignedOut() {
    if (inner) inner.forceSignedOut();
    else emit(SIGNED_OUT);
  }

  function reportInitializationError() {
    if (inner) inner.reportInitializationError();
    else emit({ user: null, loading: false, error: "Sign-in is unavailable." });
  }

  function dispose() {
    disposed = true;
    unsubscribeInner?.();
    inner?.dispose();
    unsubscribeInner = null;
    inner = null;
    listeners.clear();
  }

  return {
    subscribe,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SIGNED_OUT,
    forceSignedOut,
    reportInitializationError,
    dispose,
  };
}

const authStore = createDeferredAuthStore();

if (import.meta.hot) import.meta.hot.dispose(() => authStore.dispose());

export { authStore };

import { useSyncExternalStore } from "react";
import type { AiDelegationController } from "./use-ai-delegation";

type Listener = () => void;

let currentController: AiDelegationController | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function registerAiDelegationController(controller: AiDelegationController) {
  currentController = controller;
  emit();
  return () => {
    // A controller object is refreshed as its state changes. Defer clearing by one microtask so
    // the replacement registration can win without briefly unmounting the Account settings UI.
    queueMicrotask(() => {
      if (currentController !== controller) return;
      currentController = null;
      emit();
    });
  };
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentController;
}

export function useBridgedAiDelegationController(): AiDelegationController | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

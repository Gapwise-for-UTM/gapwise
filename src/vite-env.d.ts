/// <reference types="vite/client" />

interface DOMStringMap {
  landingProduct?: string;
}

declare module "virtual:pwa-register" {
  export function registerSW(options?: {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  }): (reloadPage?: boolean) => Promise<void>;
}

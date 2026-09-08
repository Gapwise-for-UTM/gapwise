import "./styles.css";
import "./accessibility.css";
import "./gap-plan-overlays.css";
import "./clean-ui.css";
import "./clean-ui-v2.css";
import "./brand-blue.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { registerSW } from "virtual:pwa-register";
import { removeBareHash } from "./lib/url";
import { announceAppUpdate } from "./features/pwa/update-events";

const container = document.getElementById("root");
if (!container) throw new Error("Application root element is missing.");

const canonicalizeBareHash = () => removeBareHash(window.location, window.history);
canonicalizeBareHash();
window.addEventListener("hashchange", canonicalizeBareHash);
if (import.meta.hot) {
  import.meta.hot.dispose(() => window.removeEventListener("hashchange", canonicalizeBareHash));
}

const router = getRouter();
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    announceAppUpdate(() => updateServiceWorker(true));
  },
});

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

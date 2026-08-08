import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { getRouter } from "./router";
import { registerSW } from "virtual:pwa-register";

const container = document.getElementById("root");
if (!container) throw new Error("Application root element is missing.");

const router = getRouter();
registerSW({
  onOfflineReady() {
    console.log("PWA offline ready");
  },
  onNeedRefresh() {
    console.log("PWA update available");
  },
});

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
);

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BusFront, LoaderCircle } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { CampusMap as CampusMapBase, type CampusMapProps } from "./CampusMapBase";
import type {
  MiWayLiveClientStatus,
  MiWayLiveSnapshot,
} from "@/features/transit/miway-live-types";
import type { MiWayLiveLayerController } from "@/features/transit/miway-live-client";

export type { CampusMapProps, MapFocusPadding } from "./CampusMapBase";

type MapLibreModule = typeof import("maplibre-gl");
type CapturedMap = { map: MapLibreMap; maplibregl: MapLibreModule };

function formatEta(seconds: number) {
  if (seconds <= 75) return "now";
  return `${Math.max(1, Math.round(seconds / 60))}m`;
}

function liveStatusLabel(status: MiWayLiveClientStatus) {
  if (status === "loading") return "Connecting…";
  if (status === "stale") return "Data delayed";
  if (status === "unavailable") return "MiWay unavailable";
  return null;
}

function MiWayOverlay({
  enabled,
  status,
  snapshot,
  onToggle,
  onFocusTrip,
}: {
  enabled: boolean;
  status: MiWayLiveClientStatus;
  snapshot: MiWayLiveSnapshot | null;
  onToggle: () => void;
  onFocusTrip: (tripId: string) => void;
}) {
  const statusLabel = liveStatusLabel(status);
  const arrivals = snapshot?.arrivals.slice(0, 5) ?? [];

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-5.25rem)] items-start gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        aria-label={enabled ? "Hide live MiWay buses" : "Show live MiWay buses"}
        title={enabled ? "Hide live buses" : "Live buses"}
        className="button-secondary pointer-events-auto inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-lg px-2.5 text-xs font-semibold shadow-lg md:px-3"
      >
        {enabled && status === "loading" ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <BusFront className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden md:inline">{enabled ? "Live buses on" : "Live buses"}</span>
      </button>

      {enabled ? (
        <div
          className="pointer-events-auto flex min-h-10 min-w-0 items-center gap-2 overflow-x-auto rounded-lg border border-border bg-popover/95 px-2.5 py-1.5 text-popover-foreground shadow-lg backdrop-blur"
          role="status"
          aria-live="polite"
          aria-label="Upcoming live MiWay arrivals at UTM"
        >
          {status === "fresh" ? (
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              LIVE
            </span>
          ) : statusLabel ? (
            <span className="shrink-0 text-[0.7rem] font-medium text-muted-foreground">
              {statusLabel}
            </span>
          ) : null}

          {(status === "fresh" || status === "stale") && arrivals.length === 0 ? (
            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
              No upcoming UTM arrivals in the live feed
            </span>
          ) : null}

          {arrivals.map((arrival) => {
            const content = (
              <>
                <strong className="text-foreground">{arrival.routeId}</strong>
                <span className="text-muted-foreground">{formatEta(arrival.etaSeconds)}</span>
              </>
            );
            return arrival.hasVehicle ? (
              <button
                key={arrival.tripId}
                type="button"
                onClick={() => onFocusTrip(arrival.tripId)}
                className="flex min-h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 font-mono text-[0.7rem] hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={`Focus MiWay ${arrival.routeId} on the map`}
              >
                {content}
              </button>
            ) : (
              <span
                key={arrival.tripId}
                className="flex min-h-7 shrink-0 items-center gap-1.5 px-1.5 font-mono text-[0.7rem]"
              >
                {content}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CampusMap(props: CampusMapProps) {
  const [prepared, setPrepared] = useState(false);
  const [captured, setCaptured] = useState<CapturedMap | null>(null);
  const [miwayEnabled, setMiwayEnabled] = useState(false);
  const [miwayStatus, setMiwayStatus] = useState<MiWayLiveClientStatus>("idle");
  const [miwaySnapshot, setMiwaySnapshot] = useState<MiWayLiveSnapshot | null>(null);
  const controllerRef = useRef<MiWayLiveLayerController | null>(null);
  const restoreAddControlRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let disposed = false;

    void import("maplibre-gl")
      .then((maplibregl) => {
        if (disposed) return;
        maplibregl.setWorkerUrl(mapLibreWorkerUrl);
        const originalAddControl = maplibregl.Map.prototype.addControl;
        const intercepted: typeof originalAddControl = function (
          this: MapLibreMap,
          ...args: Parameters<typeof originalAddControl>
        ) {
          if (!disposed) {
            setCaptured((current) => current ?? { map: this, maplibregl });
          }
          if (maplibregl.Map.prototype.addControl === intercepted) {
            maplibregl.Map.prototype.addControl = originalAddControl;
          }
          restoreAddControlRef.current = null;
          return originalAddControl.apply(this, args);
        };
        maplibregl.Map.prototype.addControl = intercepted;
        restoreAddControlRef.current = () => {
          if (maplibregl.Map.prototype.addControl === intercepted) {
            maplibregl.Map.prototype.addControl = originalAddControl;
          }
        };
        setPrepared(true);
      })
      .catch(() => {
        if (!disposed) setPrepared(true);
      });

    return () => {
      disposed = true;
      restoreAddControlRef.current?.();
      restoreAddControlRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.stop();
    controllerRef.current = null;

    if (!miwayEnabled || !captured) {
      if (!miwayEnabled) {
        setMiwayStatus("idle");
        setMiwaySnapshot(null);
      }
      return;
    }

    let disposed = false;
    const { map, maplibregl } = captured;

    const start = () => {
      if (disposed || controllerRef.current) return;
      setMiwayStatus("loading");
      void import("@/features/transit/miway-live-client")
        .then(({ startMiWayLiveLayer }) => {
          if (disposed) return;
          controllerRef.current = startMiWayLiveLayer({
            map,
            maplibregl,
            theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
            onStatus: setMiwayStatus,
            onSnapshot: setMiwaySnapshot,
          });
        })
        .catch(() => {
          if (!disposed) setMiwayStatus("unavailable");
        });
    };

    if (map.isStyleLoaded()) start();
    else map.once("style.load", start);

    return () => {
      disposed = true;
      map.off("style.load", start);
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, [captured, miwayEnabled]);

  if (!prepared) {
    return (
      <div
        className={`campus-map relative grid w-full place-items-center overflow-hidden rounded-xl border border-border bg-muted px-6 text-center text-sm text-muted-foreground ${props.className || "h-[25rem]"}`}
        role="status"
        aria-live="polite"
      >
        Loading the campus map…
      </div>
    );
  }

  const overlayTarget = captured?.map.getContainer().parentElement ?? null;

  return (
    <>
      <CampusMapBase {...props} />
      {overlayTarget
        ? createPortal(
            <MiWayOverlay
              enabled={miwayEnabled}
              status={miwayStatus}
              snapshot={miwaySnapshot}
              onToggle={() => setMiwayEnabled((enabled) => !enabled)}
              onFocusTrip={(tripId) => controllerRef.current?.focusTrip(tripId)}
            />,
            overlayTarget,
          )
        : null}
    </>
  );
}

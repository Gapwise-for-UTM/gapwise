import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type * as MapLibre from "maplibre-gl";
import type {
  MiWayLiveClientStatus,
  MiWayLiveSnapshot,
  MiWayLiveVehicle,
} from "./miway-live-types";

type MapTheme = "light" | "dark";

type StartOptions = {
  map: MapLibreMap;
  maplibregl: typeof MapLibre;
  theme: MapTheme;
  onStatus: (status: MiWayLiveClientStatus) => void;
  onSnapshot: (snapshot: MiWayLiveSnapshot | null) => void;
};

export type MiWayLiveLayerController = {
  focusTrip: (tripId: string) => boolean;
  stop: () => void;
};

const SOURCE_ID = "gapwise-miway-live";
const HALO_LAYER_ID = "gapwise-miway-live-halo";
const VEHICLE_LAYER_ID = "gapwise-miway-live-vehicles";
const LABEL_LAYER_ID = "gapwise-miway-live-labels";
const POLL_INTERVAL_MS = 5_000;
const FRESH_SECONDS = 90;
const STALE_RETAIN_SECONDS = 180;
const LIVE_BOUNDS: [[number, number], [number, number]] = [
  [-79.72, 43.5],
  [-79.58, 43.61],
];

type RenderedVehicle = {
  vehicle: MiWayLiveVehicle;
  from: [number, number];
  to: [number, number];
  rendered: [number, number];
  startedAt: number;
  duration: number;
};

function emptyFeatureCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

function formatEta(seconds: number) {
  if (seconds <= 75) return "now";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function popupContent(vehicle: MiWayLiveVehicle, snapshot: MiWayLiveSnapshot) {
  const root = document.createElement("section");
  root.className = "space-y-1 px-0.5 py-0.5";
  const title = document.createElement("strong");
  title.className = "block text-sm";
  title.textContent = `MiWay ${vehicle.routeId}`;
  const arrival = document.createElement("p");
  arrival.className = "text-xs text-muted-foreground";
  arrival.textContent = `UTM · ${formatEta(vehicle.etaSeconds)}`;
  const freshness = document.createElement("p");
  freshness.className = "font-mono text-[0.68rem] text-muted-foreground";
  const age = Math.max(0, Math.floor(Date.now() / 1000) - snapshot.sourceTimestamp);
  freshness.textContent = snapshot.status === "fresh" ? `updated ${age}s ago` : `data delayed · ${age}s old`;
  root.append(title, arrival, freshness);
  return root;
}

function validSnapshot(value: unknown): value is MiWayLiveSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<MiWayLiveSnapshot>;
  return (
    (snapshot.status === "fresh" || snapshot.status === "stale") &&
    typeof snapshot.generatedAt === "number" &&
    typeof snapshot.sourceTimestamp === "number" &&
    Array.isArray(snapshot.arrivals) &&
    Array.isArray(snapshot.vehicles)
  );
}

export function startMiWayLiveLayer({
  map,
  maplibregl,
  theme,
  onStatus,
  onSnapshot,
}: StartOptions): MiWayLiveLayerController {
  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let request: AbortController | null = null;
  let animationFrame: number | null = null;
  let snapshot: MiWayLiveSnapshot | null = null;
  let popup: InstanceType<typeof maplibregl.Popup> | null = null;
  const rendered = new Map<string, RenderedVehicle>();
  const originalBounds = map.getMaxBounds();
  const originalMinZoom = map.getMinZoom();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  map.setMaxBounds(LIVE_BOUNDS);
  map.setMinZoom(Math.min(originalMinZoom, 12.25));

  function featureCollection() {
    if (!snapshot) return emptyFeatureCollection();
    const stale = snapshot.status === "stale";
    return {
      type: "FeatureCollection" as const,
      features: [...rendered.values()].map(({ vehicle, rendered: coordinate }) => ({
        type: "Feature" as const,
        properties: {
          id: vehicle.id,
          tripId: vehicle.tripId,
          routeId: vehicle.routeId,
          etaSeconds: vehicle.etaSeconds,
          stale,
        },
        geometry: { type: "Point" as const, coordinates: coordinate },
      })),
    };
  }

  function syncSource() {
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(featureCollection());
  }

  function ensureLayers() {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: featureCollection() });
    }
    const accent = theme === "dark" ? "#60a5fa" : "#146bb8";
    const surface = theme === "dark" ? "#0b111a" : "#ffffff";
    const text = theme === "dark" ? "#f8fafc" : "#0f172a";

    if (!map.getLayer(HALO_LAYER_ID)) {
      map.addLayer({
        id: HALO_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 16,
          "circle-color": accent,
          "circle-opacity": ["case", ["==", ["get", "stale"], true], 0.08, 0.13],
          "circle-blur": 0.45,
        },
      });
    }
    if (!map.getLayer(VEHICLE_LAYER_ID)) {
      map.addLayer({
        id: VEHICLE_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 12,
          "circle-color": surface,
          "circle-stroke-color": accent,
          "circle-stroke-width": 2,
          "circle-opacity": ["case", ["==", ["get", "stale"], true], 0.72, 0.98],
          "circle-stroke-opacity": ["case", ["==", ["get", "stale"], true], 0.55, 0.95],
        },
      });
    }
    if (!map.getLayer(LABEL_LAYER_ID)) {
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "routeId"],
          "text-size": 10.5,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": text,
          "text-opacity": ["case", ["==", ["get", "stale"], true], 0.72, 1],
        },
      });
    }
  }

  function cancelAnimation() {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  function animate() {
    cancelAnimation();
    if (reduceMotion.matches) {
      for (const state of rendered.values()) state.rendered = state.to;
      syncSource();
      return;
    }

    const frame = (now: number) => {
      let moving = false;
      for (const state of rendered.values()) {
        const progress = state.duration <= 0 ? 1 : Math.min(1, (now - state.startedAt) / state.duration);
        const eased = 1 - (1 - progress) ** 3;
        state.rendered = [
          state.from[0] + (state.to[0] - state.from[0]) * eased,
          state.from[1] + (state.to[1] - state.from[1]) * eased,
        ];
        if (progress < 1) moving = true;
      }
      syncSource();
      if (moving && !stopped && document.visibilityState === "visible") {
        animationFrame = requestAnimationFrame(frame);
      } else {
        animationFrame = null;
      }
    };
    animationFrame = requestAnimationFrame(frame);
  }

  function applySnapshot(next: MiWayLiveSnapshot) {
    const now = performance.now();
    const duration = next.status === "fresh" ? Math.min(4_200, POLL_INTERVAL_MS - 350) : 0;
    const nextIds = new Set(next.vehicles.map((vehicle) => vehicle.id));
    for (const id of rendered.keys()) {
      if (!nextIds.has(id)) rendered.delete(id);
    }
    for (const vehicle of next.vehicles) {
      const coordinate: [number, number] = [vehicle.longitude, vehicle.latitude];
      const existing = rendered.get(vehicle.id);
      rendered.set(vehicle.id, {
        vehicle,
        from: existing?.rendered ?? coordinate,
        to: coordinate,
        rendered: existing?.rendered ?? coordinate,
        startedAt: now,
        duration,
      });
    }
    snapshot = next;
    ensureLayers();
    animate();
    onSnapshot(next);
    onStatus(next.status);
  }

  function clearTimer() {
    if (timeout !== null) clearTimeout(timeout);
    timeout = null;
  }

  function schedule() {
    clearTimer();
    if (!stopped && document.visibilityState === "visible") {
      timeout = setTimeout(refresh, POLL_INTERVAL_MS);
    }
  }

  async function refresh() {
    if (stopped || document.visibilityState !== "visible") return;
    request?.abort();
    request = new AbortController();
    if (!snapshot) onStatus("loading");

    try {
      const response = await fetch("/api/miway-live", {
        method: "GET",
        headers: { accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        signal: request.signal,
      });
      if (!response.ok) throw new Error(`MiWay live endpoint returned ${response.status}`);
      const value: unknown = await response.json();
      if (!validSnapshot(value)) throw new Error("MiWay live endpoint returned an invalid snapshot");
      const age = Math.max(0, Math.floor(Date.now() / 1000) - value.sourceTimestamp);
      applySnapshot({ ...value, status: value.status === "fresh" && age <= FRESH_SECONDS ? "fresh" : "stale" });
    } catch (error) {
      if (stopped || request?.signal.aborted) return;
      const age = snapshot
        ? Math.max(0, Math.floor(Date.now() / 1000) - snapshot.sourceTimestamp)
        : Number.POSITIVE_INFINITY;
      if (snapshot && age <= STALE_RETAIN_SECONDS) {
        applySnapshot({ ...snapshot, status: "stale" });
      } else {
        snapshot = null;
        rendered.clear();
        syncSource();
        onSnapshot(null);
        onStatus("unavailable");
      }
    } finally {
      request = null;
      schedule();
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
      clearTimer();
      request?.abort();
      request = null;
      cancelAnimation();
      return;
    }
    void refresh();
  }

  function onOnline() {
    if (document.visibilityState === "visible") void refresh();
  }

  function onOffline() {
    clearTimer();
    request?.abort();
    request = null;
    cancelAnimation();
    onStatus(snapshot ? "stale" : "unavailable");
  }

  function onStyleLoad() {
    if (stopped) return;
    ensureLayers();
    syncSource();
  }

  function onVehicleClick(event: Parameters<Parameters<MapLibreMap["on"]>[2]>[0]) {
    const feature = event.features?.[0];
    const tripId = feature?.properties?.["tripId"];
    if (typeof tripId !== "string" || !snapshot) return;
    const vehicle = snapshot.vehicles.find((item) => item.tripId === tripId);
    if (!vehicle) return;
    popup?.remove();
    popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 16, maxWidth: "15rem" })
      .setLngLat([vehicle.longitude, vehicle.latitude])
      .setDOMContent(popupContent(vehicle, snapshot))
      .addTo(map);
  }

  function onVehicleEnter() {
    map.getCanvas().style.cursor = "pointer";
  }

  function onVehicleLeave() {
    map.getCanvas().style.cursor = "";
  }

  map.on("style.load", onStyleLoad);
  map.on("click", VEHICLE_LAYER_ID, onVehicleClick);
  map.on("mouseenter", VEHICLE_LAYER_ID, onVehicleEnter);
  map.on("mouseleave", VEHICLE_LAYER_ID, onVehicleLeave);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  ensureLayers();
  onStatus("loading");
  void refresh();

  return {
    focusTrip(tripId) {
      const state = [...rendered.values()].find((item) => item.vehicle.tripId === tripId);
      if (!state) return false;
      map.easeTo({
        center: state.rendered,
        zoom: Math.max(14.5, map.getZoom()),
        duration: reduceMotion.matches ? 0 : 480,
      });
      return true;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimer();
      request?.abort();
      request = null;
      cancelAnimation();
      popup?.remove();
      popup = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      map.off("style.load", onStyleLoad);
      map.off("click", VEHICLE_LAYER_ID, onVehicleClick);
      map.off("mouseenter", VEHICLE_LAYER_ID, onVehicleEnter);
      map.off("mouseleave", VEHICLE_LAYER_ID, onVehicleLeave);
      if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
      if (map.getLayer(VEHICLE_LAYER_ID)) map.removeLayer(VEHICLE_LAYER_ID);
      if (map.getLayer(HALO_LAYER_ID)) map.removeLayer(HALO_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      map.setMinZoom(originalMinZoom);
      map.setMaxBounds(originalBounds ?? null);
      onSnapshot(null);
      onStatus("idle");
    },
  };
}

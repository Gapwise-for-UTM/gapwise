import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "./miway-live-layer.css";

type MapLibreModule = typeof import("maplibre-gl");

export type MiWayVehicle = {
  id: string;
  route: string;
  tripId: string | null;
  label: string | null;
  lat: number;
  lng: number;
  bearing: number | null;
  speedMps: number | null;
  observedAt: string | null;
  utmEtaSeconds: number | null;
  atUtm: boolean;
};

export type MiWaySnapshot = {
  status: "live" | "stale" | "unavailable";
  generatedAt: string;
  sourceObservedAt: string | null;
  vehicles: MiWayVehicle[];
};

type MarkerRecord = {
  marker: Marker;
  element: HTMLButtonElement;
  vehicle: MiWayVehicle;
  frame: number | null;
};

type StartOptions = {
  map: MapLibreMap;
  maplibregl: MapLibreModule;
  onSnapshot: (snapshot: MiWaySnapshot) => void;
};

const POLL_MS = 7_500;
const MOVE_MS = 6_500;
const REQUEST_TIMEOUT_MS = 4_000;
const MAX_MARKERS = 40;

function etaLabel(vehicle: MiWayVehicle) {
  if (vehicle.atUtm) return "at UTM";
  if (vehicle.utmEtaSeconds === null) return null;
  if (vehicle.utmEtaSeconds < 60) return "<1 min";
  return `${Math.max(1, Math.round(vehicle.utmEtaSeconds / 60))} min`;
}

function popupContent(vehicle: MiWayVehicle) {
  const wrapper = document.createElement("section");
  wrapper.className = "map-miway-popover";

  const heading = document.createElement("div");
  heading.className = "map-miway-popover-heading";
  const route = document.createElement("strong");
  route.textContent = vehicle.route;
  const live = document.createElement("span");
  live.textContent = "MiWay live";
  heading.append(route, live);
  wrapper.append(heading);

  const eta = etaLabel(vehicle);
  if (eta) {
    const row = document.createElement("p");
    row.textContent = `UTM · ${eta}`;
    wrapper.append(row);
  }
  if (vehicle.observedAt) {
    const observed = document.createElement("p");
    observed.className = "map-miway-popover-muted";
    const age = Math.max(0, Math.round((Date.now() - Date.parse(vehicle.observedAt)) / 1000));
    observed.textContent = `Location updated ${age}s ago`;
    wrapper.append(observed);
  }
  return wrapper;
}

function applyVehicleElement(element: HTMLButtonElement, vehicle: MiWayVehicle) {
  element.dataset["route"] = vehicle.route;
  element.dataset["atUtm"] = String(vehicle.atUtm);
  element.textContent = vehicle.route;
  const eta = etaLabel(vehicle);
  element.title = eta ? `MiWay ${vehicle.route} · ${eta}` : `MiWay ${vehicle.route}`;
  element.setAttribute(
    "aria-label",
    eta ? `MiWay route ${vehicle.route}, ${eta}` : `MiWay route ${vehicle.route}, live location`,
  );
}

function animateMarker(record: MarkerRecord, next: MiWayVehicle) {
  if (record.frame !== null) cancelAnimationFrame(record.frame);
  const start = record.marker.getLngLat();
  const startedAt = performance.now();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    record.marker.setLngLat([next.lng, next.lat]);
    record.vehicle = next;
    return;
  }

  const frame = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / MOVE_MS);
    const eased = 1 - (1 - progress) ** 3;
    record.marker.setLngLat([
      start.lng + (next.lng - start.lng) * eased,
      start.lat + (next.lat - start.lat) * eased,
    ]);
    if (progress < 1) {
      record.frame = requestAnimationFrame(frame);
    } else {
      record.frame = null;
      record.vehicle = next;
    }
  };
  record.frame = requestAnimationFrame(frame);
}

function normalizedSnapshot(value: unknown): MiWaySnapshot | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<MiWaySnapshot>;
  if (
    (payload.status !== "live" && payload.status !== "stale" && payload.status !== "unavailable") ||
    typeof payload.generatedAt !== "string" ||
    !Array.isArray(payload.vehicles)
  ) {
    return null;
  }
  const vehicles = payload.vehicles
    .filter((vehicle): vehicle is MiWayVehicle => {
      if (!vehicle || typeof vehicle !== "object") return false;
      const item = vehicle as Partial<MiWayVehicle>;
      return (
        typeof item.id === "string" &&
        typeof item.route === "string" &&
        typeof item.lat === "number" &&
        Number.isFinite(item.lat) &&
        typeof item.lng === "number" &&
        Number.isFinite(item.lng)
      );
    })
    .slice(0, MAX_MARKERS);
  return {
    status: payload.status,
    generatedAt: payload.generatedAt,
    sourceObservedAt: typeof payload.sourceObservedAt === "string" ? payload.sourceObservedAt : null,
    vehicles,
  };
}

export function startMiWayLiveLayer({ map, maplibregl, onSnapshot }: StartOptions) {
  const markers = new Map<string, MarkerRecord>();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeRequest: AbortController | null = null;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const removeMarkers = () => {
    for (const record of markers.values()) {
      if (record.frame !== null) cancelAnimationFrame(record.frame);
      record.marker.remove();
    }
    markers.clear();
  };

  const syncMarkers = (snapshot: MiWaySnapshot) => {
    if (snapshot.status === "unavailable") {
      removeMarkers();
      return;
    }
    const nextIds = new Set(snapshot.vehicles.map((vehicle) => vehicle.id));
    for (const [id, record] of markers) {
      if (!nextIds.has(id)) {
        if (record.frame !== null) cancelAnimationFrame(record.frame);
        record.marker.remove();
        markers.delete(id);
      }
    }

    for (const vehicle of snapshot.vehicles) {
      const existing = markers.get(vehicle.id);
      if (existing) {
        applyVehicleElement(existing.element, vehicle);
        animateMarker(existing, vehicle);
        continue;
      }
      const element = document.createElement("button");
      element.type = "button";
      element.className = "map-miway-marker";
      applyVehicleElement(element, vehicle);
      const popup = new maplibregl.Popup({
        offset: 18,
        closeButton: true,
        closeOnClick: true,
        maxWidth: "15rem",
      }).setDOMContent(popupContent(vehicle));
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([vehicle.lng, vehicle.lat])
        .setPopup(popup)
        .addTo(map);
      markers.set(vehicle.id, { marker, element, vehicle, frame: null });
    }
  };

  const schedule = (delay = POLL_MS) => {
    clearTimer();
    if (!stopped && document.visibilityState === "visible") {
      timer = setTimeout(() => void refresh(), delay);
    }
  };

  const refresh = async () => {
    if (stopped || document.visibilityState !== "visible") return;
    activeRequest?.abort();
    const controller = new AbortController();
    activeRequest = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/miway", {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const snapshot = normalizedSnapshot(await response.json());
      if (!snapshot) throw new Error("Invalid MiWay snapshot.");
      if (!stopped) {
        syncMarkers(snapshot);
        onSnapshot(snapshot);
      }
    } catch {
      if (!stopped && !controller.signal.aborted) {
        const unavailable: MiWaySnapshot = {
          status: "unavailable",
          generatedAt: new Date().toISOString(),
          sourceObservedAt: null,
          vehicles: [],
        };
        syncMarkers(unavailable);
        onSnapshot(unavailable);
      }
    } finally {
      clearTimeout(timeout);
      if (activeRequest === controller) activeRequest = null;
      schedule();
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      clearTimer();
      activeRequest?.abort();
      activeRequest = null;
      return;
    }
    schedule(0);
  };

  document.addEventListener("visibilitychange", onVisibility);
  void refresh();

  return () => {
    stopped = true;
    clearTimer();
    activeRequest?.abort();
    activeRequest = null;
    document.removeEventListener("visibilitychange", onVisibility);
    removeMarkers();
  };
}

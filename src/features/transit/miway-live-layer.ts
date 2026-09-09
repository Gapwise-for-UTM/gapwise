import type { Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
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
  popup: Popup;
  element: HTMLButtonElement;
  vehicle: MiWayVehicle;
  from: [number, number];
  to: [number, number];
  moveStartedAt: number | null;
};

type StartOptions = {
  map: MapLibreMap;
  maplibregl: MapLibreModule;
  onSnapshot: (snapshot: MiWaySnapshot) => void;
};

const POLL_MS = 5_000;
const MOVE_MS = 4_500;
const REQUEST_TIMEOUT_MS = 6_000;
const MAX_MARKERS = 40;
const STALE_LIMIT_MS = 120_000;

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

function normalizedSnapshot(value: unknown): MiWaySnapshot | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<MiWaySnapshot>;
  const status = payload.status;
  if (
    (status !== "live" && status !== "stale" && status !== "unavailable") ||
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
    status,
    generatedAt: payload.generatedAt,
    sourceObservedAt:
      typeof payload.sourceObservedAt === "string" ? payload.sourceObservedAt : null,
    vehicles,
  };
}

function degradedSnapshot(previous: MiWaySnapshot | null): MiWaySnapshot {
  const now = Date.now();
  if (previous?.sourceObservedAt) {
    const observedAt = Date.parse(previous.sourceObservedAt);
    if (Number.isFinite(observedAt) && now - observedAt <= STALE_LIMIT_MS) {
      return {
        ...previous,
        status: "stale",
        generatedAt: new Date(now).toISOString(),
      };
    }
  }
  return {
    status: "unavailable",
    generatedAt: new Date(now).toISOString(),
    sourceObservedAt: previous?.sourceObservedAt ?? null,
    vehicles: [],
  };
}

export function startMiWayLiveLayer({ map, maplibregl, onSnapshot }: StartOptions) {
  const markers = new Map<string, MarkerRecord>();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeRequest: AbortController | null = null;
  let animationFrame: number | null = null;
  let lastSnapshot: MiWaySnapshot | null = null;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const stopAnimation = () => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
  };

  const removeMarkers = () => {
    stopAnimation();
    for (const record of markers.values()) record.marker.remove();
    markers.clear();
  };

  const animate = (now: number) => {
    animationFrame = null;
    let stillMoving = false;
    for (const record of markers.values()) {
      if (record.moveStartedAt === null) continue;
      const progress = Math.min(1, (now - record.moveStartedAt) / MOVE_MS);
      record.marker.setLngLat([
        record.from[0] + (record.to[0] - record.from[0]) * progress,
        record.from[1] + (record.to[1] - record.from[1]) * progress,
      ]);
      if (progress < 1) {
        stillMoving = true;
      } else {
        record.moveStartedAt = null;
      }
    }
    if (stillMoving && !stopped) animationFrame = requestAnimationFrame(animate);
  };

  const ensureAnimation = () => {
    if (animationFrame === null && !reducedMotion.matches) {
      animationFrame = requestAnimationFrame(animate);
    }
  };

  const syncMarkers = (snapshot: MiWaySnapshot) => {
    if (snapshot.status === "unavailable") {
      removeMarkers();
      return;
    }

    const nextIds = new Set(snapshot.vehicles.map((vehicle) => vehicle.id));
    for (const [id, record] of markers) {
      if (!nextIds.has(id)) {
        record.marker.remove();
        markers.delete(id);
      }
    }

    let hasMovement = false;
    for (const vehicle of snapshot.vehicles) {
      const existing = markers.get(vehicle.id);
      if (existing) {
        applyVehicleElement(existing.element, vehicle);
        existing.popup.setDOMContent(popupContent(vehicle));
        const current = existing.marker.getLngLat();
        existing.from = [current.lng, current.lat];
        existing.to = [vehicle.lng, vehicle.lat];
        existing.vehicle = vehicle;
        if (reducedMotion.matches) {
          existing.marker.setLngLat(existing.to);
          existing.moveStartedAt = null;
        } else if (current.lng !== vehicle.lng || current.lat !== vehicle.lat) {
          existing.moveStartedAt = performance.now();
          hasMovement = true;
        } else {
          existing.moveStartedAt = null;
        }
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
      markers.set(vehicle.id, {
        marker,
        popup,
        element,
        vehicle,
        from: [vehicle.lng, vehicle.lat],
        to: [vehicle.lng, vehicle.lat],
        moveStartedAt: null,
      });
    }

    if (hasMovement) ensureAnimation();
  };

  const publishSnapshot = (snapshot: MiWaySnapshot) => {
    lastSnapshot = snapshot;
    syncMarkers(snapshot);
    onSnapshot(snapshot);
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
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/health?view=miway", {
        method: "GET",
        credentials: "omit",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const snapshot = normalizedSnapshot(await response.json());
      if (!snapshot) throw new Error("Invalid MiWay snapshot.");
      if (!stopped) publishSnapshot(snapshot);
    } catch {
      const intentionallyAborted =
        controller.signal.aborted && !timedOut && document.visibilityState !== "visible";
      if (!stopped && !intentionallyAborted) publishSnapshot(degradedSnapshot(lastSnapshot));
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
      stopAnimation();
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

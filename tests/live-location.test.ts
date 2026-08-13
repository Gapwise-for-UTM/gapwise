import { describe, expect, test } from "bun:test";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { watchCampusLocation, type LiveLocationState } from "@/features/routing/live-location";

function position(longitude: number, latitude: number, accuracy: number) {
  return {
    coords: { longitude, latitude, accuracy },
  } as GeolocationPosition;
}

function watcher() {
  let success: PositionCallback | null = null;
  let failure: PositionErrorCallback | null = null;
  const cleared: number[] = [];
  const geolocation = {
    watchPosition(next: PositionCallback, error: PositionErrorCallback | null) {
      success = next;
      failure = error;
      return 42;
    },
    clearWatch(id: number) {
      cleared.push(id);
    },
  } as Pick<Geolocation, "watchPosition" | "clearWatch">;
  return {
    geolocation,
    emitPosition(value: GeolocationPosition) {
      success?.(value);
    },
    emitError(code: number) {
      failure?.({ code } as GeolocationPositionError);
    },
    cleared,
  };
}

describe("ephemeral campus live location", () => {
  test("shows only on-campus updates and supports campus boundary transitions", () => {
    const mock = watcher();
    const states: LiveLocationState[] = [];
    const stop = watchCampusLocation({
      geolocation: mock.geolocation,
      graph: UTM_ROUTING_GRAPH,
      onChange: (state) => states.push(state),
    });
    expect(states.at(-1)).toEqual({ status: "requesting", point: null });

    mock.emitPosition(position(-79.66475, 43.55105, 12));
    expect(states.at(-1)?.status).toBe("on-campus");
    expect(states.at(-1)?.point).not.toBeNull();

    mock.emitPosition(position(-79.7, 43.57, 10));
    expect(states.at(-1)).toEqual({ status: "off-campus", point: null });

    mock.emitPosition(position(-79.66346, 43.54786, 8));
    expect(states.at(-1)?.status).toBe("on-campus");

    stop();
    expect(mock.cleared).toEqual([42]);
    mock.emitPosition(position(-79.7, 43.57, 10));
    expect(states.at(-1)?.status).toBe("on-campus");
  });

  test("fails closed for poor accuracy and permission errors", () => {
    const mock = watcher();
    const states: LiveLocationState[] = [];
    const stop = watchCampusLocation({
      geolocation: mock.geolocation,
      graph: UTM_ROUTING_GRAPH,
      onChange: (state) => states.push(state),
    });
    mock.emitPosition(position(-79.66475, 43.55105, 150));
    expect(states.at(-1)).toEqual({ status: "off-campus", point: null });
    mock.emitError(1);
    expect(states.at(-1)).toEqual({ status: "permission-denied", point: null });
    stop();
  });
});

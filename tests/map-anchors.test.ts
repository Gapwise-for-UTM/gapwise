import { describe, expect, test } from "bun:test";
import { resolveMapAnchor, type MapAnchorSegment } from "@/features/routing/map-anchors";

const segments: MapAnchorSegment[] = [
  {
    id: "first-to-middle",
    fromId: "first",
    toId: "middle",
    coordinates: [
      [-79.67, 43.55],
      [-79.66, 43.55],
    ],
  },
  {
    id: "middle-to-last",
    fromId: "middle",
    toId: "last",
    coordinates: [
      [-79.659, 43.551],
      [-79.65, 43.552],
    ],
  },
];

describe("campus map route anchors", () => {
  test("keeps timetable class markers on their canonical building coordinate", () => {
    expect(resolveMapAnchor("first", [1, 2], segments, "first-to-middle")).toEqual({
      coordinate: [1, 2],
      source: "fallback",
    });
    expect(resolveMapAnchor("middle", [3, 4], segments, "first-to-middle")).toEqual({
      coordinate: [3, 4],
      source: "fallback",
    });
  });

  test("does not move a timetable class marker when another transition is selected", () => {
    const fallback: [number, number] = [-79.655, 43.5515];
    expect(resolveMapAnchor("middle", fallback, segments, "first-to-middle")).toEqual({
      coordinate: fallback,
      source: "fallback",
    });
    expect(resolveMapAnchor("middle", fallback, segments, "middle-to-last")).toEqual({
      coordinate: fallback,
      source: "fallback",
    });
    expect(resolveMapAnchor("middle", fallback, segments, null)).toEqual({
      coordinate: fallback,
      source: "fallback",
    });
  });

  test("keeps synthetic multi-id campus anchors aligned to a selected route endpoint", () => {
    const homeSegments: MapAnchorSegment[] = [
      {
        id: "home-to-first",
        fromId: "home:start",
        toId: "first",
        coordinates: [
          [-79.671, 43.549],
          [-79.67, 43.55],
        ],
      },
      {
        id: "last-to-home",
        fromId: "last",
        toId: "home:end",
        coordinates: [
          [-79.65, 43.552],
          [-79.6712, 43.5492],
        ],
      },
    ];
    expect(
      resolveMapAnchor(["home:start", "home:end"], [0, 0], homeSegments, "last-to-home"),
    ).toEqual({ coordinate: [-79.6712, 43.5492], source: "selected-route" });
  });

  test("uses route endpoints for synthetic anchors before their fallback", () => {
    expect(resolveMapAnchor(["middle"], [0, 0], segments, null)).toEqual({
      coordinate: [-79.659, 43.551],
      source: "outgoing-route",
    });
    expect(resolveMapAnchor(["last"], [0, 0], segments, null)).toEqual({
      coordinate: [-79.65, 43.552],
      source: "incoming-route",
    });
    expect(resolveMapAnchor(["unrouted"], [1, 2], segments, null)).toEqual({
      coordinate: [1, 2],
      source: "fallback",
    });
  });
});

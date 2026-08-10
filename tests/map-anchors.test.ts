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
  test("places both selected transition markers exactly on its line endpoints", () => {
    expect(resolveMapAnchor("first", [0, 0], segments, "first-to-middle")).toMatchObject({
      coordinate: [-79.67, 43.55],
      source: "selected-route",
    });
    expect(resolveMapAnchor("middle", [0, 0], segments, "first-to-middle")).toMatchObject({
      coordinate: [-79.66, 43.55],
      source: "selected-route",
    });
  });

  test("moves a shared stop to the newly selected route entrance", () => {
    expect(resolveMapAnchor("middle", [0, 0], segments, "middle-to-last")).toMatchObject({
      coordinate: [-79.659, 43.551],
      source: "selected-route",
    });
  });

  test("uses route endpoints before falling back to the default building entrance", () => {
    expect(resolveMapAnchor("middle", [0, 0], segments, null)).toMatchObject({
      coordinate: [-79.659, 43.551],
      source: "outgoing-route",
    });
    expect(resolveMapAnchor("unrouted", [1, 2], segments, null)).toEqual({
      coordinate: [1, 2],
      source: "fallback",
    });
  });

  test("supports multiple synthetic home stop IDs", () => {
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
});

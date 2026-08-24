import { getRecognizedBuilding } from "../../data/utm/building-registry.js";
import type { CampusPlace, CampusStateSnapshot } from "./types";

const RETRIEVED_AT = "2026-08-24T00:00:00Z";
const unknownHours = (sourceId: string) => ({
  sourceId,
  status: "unknown" as const,
  observedAt: RETRIEVED_AT,
  note: "Stable place identity is published, but current operating hours are not bundled; check the official source.",
});
const verified = (sourceId: string) => ({
  sourceId,
  status: "verified" as const,
  observedAt: RETRIEVED_AT,
});

export const CAMPUS_STATE_SNAPSHOT: CampusStateSnapshot = {
  schemaVersion: 1,
  version: "utm-campus-state-2026-08-24",
  generatedAt: RETRIEVED_AT,
  sources: [
    {
      id: "utm-hospitality",
      name: "UTM Hospitality & Retail Services",
      url: "https://www.utm.utoronto.ca/hospitality/FoodLocations",
      kind: "official",
      retrievedAt: RETRIEVED_AT,
    },
    {
      id: "utm-library",
      name: "UTM Library",
      url: "https://library.utm.utoronto.ca/",
      kind: "official",
      retrievedAt: RETRIEVED_AT,
    },
    {
      id: "utm-athletics",
      name: "UTM Recreation, Athletics & Wellness",
      url: "https://www.utm.utoronto.ca/athletics/",
      kind: "official",
      retrievedAt: RETRIEVED_AT,
    },
  ],
  places: [
    {
      id: "davis-food-court",
      name: "Davis Food Court",
      kind: "dining",
      buildingCode: "DV",
      summary: "Dining options in the William G. Davis Building.",
      amenities: ["food"],
      hoursProvenance: unknownHours("utm-hospitality"),
      metadataProvenance: verified("utm-hospitality"),
      actions: [
        {
          label: "Official dining information",
          url: "https://www.utm.utoronto.ca/hospitality/FoodLocations",
          kind: "information",
        },
      ],
    },
    {
      id: "utm-library",
      name: "Hazel McCallion Academic Learning Centre",
      kind: "library",
      buildingCode: "HM",
      summary: "UTM's library and academic learning centre.",
      amenities: ["individual study", "group study", "library services"],
      hoursProvenance: unknownHours("utm-library"),
      metadataProvenance: verified("utm-library"),
      actions: [
        {
          label: "Library information and hours",
          url: "https://library.utm.utoronto.ca/",
          kind: "information",
        },
      ],
    },
    {
      id: "rawc",
      name: "Recreation, Athletics and Wellness Centre",
      kind: "recreation",
      buildingCode: "RAWC",
      summary: "Campus recreation, athletics and wellness facilities.",
      amenities: ["recreation", "fitness"],
      hoursProvenance: unknownHours("utm-athletics"),
      metadataProvenance: verified("utm-athletics"),
      actions: [
        {
          label: "Official RAWC information",
          url: "https://www.utm.utoronto.ca/athletics/",
          kind: "information",
        },
      ],
    },
  ],
  events: [],
  dynamicFacts: [],
};

function validateSnapshot(snapshot: CampusStateSnapshot) {
  const ids = new Set<string>();
  const sources = new Set(snapshot.sources.map((source) => source.id));
  for (const place of snapshot.places) {
    if (ids.has(place.id)) throw new Error(`Duplicate campus place id: ${place.id}`);
    ids.add(place.id);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(place.id))
      throw new Error(`Invalid campus place id: ${place.id}`);
    if (!getRecognizedBuilding(place.buildingCode))
      throw new Error(`Unknown building for campus place ${place.id}`);
    if (
      !sources.has(place.metadataProvenance.sourceId) ||
      !sources.has(place.hoursProvenance.sourceId)
    )
      throw new Error(`Unknown source for campus place ${place.id}`);
    for (const action of place.actions ?? []) {
      const url = new URL(action.url);
      if (url.protocol !== "https:")
        throw new Error(`Unsafe action URL for campus place ${place.id}`);
    }
  }
}
validateSnapshot(CAMPUS_STATE_SNAPSHOT);

export function listCampusPlaces(): readonly CampusPlace[] {
  return CAMPUS_STATE_SNAPSHOT.places;
}
export function getCampusPlace(id: string): CampusPlace | null {
  return CAMPUS_STATE_SNAPSHOT.places.find((place) => place.id === id) ?? null;
}
export function getCampusSource(id: string) {
  return CAMPUS_STATE_SNAPSHOT.sources.find((source) => source.id === id) ?? null;
}

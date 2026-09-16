import {
  PUBLIC_CAMPUS_DATA_VERSION,
  publicCampusBuildings,
} from "../src/server/public-campus/data.js";
import { serverCampusBuildingFootprints } from "../src/server/public-campus/footprints.js";
import { jsonResponse, optionsResponse } from "../src/server/public-campus/http.js";
import { listPublicBuildings } from "../src/server/public-campus/service.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") {
      return jsonResponse({ error: "method_not_allowed", message: "Use GET." }, 405);
    }

    // Native map clients can opt into the same canonical footprints and entrance
    // geometry used by the web map without changing the existing public response.
    const includeGeometry = new URL(request.url).searchParams.get("geometry") === "1";
    if (!includeGeometry) {
      return jsonResponse(
        {
          service: "gapwise-public-campus",
          buildings: listPublicBuildings(),
        },
        200,
        "public, max-age=3600, must-revalidate",
      );
    }

    const footprints = new Map(
      serverCampusBuildingFootprints().map((feature) => [feature.properties.buildingCode, feature]),
    );
    return jsonResponse(
      {
        service: "gapwise-public-campus",
        dataVersion: PUBLIC_CAMPUS_DATA_VERSION,
        buildings: publicCampusBuildings().map((building) => ({
          code: building.code,
          name: building.name,
          category: building.category,
          aliases: building.aliases,
          navigationPoint: building.navigationPoint,
          footprint: footprints.get(building.code) ?? null,
          entrances: building.entrances.map((entrance) => ({
            id: entrance.id,
            label: entrance.label,
            kind: entrance.kind,
            coordinates: entrance.coordinates,
            accessibility: entrance.accessibility,
            notes: entrance.notes,
          })),
        })),
      },
      200,
      "public, max-age=3600, must-revalidate",
    );
  },
};

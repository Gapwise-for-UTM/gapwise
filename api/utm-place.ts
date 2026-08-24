import { CAMPUS_STATE_SNAPSHOT, getCampusPlace } from "../src/features/campus-state/snapshot.js";
import { jsonResponse, optionsResponse } from "../src/server/public-campus/http.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") {
      return jsonResponse({ error: "method_not_allowed", message: "Use GET." }, 405);
    }
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      return jsonResponse(
        { error: "invalid_request", message: "A canonical place id is required." },
        400,
      );
    }
    const place = getCampusPlace(id);
    if (!place)
      return jsonResponse({ error: "not_found", message: "Campus place not found." }, 404);
    return jsonResponse(
      {
        service: "gapwise-public-campus",
        dataVersion: CAMPUS_STATE_SNAPSHOT.version,
        place,
        source: CAMPUS_STATE_SNAPSHOT.sources.find(
          (item) => item.id === place.metadataProvenance.sourceId,
        ),
      },
      200,
      "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
    );
  },
};

import { CAMPUS_STATE_SNAPSHOT } from "../src/features/campus-state/snapshot.js";
import { jsonResponse, optionsResponse } from "../src/server/public-campus/http.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") {
      return jsonResponse({ error: "method_not_allowed", message: "Use GET." }, 405);
    }
    return jsonResponse(
      {
        service: "gapwise-public-campus",
        dataVersion: CAMPUS_STATE_SNAPSHOT.version,
        generatedAt: CAMPUS_STATE_SNAPSHOT.generatedAt,
        places: CAMPUS_STATE_SNAPSHOT.places,
        sources: CAMPUS_STATE_SNAPSHOT.sources,
      },
      200,
      "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
    );
  },
};

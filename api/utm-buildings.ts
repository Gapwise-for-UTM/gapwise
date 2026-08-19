import { listPublicBuildings } from "../src/server/public-campus/service.js";
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
        buildings: listPublicBuildings(),
      },
      200,
      "public, max-age=3600, must-revalidate",
    );
  },
};
